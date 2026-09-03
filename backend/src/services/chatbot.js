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
    "You are AIRA Borrower Coach. Reply in {language}. Use only the supplied score, risk level, tier, and SHAP factors. Give high-level, practical, non-exploitable improvement tips in simple everyday wording a reader with limited financial literacy can follow. Never reveal the numeric score, risk label, model weights, thresholds, formulas, hidden features, security details, or advice to manipulate transactions. Do not promise approval. Continue the conversation naturally using previous messages when relevant.\n\nScore context:\n{context}\n\nPrevious conversation:\n{history}",
  ],
  ["human", "Borrower question: {question}"],
]);

const LANGUAGE_NAMES = { bn: "Bangla", en: "English" };

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

// Borrower fallbacks stay generic on purpose: naming a SHAP feature would leak
// model internals into the borrower-facing surface.
const BORROWER_FALLBACK = {
  Bangla:
    "এই মুহূর্তে বিস্তারিত ব্যাখ্যা তৈরি করা যাচ্ছে না। সাধারণ পরামর্শ: নিয়মিত আয়-ব্যয়ের রেকর্ড রাখুন, সময়মতো বিল পরিশোধ করুন, এবং প্রতি মাসে অল্প হলেও সঞ্চয় করার অভ্যাস রাখুন।",
  English:
    "A detailed explanation is not available right now. General guidance: keep a steady record of money coming in and going out, pay your bills on time, and try to save a little every month. The longer your transaction history, the stronger your profile becomes.",
};

function fallbackReply(mode, context, language = "Bangla") {
  const parsed = safeParseContext(context);
  const factors =
    parsed.shapFactors && typeof parsed.shapFactors === "object"
      ? parsed.shapFactors
      : {};
  const strongest = Object.entries(factors).sort(
    (a, b) => Number(b[1]) - Number(a[1]),
  )[0];

  if (mode === "borrower") {
    return BORROWER_FALLBACK[language] || BORROWER_FALLBACK.Bangla;
  }

  return strongest
    ? `The supplied SHAP factors indicate that ${strongest[0]} is relatively stronger (${strongest[1]}). Use this as directional context only; the score should not be treated as an automatic approval or rejection decision.`
    : "No usable SHAP factors were supplied, so a reliable explanation is not available. Use the score only as decision-support context.";
}

// Tells the UI what the answer actually rests on, so a borrower or lender can
// see whether they are reading evidence or generic guidance.
function groundingSource(input) {
  const factors = sanitizeFactors(input?.factors);
  if (Object.keys(factors).length) return "score_factors";
  if (Number.isFinite(Number(input?.score)) || input?.tier)
    return "applicant_records";
  return "general_guidance";
}

async function answerQuestion(mode, input) {
  const context = buildContext(input);
  const language = LANGUAGE_NAMES[input?.language] || LANGUAGE_NAMES.bn;
  const grounding = groundingSource(input);
  const history = JSON.stringify(sanitizeHistory(input?.history));
  const question =
    typeof input?.question === "string" ? input.question.trim() : "";
  if (!question) throw new Error("question is required");

  if (!llmApiKey) {
    return {
      answer: fallbackReply(mode, context, language),
      provider: "local-fallback",
      grounding,
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
      ...(mode === "borrower" ? { language } : {}),
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
      answer: answer || fallbackReply(mode, context, language),
      provider: "openai",
      grounding,
      groundedContext: safeParseContext(context),
      model: llmModel,
    };
  } catch (error) {
    return {
      answer: fallbackReply(mode, context, language),
      provider: "openai-fallback",
      grounding,
      groundedContext: safeParseContext(context),
      model: llmModel,
      warning: error.message,
    };
  }
}

module.exports = { answerQuestion, sanitizeFactors };
