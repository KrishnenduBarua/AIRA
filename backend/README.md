# Backend

Express.js API layer for consent, statement verification, scoring orchestration, and lender access.

## Stack

- Node.js
- Express
- PostgreSQL
- JWT auth

## Scripts

```bash
npm install
npm run dev
```

## Real statement upload

`POST /statements/upload` requires multipart form data, not a JSON filename. In Postman, choose `Body` -> `form-data`, create a field named `statement`, change its type to `File`, and select the PDF from the repository `pdf/` folder. The ML service receives the actual file bytes, extracts PDF text, and derives features from the statement.

PowerShell alternative:

```powershell
$pdf = "C:\Krish Project\aira\pdf\Customer-App-Statement-fac363e3-98ce-11f1-986d-3da0f7d27034-2026-08-15-23-30-23 (2).pdf"
curl.exe -X POST -H "Authorization: Bearer $token" -F "statement=@$pdf;type=application/pdf" http://127.0.0.1:4000/statements/upload
```

## LLM chatbot endpoints

Both endpoints require a JWT bearer token and accept `question`, `score`, `riskLevel`, `tier`, and `factors` in the JSON body:

- `POST /chat/lender` — lender-facing explanation and decision-support coach
- `POST /chat/borrower` — high-level improvement guidance in Bangla

Only the score context and the approved SHAP factor fields are passed to LangChain. Raw model weights, hidden features, and arbitrary request fields are excluded. Without `LLM_API_KEY` or `OPENAI_API_KEY`, the API uses a local grounded fallback so the flow can be tested offline.

For an OpenAI-compatible provider, configure:

```text
LLM_API_KEY=your-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-5.6-luna
```
