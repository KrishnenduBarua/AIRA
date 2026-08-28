from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI
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


class StatementVerificationRequest(BaseModel):
    filename: str
    fileSize: int
    mimetype: str


class StatementFeatureRequest(BaseModel):
    filename: str
    fileSize: int
    mimetype: str


@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'aira-ml-service'}


@app.post('/verify-statement')
def verify_statement(payload: StatementVerificationRequest):
    valid = bool(payload.filename.lower().endswith(('.pdf', '.csv', '.xlsx', '.json')))
    return {
        'valid': valid,
        'details': 'Accepted statement format.' if valid else 'Unsupported file type.',
    }


@app.post('/extract-features')
def extract_features(payload: StatementFeatureRequest):
    # Demo feature extraction layer for the MVP.
    # In the real implementation this would parse statements and compute features.
    feature_map = {
        'months_of_history': 6,
        'n_transactions': 145,
        'income_regularity': 0.82,
        'avg_monthly_income': 18500,
        'savings_ratio': 0.31,
        'bill_payment_count': 12,
        'bill_payment_regularity': 0.77,
        'transaction_diversity': 0.68,
        'spending_to_income_ratio': 0.63,
        'balance_volatility': 0.41,
        'max_single_txn_pct_balance': 0.9,
        'circular_transfer_flag': False,
        'balance_consistency_pass': True,
    }
    return {'features': feature_map}


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

    factor_map = {
        'income_regularity': float(input_df['income_regularity'].iloc[0]),
        'savings_ratio': float(input_df['savings_ratio'].iloc[0]),
        'bill_payment_regularity': float(input_df['bill_payment_regularity'].iloc[0]),
        'transaction_diversity': float(input_df['transaction_diversity'].iloc[0]),
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
