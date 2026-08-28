# CredBridge / AIRA — Synthetic Training Dataset

## What this is

A calibrated synthetic dataset of 900 users, 6 months of bKash-style transaction
history each (~156K transactions), built for training and demoing the AI credit
scoring model — with ground-truth risk labels so you can train and validate
XGBoost/LightGBM (Phase 2 of the build plan) right away.

## Why not just use PaySim directly?

Checked first: PaySim's 6.36M transactions almost never repeat per account
(max 3 transactions for any single account, 99.85% of accounts appear exactly
once). It was built to simulate one-off mobile-money fraud events across a huge
population, not one borrower's repeated behavior over 6 months — which is
exactly what alternative credit scoring needs. So it isn't usable as-is here.

**What we did keep from it:** its fraud signature — a `TRANSFER` that fully
drains a balance, immediately followed by a `CASH_OUT` that fully drains the
destination — became the template for the `fraud_gaming` persona below
(a synthetic pump-then-drain pattern right before the "application date").

## What we used from the real bKash statement (privacy note)

Only **statistical patterns** were extracted — never the account holder's name,
account number, or actual transaction-level data, none of which appear in any
output file:
- Transaction type vocabulary (Send Money, Cash Out, Cash In, Pay Bill, Payment,
  Mobile Recharge, Loan, Loan Repayment, Bank to bKash, bKash to Bank, Cashback,
  Remittance Received)
- Fee schedule per type (e.g., Send Money ≈ flat 5 BDT above 100 BDT; Cash Out
  ≈ 0.7–1.85%; bKash to Bank ≈ 1.25%; Pay Bill ≈ 0–1%)
- Realistic daily transaction rhythm (3–6 transactions on an active day)

## Files

| File | Contents |
|---|---|
| `generate_synthetic_data.py` | Builds 900 synthetic users across 6 personas |
| `feature_engineering.py` | Converts raw transactions → model-ready features + labels |
| `tamper_detection_demo.py` | Shows the balance-consistency check catching an edited statement |
| `synthetic_transactions.csv` | ~156K raw transactions (user_id, date, type, amounts, fee, balance) |
| `synthetic_user_personas.csv` | User → persona lookup |
| `training_dataset.csv` | **The model-ready file** — one row per user, engineered features, `risk_label`, `tier` |

## Personas (ground truth, for validation)

| Persona | Weight | Behavior |
|---|---|---|
| `stable_shop_owner` | 30% | Regular daily income, consistent bill payment |
| `seasonal_farmer` | 15% | Lumpy income in 2 harvest windows, sparse otherwise |
| `gig_worker` | 15% | Frequent small, variable income |
| `thin_file_new_user` | 15% | Only ~45 days of sparse history — routed to `insufficient_history`, not scored |
| `risky_irregular` | 15% | Erratic swings, near-total balance drains, missed bills |
| `fraud_gaming` | 10% | Quiet history + large pump-then-drain right before the end of the window |

## How labels are assigned

1. **Hard gates first** (not score-based): `thin_file_new_user` / <3 months
   history → `insufficient_history`; failed balance-consistency check or
   detected pump-then-drain pattern → `fraud_flag`.
2. **Everyone else** gets a composite behavioral score (income regularity 35%,
   bill-payment regularity 30%, savings ratio 20%, transaction diversity 15%),
   then tiered by **quantile** against the eligible population (top 25% →
   `low_risk`/Platinum-Gold, next 35% → `medium_risk`/Silver, rest →
   `high_risk`/Bronze) — the same way real bureaus calibrate cutoffs against
   an observed population rather than an arbitrary fixed number.

**Important for your whitepaper/Q&A:** these labels are a reasonable stand-in
for the MVP and validation, but they are behavior-derived, not repayment-derived.
Section 3.7 already flags "Model Accuracy / Drift" as a risk — the real fix,
also already in your whitepaper, is to replace these synthetic labels with
actual repayment outcomes from the Phase-1 pilot once it runs.

## Two real bugs found and fixed while building this (worth knowing)

1. **Unstable sort corrupting balance chains**: `sort_values` defaults to
   quicksort, which isn't stable — same-day transactions were getting
   reordered, breaking the running-balance arithmetic even though the
   underlying data was fine. Fixed by sorting on `(day_index, seq)` with
   `kind="stable"`.
2. **Fee computed before amount-clipping**: when a persona's balance ran low,
   the code capped the transaction amount to the available balance but had
   already computed the fee on the original, larger amount — so amount + fee
   silently exceeded the balance. Fixed with a single `spend()` helper that
   clips first and computes fee on the final amount, used everywhere money
   leaves an account.

Both are exactly the class of bug your own balance-consistency fraud check is
designed to catch on real uploaded statements — so fixing them here also
validated that the checker works correctly.

## Next step (Phase 2 of the build plan)

Load `training_dataset.csv`, drop `insufficient_history` and `fraud_flag` rows
from the *scoring* model's training set (they're handled by separate gates,
not the score itself), and train XGBoost/LightGBM on the remaining features
to predict `risk_label` (low/medium/high). Add SHAP on top for the
explainability layer described in Section 4.1.
