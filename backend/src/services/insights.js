// Turns raw statement features and a score record into two audience-specific
// views: borrower-safe category summaries (no model internals) and lender
// decision-support insights (anomalies, seasonality, thin-file context).
//
// Everything here is derived from the applicant's own behavioural data. No
// model weights, thresholds used by the model, or SHAP values leak into the
// borrower payload.

const SIX_MONTH_TARGET = 6;
const THIN_FILE_MONTHS = 3;
const MIN_USEFUL_TRANSACTIONS = 25;

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Grades a 0..1 style signal into a three-step band the UI can colour.
function band(value, good, fair) {
  if (value >= good) return "strong";
  if (value >= fair) return "building";
  return "attention";
}

function buildCategorySummaries(features = {}) {
  const monthsOfHistory = num(features.months_of_history);
  const transactions = num(features.n_transactions);
  const incomeRegularity = num(features.income_regularity);
  const savingsRatio = num(features.savings_ratio);
  const billCount = num(features.bill_payment_count);
  const billRegularity = num(features.bill_payment_regularity);
  const diversity = num(features.transaction_diversity);
  const spendingRatio = num(features.spending_to_income_ratio);

  return [
    {
      key: "income_stability",
      level: band(incomeRegularity, 0.6, 0.35),
      detail: { monthsOfHistory },
    },
    {
      key: "savings_habit",
      level:
        savingsRatio >= 0.15
          ? "strong"
          : savingsRatio > 0
            ? "building"
            : "attention",
      detail: { positive: savingsRatio > 0 },
    },
    {
      key: "bill_discipline",
      level: billCount === 0 ? "attention" : band(billRegularity, 0.6, 0.3),
      detail: { billCount },
    },
    {
      key: "account_activity",
      level:
        transactions >= MIN_USEFUL_TRANSACTIONS && diversity >= 0.5
          ? "strong"
          : transactions >= 10
            ? "building"
            : "attention",
      detail: { transactions },
    },
    {
      key: "spending_balance",
      level:
        spendingRatio > 0 && spendingRatio <= 0.85
          ? "strong"
          : spendingRatio <= 1
            ? "building"
            : "attention",
      detail: {},
    },
    {
      key: "record_length",
      level:
        monthsOfHistory >= SIX_MONTH_TARGET
          ? "strong"
          : monthsOfHistory >= THIN_FILE_MONTHS
            ? "building"
            : "attention",
      detail: { monthsOfHistory, target: SIX_MONTH_TARGET },
    },
  ];
}

// How complete is the uploaded history against the six-month journey the
// product is designed around?
function historyAdequacy(features = {}) {
  const monthsOfHistory = num(features.months_of_history);
  const transactions = num(features.n_transactions);

  return {
    monthsOfHistory,
    transactionCount: transactions,
    targetMonths: SIX_MONTH_TARGET,
    monthsRemaining: Math.max(0, SIX_MONTH_TARGET - monthsOfHistory),
    progress: Math.min(1, monthsOfHistory / SIX_MONTH_TARGET),
    sufficientForSixMonths: monthsOfHistory >= SIX_MONTH_TARGET,
    thinFile:
      monthsOfHistory < THIN_FILE_MONTHS ||
      transactions < MIN_USEFUL_TRANSACTIONS,
  };
}

// Lender-facing anomaly signals. These are flags for a human to review, never
// an automated rejection.
function detectAnomalies(features = {}) {
  const anomalies = [];
  const push = (code, severity, summary) =>
    anomalies.push({ code, severity, summary });

  if (features.circular_transfer_flag === true) {
    push(
      "circular_transfers",
      "high",
      "Circular or self-transfer patterns appear in the statement. Verify these are genuine trading flows before relying on the income figures.",
    );
  }

  if (features.balance_consistency_pass === false) {
    push(
      "balance_inconsistency",
      "high",
      "Running balances do not reconcile against the listed transactions. Ask for a re-issued statement from the provider.",
    );
  }

  const maxTxnPct = num(features.max_single_txn_pct_balance);
  if (maxTxnPct >= 3) {
    push(
      "large_single_transaction",
      "medium",
      "A single transaction is unusually large relative to the typical balance. Confirm its source before treating it as recurring income.",
    );
  }

  const volatility = num(features.balance_volatility);
  if (volatility >= 2) {
    push(
      "balance_volatility",
      "medium",
      "Balances swing sharply across the period. This can be normal for traders, but the income floor is harder to establish.",
    );
  }

  const savingsRatio = num(features.savings_ratio);
  if (savingsRatio < 0) {
    push(
      "negative_savings",
      "medium",
      "Outflows exceed inflows over the period, so no surplus is being retained.",
    );
  }

  const spendingRatio = num(features.spending_to_income_ratio);
  if (spendingRatio > 1.2) {
    push(
      "spending_exceeds_income",
      "medium",
      "Spending materially exceeds recorded income, which may indicate income arriving outside this account.",
    );
  }

  const adequacy = historyAdequacy(features);
  if (adequacy.thinFile) {
    push(
      "thin_file",
      "low",
      `Only ${adequacy.monthsOfHistory} month(s) and ${adequacy.transactionCount} transaction(s) are available. Treat the assessment as provisional and consider the thin-file review pathway.`,
    );
  }

  return anomalies;
}

// Distinguishes legitimate seasonality from genuine instability — the white
// paper's explicit requirement for farmers and seasonal traders.
function describeSeasonality(features = {}) {
  const incomeRegularity = num(features.income_regularity);
  const monthsOfHistory = num(features.months_of_history);

  if (monthsOfHistory < 4) {
    return {
      pattern: "indeterminate",
      summary:
        "The statement is too short to separate seasonal earning cycles from genuine income instability. A longer history is needed before drawing a conclusion.",
    };
  }

  if (incomeRegularity >= 0.6) {
    return {
      pattern: "steady",
      summary:
        "Monthly inflows are consistent across the period, with no pronounced seasonal peaks or troughs.",
    };
  }

  if (incomeRegularity >= 0.3) {
    return {
      pattern: "seasonal",
      summary:
        "Inflows vary between months in a way consistent with seasonal or harvest-linked earning. Uneven months alone should not be read as instability.",
    };
  }

  return {
    pattern: "irregular",
    summary:
      "Inflows are highly uneven and do not follow a clear seasonal shape. Ask the applicant to explain their earning cycle before deciding.",
  };
}

// Plain-language meaning for each model feature, so a lender reading SHAP
// output is not left interpreting raw column names.
const FACTOR_LABELS = {
  months_of_history: "Length of statement history",
  n_transactions: "Number of transactions",
  income_regularity: "Consistency of monthly income",
  avg_monthly_income: "Average monthly income",
  savings_ratio: "Share of income retained as savings",
  bill_payment_count: "Number of bill payments",
  bill_payment_regularity: "Regularity of bill payments",
  transaction_diversity: "Variety of transaction types",
  spending_to_income_ratio: "Spending relative to income",
  balance_volatility: "Stability of account balance",
  max_single_txn_pct_balance: "Largest transaction vs typical balance",
  circular_transfer_flag: "Circular transfer indicator",
  balance_consistency_pass: "Balance reconciliation check",
};

function describeFactors(factors = {}) {
  return Object.entries(factors || {})
    .map(([key, value]) => ({
      key,
      label: FACTOR_LABELS[key] || key.replace(/_/g, " "),
      value: num(value),
      direction: num(value) >= 0 ? "supporting" : "reducing",
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

function buildLenderInsights({ features = {}, factors = {} } = {}) {
  return {
    anomalies: detectAnomalies(features),
    seasonality: describeSeasonality(features),
    history: historyAdequacy(features),
    factors: describeFactors(factors),
    disclaimer:
      "AI output is decision support only. AIRA does not approve or reject applications; the authorised human lender makes the final decision.",
  };
}

module.exports = {
  FACTOR_LABELS,
  SIX_MONTH_TARGET,
  buildCategorySummaries,
  buildLenderInsights,
  describeFactors,
  describeSeasonality,
  detectAnomalies,
  historyAdequacy,
};
