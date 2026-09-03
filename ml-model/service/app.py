from __future__ import annotations

import io
import re
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

app = FastAPI(title='AIRA ML Service', version='1.0.0')

MODEL_LIMITATIONS = [
    'This model is trained on synthetic transaction patterns, not real repayment outcomes.',
    'The statement parser is a practical extraction layer and may misclassify edge-case PDF rows or uncommon transaction labels.',
    'The returned display score is a risk-band score for product UX, not a calibrated consumer credit bureau score.',
    'Final underwriting decisions should use a regulator-reviewed model with longitudinal repayment data.',
]

MODEL_PATH = Path(__file__).resolve().parent.parent / 'artifacts' / 'xgboost.joblib'
FEATURE_COLUMNS = [
    'months_of_history',
    'n_transactions',
    'income_regularity',
    'avg_monthly_income',
    'savings_ratio',
    'bill_payment_count',
    'bill_payment_regularity',
    'transaction_diversity',
    'spending_to_income_ratio',
    'balance_volatility',
    'max_single_txn_pct_balance',
    'circular_transfer_flag',
    'balance_consistency_pass',
]

MODEL = joblib.load(MODEL_PATH) if MODEL_PATH.exists() else None


class PredictionRequest(BaseModel):
    userId: str
    features: dict


# --------------------------------------------------------------- pdf unlock

# bKash and Nagad e-statements are delivered as password-protected PDFs whose
# password is the account holder's own mobile number. Borrowers copy that
# number in many shapes (+880…, 880…, 017…, with dashes or spaces), so every
# plausible normalisation is tried before the file is called locked.
def password_candidates(password):
    raw = (password or '').strip()
    digits = re.sub(r'\D', '', raw)
    candidates = [raw, digits]

    if len(digits) >= 10:
        last_ten = digits[-10:]
        candidates.extend([last_ten, '0' + last_ten, '88' + '0' + last_ten, '+880' + last_ten])
    if len(digits) >= 11:
        candidates.append(digits[-11:])

    seen = set()
    ordered = []
    for candidate in candidates:
        if candidate and candidate not in seen:
            seen.add(candidate)
            ordered.append(candidate)
    return ordered


class StatementError(Exception):
    """A borrower-fixable problem with an uploaded statement."""

    def __init__(self, code, message, status_code=422):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code

    def as_http(self):
        return HTTPException(
            status_code=self.status_code,
            detail={'code': self.code, 'message': self.message},
        )


def open_pdf(content, password=None):
    """Return a decrypted PdfReader, or raise a StatementError the UI can act on."""
    from pypdf import PdfReader
    from pypdf.errors import DependencyError, PdfReadError

    try:
        reader = PdfReader(io.BytesIO(content))
    except PdfReadError as error:
        raise StatementError(
            'unreadable_pdf',
            f'This PDF could not be opened: {error}',
        ) from error

    if not reader.is_encrypted:
        return reader

    # Some statements are only owner-locked: the empty user password opens them
    # and the borrower never needs to be asked for anything.
    try:
        if reader.decrypt(''):
            return reader
    except DependencyError as error:
        raise StatementError(
            'decryption_unavailable',
            'This server cannot open AES-protected PDFs. Install the '
            '`cryptography` package alongside pypdf.',
            status_code=500,
        ) from error
    except (NotImplementedError, PdfReadError):
        pass

    if not (password or '').strip():
        raise StatementError(
            'password_required',
            'This statement is password protected. bKash and Nagad lock the PDF '
            'with the mobile number the account belongs to.',
        )

    for candidate in password_candidates(password):
        try:
            if reader.decrypt(candidate):
                return reader
        except DependencyError as error:
            # The `cryptography` package is missing, so AES-protected PDFs
            # cannot be opened at all. That is a deployment fault, not a wrong
            # password, and must not be reported to the borrower as one.
            raise StatementError(
                'decryption_unavailable',
                'This server cannot open AES-protected PDFs. Install the '
                '`cryptography` package alongside pypdf.',
                status_code=500,
            ) from error
        except (NotImplementedError, PdfReadError):
            # An encryption scheme pypdf cannot handle: no candidate will work.
            break

    raise StatementError(
        'password_incorrect',
        'That password did not unlock the statement. Use the full mobile number '
        'the bKash or Nagad account is registered with, for example 01XXXXXXXXX.',
    )


def pdf_text(content, password=None):
    reader = open_pdf(content, password)
    try:
        text = '\n'.join(page.extract_text() or '' for page in reader.pages)
    except Exception as error:  # noqa: BLE001 - surfaced to the borrower as guidance
        raise StatementError(
            'unreadable_pdf',
            f'The statement pages could not be read: {error}',
        ) from error

    if not text.strip():
        raise StatementError(
            'no_text_layer',
            'No readable text was found in this PDF. A scanned or photographed '
            'statement cannot be parsed - please download the original PDF from '
            'your bKash or Nagad app.',
        )
    return text


@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'aira-ml-service'}


@app.post('/verify-statement')
async def verify_statement(
    statement: UploadFile = File(...),
    password: str = Form(default=''),
):
    valid = bool(statement.filename.lower().endswith(('.pdf', '.csv', '.xlsx', '.json')))
    if not valid:
        return {
            'valid': False,
            'details': 'Unsupported file type.',
            'filename': statement.filename,
        }

    # A locked PDF is caught here rather than at extraction, so the borrower is
    # asked for the password before the file is stored anywhere.
    if statement.filename.lower().endswith('.pdf'):
        content = await statement.read()
        await statement.seek(0)
        try:
            open_pdf(content, password)
        except StatementError as error:
            raise error.as_http() from error

    return {
        'valid': True,
        'details': 'Accepted statement format.',
        'filename': statement.filename,
    }


TRANSACTION_TYPES = (
    'Send Money', 'Cash Out', 'Cash In', 'Pay Bill', 'Payment',
    'Mobile Recharge', 'Loan Repayment', 'Loan', 'Bank to bKash',
    'bKash to Bank', 'Cashback', 'Remittance Received',
)
INCOME_TYPES = {'Cash In', 'Loan', 'Cashback', 'Remittance Received', 'Bank to bKash'}


def _amounts(value):
    return [float(item.replace(',', '')) for item in re.findall(r'\d[\d,]*\.\d{2}', value)]


def parse_bkash_text(text):
    date_pattern = r'\d{2}-[A-Za-z]{3}-\d{2}'
    type_pattern = '|'.join(re.escape(item) for item in sorted(TRANSACTION_TYPES, key=len, reverse=True))
    marker = re.compile(rf'(?P<type>{type_pattern})(?P<amount>\s*[\d,]+\.\d{{2}})?\s*(?P<date>{date_pattern})', re.IGNORECASE)
    lines = text.splitlines()
    transactions = []

    for index, line in enumerate(lines):
        match = marker.search(line)
        if not match:
            continue
        transaction_type = next(
            item for item in TRANSACTION_TYPES
            if item.lower() == match.group('type').lower()
        )
        amount_values = _amounts(match.group('amount') or '')
        amount = amount_values[0] if amount_values else 0.0
        context = '\n'.join(lines[index:min(index + 8, len(lines))])
        context_amounts = _amounts(context)
        balance = None

        # In bKash PDFs, amount is normally beside the type; for rows where
        # it is omitted, the final numeric value in the row is the amount.
        if not amount and len(context_amounts) >= 2:
            amount = context_amounts[-1]
            balance = context_amounts[-2]
        elif amount and len(context_amounts) >= 2:
            balance = context_amounts[-2]
        if not amount:
            continue

        transactions.append({
            'date': match.group('date'),
            'type': transaction_type,
            'amount': amount,
            'income': transaction_type in INCOME_TYPES,
            'context': context,
            'balance': balance,
        })
    return transactions


def parse_csv(content):
    frame = pd.read_csv(io.BytesIO(content))
    columns = {str(column).strip().lower(): column for column in frame.columns}
    date_column = next((columns[key] for key in ('date', 'date & time', 'datetime', 'timestamp') if key in columns), None)
    type_column = next((columns[key] for key in ('type', 'transaction type', 'transaction_type', 'category') if key in columns), None)
    if not date_column or not type_column:
        raise ValueError('CSV must contain date and transaction type columns.')
    in_column = next((columns[key] for key in ('amount_in', 'amount in', 'credit', 'income', 'in') if key in columns), None)
    out_column = next((columns[key] for key in ('amount_out', 'amount out', 'debit', 'expense', 'out') if key in columns), None)
    amount_column = next((columns[key] for key in ('amount', 'value') if key in columns), None)
    transactions = []
    for _, row in frame.iterrows():
        transaction_type = str(row[type_column]).strip()
        incoming = float(row[in_column]) if in_column and pd.notna(row[in_column]) else 0.0
        outgoing = float(row[out_column]) if out_column and pd.notna(row[out_column]) else 0.0
        if amount_column and not incoming and not outgoing and pd.notna(row[amount_column]):
            value = float(row[amount_column])
            incoming = value if transaction_type in INCOME_TYPES else 0.0
            outgoing = 0.0 if transaction_type in INCOME_TYPES else value
        transactions.append({'date': str(row[date_column]), 'type': transaction_type,
                             'amount': incoming or outgoing, 'income': incoming > 0 or transaction_type in INCOME_TYPES,
                             'amount_in': incoming, 'amount_out': outgoing})
    return transactions


def derive_features(text: str, file_size: int, transactions=None):
    transactions = transactions or parse_bkash_text(text)
    if not transactions:
        raise ValueError('No transaction rows could be extracted from this statement.')

    frame = pd.DataFrame(transactions)
    frame['date'] = pd.to_datetime(frame['date'], errors='coerce')
    frame = frame.dropna(subset=['date']).copy()
    frame['amount_in'] = frame.get('amount_in', pd.Series(0.0, index=frame.index)).fillna(0.0)
    frame['amount_out'] = frame.get('amount_out', pd.Series(0.0, index=frame.index)).fillna(0.0)
    frame.loc[frame['income'] & (frame['amount_in'] == 0), 'amount_in'] = frame['amount']
    frame.loc[~frame['income'] & (frame['amount_out'] == 0), 'amount_out'] = frame['amount']
    frame['month'] = frame['date'].dt.to_period('M')
    monthly_income = frame.groupby('month')['amount_in'].sum()
    total_in = frame['amount_in'].sum()
    total_out = frame['amount_out'].sum()
    income_cv = monthly_income.std() / monthly_income.mean() if monthly_income.mean() > 0 and len(monthly_income) > 1 else 1.0
    bills = frame[frame['type'].str.lower().eq('pay bill')]
    bill_gaps = bills['date'].sort_values().diff().dt.days.dropna()
    bill_cv = bill_gaps.std() / bill_gaps.mean() if len(bill_gaps) and bill_gaps.mean() > 0 else 1.0
    type_count = frame['type'].nunique()
    probabilities = frame['type'].value_counts(normalize=True)
    entropy = float(-(probabilities * np.log2(probabilities)).sum())
    balance_values = pd.to_numeric(frame.get('balance', pd.Series(dtype=float)), errors='coerce').dropna()
    balance_volatility = float(balance_values.std() / (balance_values.mean() + 1e-6)) if len(balance_values) > 1 else 0.0

    return {
        'months_of_history': max(1, int(frame['month'].nunique())),
        'n_transactions': int(len(frame)),
        'income_regularity': round(max(0.0, 1 - min(float(income_cv), 1.0)), 3),
        'avg_monthly_income': round(float(monthly_income.mean()) if len(monthly_income) else 0.0, 2),
        'savings_ratio': round(float((total_in - total_out) / total_in) if total_in else 0.0, 3),
        'bill_payment_count': int(len(bills)),
        'bill_payment_regularity': round(max(0.0, 1 - min(float(bill_cv), 1.0)), 3) if len(bills) >= 2 else 0.0,
        'transaction_diversity': float(round(entropy / np.log2(type_count), 3)) if type_count > 1 else 0.0,
        'spending_to_income_ratio': round(float(total_out / total_in), 3) if total_in else 0.0,
        'balance_volatility': round(min(balance_volatility, 10.0), 3),
        'max_single_txn_pct_balance': round(float(frame['amount'].max() / (balance_values.mean() + 1e-6)), 2) if len(balance_values) else 0.0,
        'circular_transfer_flag': bool(re.search(r'circular|self transfer', text, re.IGNORECASE)),
        'balance_consistency_pass': True,
        '_source': 'uploaded_statement',
        '_file_size': file_size,
        '_extracted_transaction_count': int(len(frame)),
    }


@app.post('/extract-features')
async def extract_features(
    statement: UploadFile = File(...),
    password: str = Form(default=''),
):
    content = await statement.read()
    try:
        if statement.filename.lower().endswith('.pdf'):
            text = pdf_text(content, password)
            features = derive_features(text, len(content))
        elif statement.filename.lower().endswith('.csv'):
            text = content.decode('utf-8', errors='ignore')
            features = derive_features(text, len(content), parse_csv(content))
        else:
            raise StatementError(
                'unsupported_type',
                'Only PDF and CSV statement extraction is currently supported.',
            )
    except StatementError as error:
        raise error.as_http() from error
    except ValueError as error:
        # derive_features and parse_csv report unparseable statements this way.
        raise HTTPException(
            status_code=422,
            detail={'code': 'no_transactions', 'message': str(error)},
        ) from error

    return {'filename': statement.filename, 'features': features}


def risk_to_display_score(label: str) -> int:
    band_map = {
        'low_risk': 78,
        'medium_risk': 55,
        'high_risk': 30,
    }
    return band_map.get(label, 50)


@app.post('/predict')
def predict(payload: PredictionRequest):
    if MODEL is None:
        raise RuntimeError('Model artifact not found. Train the model first.')

    input_df = pd.DataFrame([payload.features])
    missing = [col for col in FEATURE_COLUMNS if col not in input_df.columns]
    if missing:
        raise ValueError(f'Missing features for prediction: {missing}')

    input_df = input_df[FEATURE_COLUMNS]
    predicted_label_index = MODEL.predict(input_df)[0]
    label_map = {0: 'low_risk', 1: 'medium_risk', 2: 'high_risk'}
    label = label_map[int(predicted_label_index)]
    display_score = risk_to_display_score(label)

    explainer = shap.TreeExplainer(MODEL)
    shap_values = explainer.shap_values(input_df)
    if isinstance(shap_values, list):
        contributions = np.asarray(shap_values[int(predicted_label_index)])[0]
    else:
        shap_array = np.asarray(shap_values)
        contributions = (
            shap_array[0, :, int(predicted_label_index)]
            if shap_array.ndim == 3
            else shap_array[0]
        )
    factor_map = {
        column: round(float(value), 6)
        for column, value in zip(FEATURE_COLUMNS, contributions)
    }

    tier_map = {
        'low_risk': 'Platinum/Gold',
        'medium_risk': 'Silver',
        'high_risk': 'Bronze',
    }

    return {
        'userId': payload.userId,
        'rawClassIndex': int(predicted_label_index),
        'score': display_score,
        'scoreScale': '0-100 product score',
        'scoreInterpretation': {
            'low_risk': 'Good risk profile',
            'medium_risk': 'Moderate risk profile',
            'high_risk': 'Higher risk profile',
        }[label],
        'riskLevel': label,
        'tier': tier_map[label],
        'factors': factor_map,
        'limitations': MODEL_LIMITATIONS,
    }


if __name__ == '__main__':
    import uvicorn

    uvicorn.run('service.app:app', host='0.0.0.0', port=5001, reload=False)
