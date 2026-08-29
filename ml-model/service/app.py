from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
from fastapi import FastAPI, File, UploadFile
from pydantic import BaseModel

app = FastAPI(title='AIRA ML Service', version='1.0.0')

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


@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'aira-ml-service'}


@app.post('/verify-statement')
async def verify_statement(statement: UploadFile = File(...)):
    valid = bool(statement.filename.lower().endswith(('.pdf', '.csv', '.xlsx', '.json')))
    return {
        'valid': valid,
        'details': 'Accepted statement format.' if valid else 'Unsupported file type.',
        'filename': statement.filename,
    }


def derive_features(text: str, file_size: int):
    import re

    dates = re.findall(r'\b\d{2}-[A-Za-z]{3}-\d{2}\b', text)
    amounts = [float(value.replace(',', '')) for value in re.findall(r'(?<![A-Za-z])\d[\d,]*\.\d{2}\b', text)]
    transaction_count = len(dates)
    average_amount = sum(amounts) / len(amounts) if amounts else 0.0
    has_bill_payment = len(re.findall(r'pay bill|payment', text, re.IGNORECASE))
    history_months = max(1, len(set(re.findall(r'\b[A-Za-z]{3}-\d{2}\b', text))))

    return {
        'months_of_history': history_months,
        'n_transactions': transaction_count,
        'income_regularity': round(min(1.0, transaction_count / 30), 4),
        'avg_monthly_income': round(average_amount, 2),
        'savings_ratio': round(min(1.0, max(0.0, 1 - average_amount / max(average_amount * 2, 1))), 4),
        'bill_payment_count': has_bill_payment,
        'bill_payment_regularity': round(min(1.0, has_bill_payment / max(transaction_count, 1)), 4),
        'transaction_diversity': round(min(1.0, len(set(re.findall(r'\b(?:Send Money|Payment|Pay Bill|Cash Out|Cash In)\b', text, re.IGNORECASE))) / 5), 4),
        'spending_to_income_ratio': round(min(1.0, average_amount / max(average_amount * 1.5, 1)), 4),
        'balance_volatility': round(min(1.0, len(amounts) / max(transaction_count * 3, 1)), 4),
        'max_single_txn_pct_balance': 1.0 if amounts else 0.0,
        'circular_transfer_flag': bool(re.search(r'circular|self transfer', text, re.IGNORECASE)),
        'balance_consistency_pass': bool(amounts),
        '_source': 'uploaded_statement',
        '_file_size': file_size,
    }


@app.post('/extract-features')
async def extract_features(statement: UploadFile = File(...)):
    from pypdf import PdfReader
    import io

    content = await statement.read()
    if statement.filename.lower().endswith('.pdf'):
        reader = PdfReader(io.BytesIO(content))
        text = '\n'.join(page.extract_text() or '' for page in reader.pages)
    else:
        text = content.decode('utf-8', errors='ignore')
    return {'filename': statement.filename, 'features': derive_features(text, len(content))}


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
        'score': round(float(predicted_label_index), 2),
        'riskLevel': label,
        'tier': tier_map[label],
        'factors': factor_map,
    }


if __name__ == '__main__':
    import uvicorn

    uvicorn.run('service.app:app', host='0.0.0.0', port=5001, reload=False)
