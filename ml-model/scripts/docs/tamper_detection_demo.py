"""
Demo: Statement Forgery Detection via Balance-Consistency Check
-----------------------------------------------------------------
Takes one genuine synthetic user's statement, tampers with a single
transaction amount (as someone editing a PDF might), and shows the
balance-consistency check (used in Phase 4 / Section 3.1 of the
whitepaper) catching it. Good for the demo video's "fraud defense" segment.
"""
import pandas as pd

tx = pd.read_csv("synthetic_transactions.csv")
uid = tx[tx["persona"] == "stable_shop_owner"]["user_id"].iloc[0]
genuine = tx[tx["user_id"] == uid].sort_values(["day_index", "seq"]).reset_index(drop=True)


def check(df, label):
    running = None
    mismatches = []
    for i, row in df.iterrows():
        if running is None:
            running = row["balance"]
            continue
        expected = round(running + row["amount_in"] - row["amount_out"] - row["fee"], 2)
        if abs(expected - row["balance"]) > 1.0:
            mismatches.append((i, row["type"], expected, row["balance"]))
        running = row["balance"]
    print(f"--- {label} ---")
    print(f"Rows checked: {len(df)} | Mismatches found: {len(mismatches)}")
    for m in mismatches[:5]:
        print(f"  Row {m[0]} ({m[1]}): expected balance {m[2]}, statement shows {m[3]}  <-- TAMPERED")
    print()


check(genuine, "GENUINE STATEMENT")

# Tamper: someone edits one "amount_out" to look smaller/better, without
# recalculating every subsequent balance (exactly what a naive PDF edit does)
tampered = genuine.copy()
edit_idx = tampered[tampered["amount_out"] > 0].index[10]
original_amt = tampered.loc[edit_idx, "amount_out"]
tampered.loc[edit_idx, "amount_out"] = round(original_amt * 0.3, 2)  # made the spend look smaller
print(f"Tampering row {edit_idx}: amount_out changed from {original_amt} to {tampered.loc[edit_idx, 'amount_out']}\n")

check(tampered, "TAMPERED STATEMENT")
