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

## LLM chatbot endpoints

Both endpoints require a JWT bearer token and accept `question`, `score`, `riskLevel`, `tier`, and `factors` in the JSON body:

- `POST /chat/lender` — lender-facing explanation and decision-support coach
- `POST /chat/borrower` — high-level improvement guidance in Bangla

Only the score context and the approved SHAP factor fields are passed to LangChain. Raw model weights, hidden features, and arbitrary request fields are excluded. Without `LLM_API_KEY` or `OPENAI_API_KEY`, the API uses a local grounded fallback so the flow can be tested offline.

For an OpenAI-compatible provider, configure:

```text
LLM_API_KEY=your-key
LLM_BASE_URL=https://your-provider.example/v1
LLM_MODEL=your-model
```
