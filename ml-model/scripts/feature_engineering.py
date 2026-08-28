"""
CredBridge / AIRA - Feature Engineering Pipeline
--------------------------------------------------
Converts a user's raw 6-month transaction ledger into the behavioral
features the scoring model (Phase 2 of the build plan) trains on:
  - income_regularity        (higher = more stable income)
  - avg_monthly_income
  - savings_ratio             (net saved / total income)
  - bill_payment_count
  - bill_payment_regularity   (higher = more consistent bill-paying)
  - transaction_diversity     (Shannon entropy over transaction types)
  - spending_to_income_ratio
  - balance_volatility
  - max_single_txn_pct_balance (spike detector)
  - circular_transfer_flag    (same-day pump-then-drain pattern)
  - balance_consistency_pass  (running-balance arithmetic check)
  - months_of_history
This produces training_dataset.csv, ready to feed into an
XGBoost/LightGBM classifier for the trust score.
"""

import numpy as np
import pandas as pd

tx = pd.read_csv("synthetic_transactions.csv")
tx["date"] = pd.to_datetime(tx["date"])
tx["month"] = tx["date"].dt.to_period("M")


def shannon_entropy(counts):
    probs = counts / counts.sum()
    probs = probs[probs > 0]
    return float(-(probs * np.log2(probs)).sum())


def balance_consistency_check(user_tx):
    """Recompute running balance from amount_in/out/fee and compare to the
    stated balance column - this is the same check the Statement
    Verification module (Phase 4) runs on real uploaded PDFs."""
    user_tx = user_tx.sort_values(["day_index", "seq"], kind="stable")
    running = None
    mismatches = 0
    for _, row in user_tx.iterrows():
        if running is None:
            running = row["balance"]
            continue
        expected = running + row["amount_in"] - row["amount_out"] - row["fee"]
        if abs(expected - row["balance"]) > 1.0:  # 1 BDT tolerance for rounding
            mismatches += 1
        running = row["balance"]
    return mismatches == 0


def circular_transfer_flag(user_tx):
    """Flags the PaySim-style pump-then-drain-same-day pattern.
    Calibrated against the actual data: legitimate personas (including
    seasonal farmers with large lump-sum harvest income) show a same-day
    spend ratio averaging 15-30% even on high-inflow days, with rare
    outliers. The injected fraud_gaming pattern sits at ~95-135% same-day
    drain by construction, so a 0.95 threshold isolates it cleanly while
    still allowing for the occasional legitimate same-day pass-through."""
    daily = user_tx.groupby("day_index").agg(
        in_sum=("amount_in", "sum"), out_sum=("amount_out", "sum")
    )
    flagged = ((daily["in_sum"] > 3000) &
               (daily["out_sum"] >= 0.95 * daily["in_sum"])).any()
    return bool(flagged)


rows = []
for uid, g in tx.groupby("user_id"):
    persona = g["persona"].iloc[0]
    months = g["month"].nunique()
    monthly_income = g.groupby("month")["amount_in"].sum()
    monthly_spend = g.groupby("month")["amount_out"].sum()

    income_cv = (monthly_income.std() / monthly_income.mean()
                 if monthly_income.mean() > 0 and len(monthly_income) > 1 else 1.0)
    income_regularity = round(max(0.0, 1 - min(income_cv, 1.0)), 3)

    total_in = g["amount_in"].sum()
    total_out = g["amount_out"].sum()
    savings_ratio = round((total_in - total_out) / total_in, 3) if total_in > 0 else 0.0

    bills = g[g["type"] == "Pay Bill"].sort_values("day_index")
    bill_count = len(bills)
    if bill_count >= 2:
        gaps = bills["day_index"].diff().dropna()
        bill_cv = gaps.std() / gaps.mean() if gaps.mean() > 0 else 1.0
        bill_regularity = round(max(0.0, 1 - min(bill_cv, 1.0)), 3)
    else:
        bill_regularity = 0.0

    type_counts = g["type"].value_counts()
    diversity = round(shannon_entropy(type_counts.values) / np.log2(len(FEE_TYPES := g["type"].unique()) or 1), 3) if len(g["type"].unique()) > 1 else 0.0

    spend_income_ratio = round(total_out / total_in, 3) if total_in > 0 else np.nan

    balance_vals = g.sort_values("day_index")["balance"]
    balance_volatility = round(balance_vals.std() / (balance_vals.mean() + 1e-6), 3)

    max_txn = max(g["amount_in"].max(), g["amount_out"].max())
    avg_balance = balance_vals.mean() + 1e-6
    max_spike_pct = round(max_txn / avg_balance, 2)

    circ_flag = circular_transfer_flag(g)
    balance_ok = balance_consistency_check(g)

    rows.append({
        "user_id": uid, "persona": persona,
        "months_of_history": months,
        "n_transactions": len(g),
        "income_regularity": income_regularity,
        "avg_monthly_income": round(monthly_income.mean(), 2) if len(monthly_income) else 0.0,
        "savings_ratio": savings_ratio,
        "bill_payment_count": bill_count,
        "bill_payment_regularity": bill_regularity,
        "transaction_diversity": diversity,
        "spending_to_income_ratio": spend_income_ratio,
        "balance_volatility": balance_volatility,
        "max_single_txn_pct_balance": max_spike_pct,
        "circular_transfer_flag": circ_flag,
        "balance_consistency_pass": balance_ok,
    })

feat_df = pd.DataFrame(rows)


def composite_score(row):
    savings_component = max(0.0, min(row["savings_ratio"], 1.0))
    return (0.35 * row["income_regularity"] + 0.30 * row["bill_payment_regularity"] +
            0.20 * savings_component + 0.15 * row["transaction_diversity"])


feat_df["composite_score"] = feat_df.apply(composite_score, axis=1)

# Hard override labels first (data-quality / fraud gates - not score-based)
feat_df["risk_label"] = None
feat_df.loc[(feat_df["persona"] == "thin_file_new_user") |
            (feat_df["months_of_history"] < 3), "risk_label"] = "insufficient_history"
feat_df.loc[feat_df["risk_label"].isna() &
            (feat_df["circular_transfer_flag"] | ~feat_df["balance_consistency_pass"]),
            "risk_label"] = "fraud_flag"

# For everyone else, tier by where their composite score falls relative to
# the eligible population's own distribution - this mirrors how real credit
# bureaus calibrate cutoffs against their observed applicant pool rather
# than an arbitrary fixed number, and will be re-calibrated against real
# repayment outcomes once pilot data (Section 6, whitepaper) is available.
eligible_mask = feat_df["risk_label"].isna()
q40, q75 = feat_df.loc[eligible_mask, "composite_score"].quantile([0.40, 0.75])


def tier_from_score(score):
    if score >= q75:
        return "low_risk"
    elif score >= q40:
        return "medium_risk"
    return "high_risk"


feat_df.loc[eligible_mask, "risk_label"] = feat_df.loc[eligible_mask, "composite_score"].apply(tier_from_score)

tier_map = {"low_risk": "Platinum/Gold", "medium_risk": "Silver",
            "high_risk": "Bronze", "fraud_flag": "Rejected - Fraud Review",
            "insufficient_history": "Pending - Needs More History"}
feat_df["tier"] = feat_df["risk_label"].map(tier_map)

feat_df.to_csv("training_dataset.csv", index=False)
print(f"Built training_dataset.csv with {len(feat_df)} users.")
print(feat_df["risk_label"].value_counts())
print(feat_df["tier"].value_counts())
