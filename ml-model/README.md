# ML Model

Machine learning service for alternative credit scoring and explainability.

## Stack

- Python
- scikit-learn
- XGBoost or LightGBM
- SHAP

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

The service accepts real statement files through `POST /verify-statement` and `POST /extract-features` as multipart field `statement`. PDF text is extracted with `pypdf`; accepted PDF uploads are no longer mapped to a fixed demo feature payload.
