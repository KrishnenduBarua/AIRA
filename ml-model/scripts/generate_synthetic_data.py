"""
CredBridge / AIRA - Synthetic Training Data Generator
------------------------------------------------------
Builds realistic 6-month bKash-style transaction histories for N synthetic
users across 6 behavioral personas, so the credit-scoring model has
something meaningful to learn from.

Calibration sources (statistics only - no raw PII used or stored):
  1. A real bKash statement (Feb-Aug 2026, ~140 transactions) was manually
     reviewed to extract:
       - transaction type vocabulary (Send Money, Cash Out, Cash In, Pay Bill,
         Payment, Mobile Recharge, Loan, Loan Repayment, Bank to bKash,
         bKash to Bank, Cashback, Remittance Received)
       - fee schedule per type (see FEE_RULES below)
       - realistic daily transaction frequency (3-6 tx/day on active days)
  2. PaySim (6.36M rows) was checked and found unsuitable for per-user
     6-month timelines (99.85% of accounts appear only once). It IS reused
     for its fraud signature: a TRANSFER that fully drains a balance,
     immediately followed by a CASH_OUT that fully drains the destination -
     this is used as the template for the "gaming/fraud" persona below.
"""

import numpy as np
import pandas as pd
import uuid
from datetime import datetime, timedelta

RNG = np.random.default_rng(42)
N_USERS = 900
WINDOW_DAYS = 180  # 6-month trailing window required by the scoring engine
START_DATE = datetime(2026, 2, 15)

# ---- Fee schedule calibrated from the real bKash statement ----
FEE_RULES = {
    "Send Money": lambda amt: 5.0 if amt >= 100 else 0.0,
    "Cash Out": lambda amt: round(amt * RNG.uniform(0.007, 0.0185), 2),
    "Pay Bill": lambda amt: round(amt * RNG.choice([0.0, 0.01]), 2),
    "Payment": lambda amt: 0.0,
    "Mobile Recharge": lambda amt: 0.0,
    "Cash In": lambda amt: 0.0,
    "Bank to bKash": lambda amt: 0.0,
    "bKash to Bank": lambda amt: round(amt * 0.0125, 2),
    "Loan": lambda amt: round(amt * RNG.uniform(0.003, 0.006), 2),
    "Loan Repayment": lambda amt: 0.0,
    "Cashback": lambda amt: 0.0,
    "Remittance Received": lambda amt: 0.0,
}

PERSONAS = [
    "stable_shop_owner", "seasonal_farmer", "gig_worker",
    "thin_file_new_user", "risky_irregular", "fraud_gaming",
]
PERSONA_WEIGHTS = [0.30, 0.15, 0.15, 0.15, 0.15, 0.10]


def gen_counterparty():
    return "01" + "".join(RNG.choice(list("0123456789"), 8))


def spend(balance, desired_amt, fee_fn):
    """Single source of truth for any outgoing transaction: never lets
    amount+fee exceed the available balance, and computes the fee on the
    FINAL (possibly clipped) amount so amount + fee + resulting balance
    always reconcile exactly - this is what the balance-consistency
    fraud check (Phase 4) verifies against on real uploaded statements."""
    if balance <= 0:
        return 0.0, 0.0, balance
    amt = min(desired_amt, balance)
    fee = fee_fn(amt)
    if amt + fee > balance:
        # shrink amount to make room for its own fee, recompute fee once more
        amt = max(balance - fee, 0.0)
        fee = fee_fn(amt) if amt > 0 else 0.0
        if amt + fee > balance:  # fee_fn can be non-monotonic; final safety clamp
            fee = balance - amt
    new_balance = round(balance - amt - fee, 2)
    return round(amt, 2), round(fee, 2), max(new_balance, 0.0)


def daily_activity_days(persona):
    """Which of the 180 days this user is active on, per persona shape."""
    days = np.arange(WINDOW_DAYS)
    if persona == "stable_shop_owner":
        return days[RNG.random(WINDOW_DAYS) < 0.55]
    if persona == "seasonal_farmer":
        # two harvest bursts, sparse otherwise
        mask = np.zeros(WINDOW_DAYS, dtype=bool)
        for center in RNG.choice(WINDOW_DAYS, 2, replace=False):
            lo, hi = max(0, center - 10), min(WINDOW_DAYS, center + 10)
            mask[lo:hi] = RNG.random(hi - lo) < 0.6
        mask |= RNG.random(WINDOW_DAYS) < 0.05
        return days[mask]
    if persona == "gig_worker":
        return days[RNG.random(WINDOW_DAYS) < 0.7]
    if persona == "thin_file_new_user":
        # only last 45 days have any history at all
        recent = days[days > WINDOW_DAYS - 45]
        return recent[RNG.random(len(recent)) < 0.4]
    if persona == "risky_irregular":
        return days[RNG.random(WINDOW_DAYS) < 0.35]
    if persona == "fraud_gaming":
        # mostly quiet, then a burst right before the end (application date)
        mask = RNG.random(WINDOW_DAYS) < 0.1
        mask[-14:] = RNG.random(14) < 0.8
        return days[mask]
    return days


def build_user_transactions(user_id, persona):
    rows = []
    balance = float(RNG.uniform(200, 3000))
    active_days = daily_activity_days(persona)
    monthly_income_target = {
        "stable_shop_owner": RNG.uniform(15000, 35000),
        "seasonal_farmer": RNG.uniform(10000, 40000),
        "gig_worker": RNG.uniform(12000, 28000),
        "thin_file_new_user": RNG.uniform(8000, 20000),
        "risky_irregular": RNG.uniform(8000, 30000),
        "fraud_gaming": RNG.uniform(10000, 20000),
    }[persona]

    last_bill_day = -30
    bill_gap = {
        "stable_shop_owner": 30, "seasonal_farmer": 32, "gig_worker": 30,
        "thin_file_new_user": 30, "risky_irregular": 45, "fraud_gaming": 60,
    }[persona]

    for day in active_days:
        date = START_DATE + timedelta(days=int(day))
        n_tx_today = RNG.integers(1, 5) if persona != "thin_file_new_user" else RNG.integers(1, 3)

        for _ in range(n_tx_today):
            # income-side events
            income_roll = RNG.random()
            if persona == "seasonal_farmer" and income_roll < 0.5:
                amt = monthly_income_target * RNG.uniform(0.4, 1.2)
                ttype = RNG.choice(["Cash In", "Remittance Received"])
            elif income_roll < 0.20:
                amt = (monthly_income_target / 25) * RNG.uniform(0.5, 1.5)
                ttype = RNG.choice(["Cash In", "Payment", "Remittance Received"], p=[0.7, 0.2, 0.1])
            else:
                ttype = RNG.choice(
                    ["Send Money", "Cash Out", "Pay Bill", "Mobile Recharge", "Payment"],
                    p=[0.45, 0.20, 0.10, 0.10, 0.15],
                )
                if ttype == "Pay Bill":
                    amt = RNG.uniform(300, 2000)
                elif ttype == "Mobile Recharge":
                    amt = RNG.choice([20, 30, 50, 100])
                else:
                    amt = RNG.uniform(20, min(balance * 0.8, 6000) + 20)

            # inject persona-specific pathology
            if persona == "risky_irregular" and RNG.random() < 0.15:
                amt = balance * RNG.uniform(0.85, 1.0)  # near-total drain
                ttype = "Cash Out"

            is_income = ttype in ("Cash In", "Remittance Received")
            fee_fn = FEE_RULES.get(ttype, lambda a: 0.0)

            if is_income:
                fee = 0.0
                balance = round(balance + amt, 2)
            else:
                amt, fee, balance = spend(balance, amt, fee_fn)

            rows.append({
                "user_id": user_id, "persona": persona,
                "date": date.strftime("%Y-%m-%d"), "day_index": int(day),
                "type": ttype, "counterparty": gen_counterparty(),
                "amount_out": round(amt, 2) if not is_income else 0.0,
                "amount_in": round(amt, 2) if is_income else 0.0,
                "fee": round(fee, 2), "balance": round(balance, 2),
            })

        # bill payment cadence (skip for fraud_gaming - a known red flag)
        if persona != "fraud_gaming" and day - last_bill_day >= bill_gap and RNG.random() < 0.8 and balance > 0:
            desired = RNG.uniform(400, 1500)
            amt, fee, balance = spend(balance, desired, FEE_RULES["Pay Bill"])
            rows.append({
                "user_id": user_id, "persona": persona,
                "date": date.strftime("%Y-%m-%d"), "day_index": int(day),
                "type": "Pay Bill", "counterparty": "Bangladesh Power Development Board",
                "amount_out": round(amt, 2), "amount_in": 0.0,
                "fee": round(fee, 2), "balance": round(balance, 2),
            })
            last_bill_day = day

    # ---- fraud_gaming: inject a PaySim-style full-drain circular chain ----
    if persona == "fraud_gaming":
        cp = gen_counterparty()
        pump = balance * RNG.uniform(3, 6) + 5000
        d1 = START_DATE + timedelta(days=WINDOW_DAYS - 3)
        balance += pump
        rows.append({"user_id": user_id, "persona": persona, "date": d1.strftime("%Y-%m-%d"),
                      "day_index": WINDOW_DAYS - 3, "type": "Cash In", "counterparty": cp,
                      "amount_out": 0.0, "amount_in": round(pump, 2), "fee": 0.0,
                      "balance": round(balance, 2)})
        drain_fee = 5.0 if balance >= 100 else 0.0
        drain_amt = round(balance - drain_fee, 2)
        balance = 0.0
        rows.append({"user_id": user_id, "persona": persona, "date": d1.strftime("%Y-%m-%d"),
                      "day_index": WINDOW_DAYS - 3, "type": "Send Money", "counterparty": cp,
                      "amount_out": drain_amt, "amount_in": 0.0, "fee": drain_fee,
                      "balance": 0.0})

    df = pd.DataFrame(rows)
    df["seq"] = np.arange(len(df))  # preserves true chronological order within a day
    return df.sort_values(["day_index", "seq"], kind="stable").reset_index(drop=True)


def main():
    all_tx = []
    user_meta = []
    personas = RNG.choice(PERSONAS, N_USERS, p=PERSONA_WEIGHTS)
    for i, persona in enumerate(personas):
        uid = f"U{i:04d}_{uuid.uuid4().hex[:6]}"
        tx = build_user_transactions(uid, persona)
        all_tx.append(tx)
        user_meta.append({"user_id": uid, "persona": persona, "n_transactions": len(tx)})

    tx_df = pd.concat(all_tx, ignore_index=True)
    meta_df = pd.DataFrame(user_meta)
    tx_df.to_csv("synthetic_transactions.csv", index=False)
    meta_df.to_csv("synthetic_user_personas.csv", index=False)
    print(f"Generated {len(tx_df)} transactions for {len(meta_df)} synthetic users.")
    print(meta_df["persona"].value_counts())


if __name__ == "__main__":
    main()
