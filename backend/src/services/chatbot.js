const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { ChatOpenAI } = require("@langchain/openai");
const { llmApiKey, llmBaseUrl, llmModel } = require("../config");

const FACTOR_KEYS = [
  "months_of_history",
  "n_transactions",
  "income_regularity",
  "avg_monthly_income",
  "savings_ratio",
  "bill_payment_count",
  "bill_payment_regularity",
  "transaction_diversity",
  "spending_to_income_ratio",
  "balance_volatility",
  "max_single_txn_pct_balance",
  "circular_transfer_flag",
  "balance_consistency_pass",
];

const lenderPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are AIRA Lender Coach. Answer only from the supplied score, risk level, tier, and SHAP factors. Never infer, invent, or discuss raw model weights, hidden features, protected attributes, or information not supplied. Explain uncertainty clearly. Do not recommend automatic approval or rejection; provide decision support only. Continue the conversation naturally using previous messages when relevant.\n\nScore context:\n{context}\n\nPrevious conversation:\n{history}",
  ],
  ["human", "Lender question: {question}"],
]);

const borrowerPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are AIRA Borrower Coach. Reply only in Bangla. Use only the supplied score, risk level, tier, and SHAP factors. Give high-level, practical, non-exploitable improvement tips. Never reveal model weights, thresholds, formulas, hidden features, security details, or advice to manipulate transactions. Do not promise approval. Continue the conversation naturally using previous messages when relevant.\n\nScore context:\n{context}\n\nPrevious conversation:\n{history}",
  ],
  ["human", "Borrower question: {question}"],
]);

function sanitizeFactors(factors = {}) {
  if (!factors || typeof factors !== "object") return {};

  return FACTOR_KEYS.reduce((result, key) => {
    const value = Number(factors[key]);
    if (Number.isFinite(value)) result[key] = value;
    return result;
  }, {});
}

function buildContext({ score, riskLevel, tier, factors }) {
  const numericScore = Number(score);

  return JSON.stringify({
    score: Number.isFinite(numericScore) ? numericScore : null,
    riskLevel: typeof riskLevel === "string" ? riskLevel : null,
    tier: typeof tier === "string" ? tier : null,
    shapFactors: sanitizeFactors(factors),
  });
}

function safeParseContext(context) {
  if (!context) return { shapFactors: {} };

  try {
    const parsed = JSON.parse(context);
    return parsed && typeof parsed === "object" ? parsed : { shapFactors: {} };
  } catch (_error) {
    return { shapFactors: {} };
  }
}

function sanitizeHistory(history = []) {
  if (!Array.isArray(history)) return [];

  return history
    .filter(
      (message) =>
        message &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string",
    )
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 4000),
    }))
    .filter((message) => message.content);
}

function fallbackReply(mode, context) {
  const parsed = safeParseContext(context);
  const factors =
    parsed.shapFactors && typeof parsed.shapFactors === "object"
      ? parsed.shapFactors
      : {};
  const strongest = Object.entries(factors).sort(
    (a, b) => Number(b[1]) - Number(a[1]),
  )[0];

  if (mode === "borrower") {
    return strongest
      ? `আপনার স্কোরের প্রদত্ত কারণগুলোর মধ্যে ${strongest[0]} তুলনামূলকভাবে ভালো দেখা যাচ্ছে। নিয়মিত আয়-ব্যয়ের রেকর্ড রাখুন, সময়মতো বিল পরিশোধ করুন এবং স্থিতিশীল সঞ্চয়ের অভ্যাস বজায় রাখুন।`
      : "নিয়মিত আয়-ব্যয়ের রেকর্ড রাখুন, সময়মতো বিল পরিশোধ করুন এবং স্থিতিশীল সঞ্চয়ের অভ্যাস বজায় রাখুন।";
  }

  return strongest
    ? `The supplied SHAP factors indicate that ${strongest[0]} is relatively stronger (${strongest[1]}). Use this as directional context only; the score should not be treated as an automatic approval or rejection decision.`
    : "No usable SHAP factors were supplied, so a reliable explanation is not available. Use the score only as decision-support context.";
}

async function answerQuestion(mode, input) {
  const context = buildContext(input);
  const history = JSON.stringify(sanitizeHistory(input?.history));
  const question =
    typeof input?.question === "string" ? input.question.trim() : "";
  if (!question) throw new Error("question is required");

  if (!llmApiKey) {
    return {
      answer: fallbackReply(mode, context),
      provider: "local-fallback",
      groundedContext: safeParseContext(context),
    };
  }

  const modelConfig = {
    apiKey: llmApiKey,
    model: llmModel,
    ...(llmBaseUrl ? { configuration: { baseURL: llmBaseUrl } } : {}),
  };

  if (!/gpt-5/i.test(llmModel)) {
    modelConfig.temperature = 0.2;
  }

  const model = new ChatOpenAI(modelConfig);
  const prompt = mode === "borrower" ? borrowerPrompt : lenderPrompt;

  try {
    const response = await prompt.pipe(model).invoke({
      context,
      history,
      question,
    });
    const answer =
      typeof response?.content === "string"
        ? response.content
        : Array.isArray(response?.content)
          ? response.content
              .map((part) => {
                if (typeof part === "string") return part;
                if (part && typeof part.text === "string") return part.text;
                return "";
              })
              .join(" ")
              .trim()
          : String(response?.content ?? "");

    return {
      answer: answer || fallbackReply(mode, context),
      provider: "openai",
      groundedContext: safeParseContext(context),
      model: llmModel,
    };
  } catch (error) {
    return {
      answer: fallbackReply(mode, context),
      provider: "openai-fallback",
      groundedContext: safeParseContext(context),
      model: llmModel,
      warning: error.message,
    };
  }
}

module.exports = { answerQuestion, sanitizeFactors };
