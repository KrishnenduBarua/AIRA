const express = require("express");
const axios = require("axios");
const {
  scores,
  getUserById,
  saveScore,
  getLatestScoreByUser,
  getStatementsByUser,
  hasConsent,
} = require("../data/db");
const {
  buildCategorySummaries,
  historyAdequacy,
} = require("../services/insights");
const { requireAuth } = require("../middlewares/validation");
const { mlServiceUrl } = require("../config");
const { anchorScore } = require("../services/blockchain");

const router = express.Router();

const FEATURE_COLUMNS = [
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

function validateFeaturePayload(features = {}) {
  const missing = FEATURE_COLUMNS.filter((col) => !(col in features));
  if (missing.length) {
    return {
      valid: false,
      message: `Missing required feature fields: ${missing.join(", ")}`,
    };
  }

  return { valid: true };
}

// Borrowers see a trust tier and plain-language category summaries. The raw
// score, risk label, and SHAP factors are deliberately withheld here — those
// belong to the lender view (/lender/score/:userId) only.
const TIER_LEVELS = {
  Bronze: 1,
  Silver: 2,
  "Platinum/Gold": 3,
};

function borrowerTier(record) {
  const tier = record?.tier || null;
  return {
    tier,
    tierLevel: TIER_LEVELS[tier] || 1,
    tierSteps: 3,
  };
}

router.get("/me", requireAuth, async (req, res) => {
  try {
    const [latestScore, statementRows] = await Promise.all([
      getLatestScoreByUser(req.user.id),
      getStatementsByUser(req.user.id).catch(() => []),
    ]);

    const features =
      statementRows
        .map((row) => row.extracted_features ?? row.extractedFeatures)
        .find((item) => item && Object.keys(item).length) || {};
    const hasStatement = Boolean(statementRows.length);

    if (!latestScore) {
      return res.json({
        userId: req.user.id,
        hasScore: false,
        hasStatement,
        tier: null,
        tierLevel: 0,
        tierSteps: 3,
        categories: hasStatement ? buildCategorySummaries(features) : [],
        history: historyAdequacy(features),
        createdAt: null,
      });
    }

    return res.json({
      userId: req.user.id,
      hasScore: true,
      hasStatement,
      ...borrowerTier(latestScore),
      categories: buildCategorySummaries(features),
      history: historyAdequacy(features),
      createdAt: latestScore.created_at ?? latestScore.createdAt,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load score profile.",
      details: error.message,
    });
  }
});

router.post("/compute", requireAuth, async (req, res) => {
  try {
    const { userId, userAddress, features } = req.body || {};

    if (!userId || !features) {
      return res
        .status(400)
        .json({ message: "userId and features are required." });
    }

    const validation = validateFeaturePayload(features);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!hasConsent(user)) {
      return res.status(403).json({
        message: "User consent is required before score computation.",
      });
    }

    const mlResponse = await axios.post(`${mlServiceUrl}/predict`, {
      userId,
      features,
    });

    const payload = mlResponse.data;
    const scoreRecord = {
      id: `score_${Date.now()}`,
      userId,
      score: payload.score,
      rawClassIndex: payload.rawClassIndex,
      scoreScale: payload.scoreScale,
      scoreInterpretation: payload.scoreInterpretation,
      tier: payload.tier,
      riskLevel: payload.riskLevel,
      factors: payload.factors || {},
      limitations: payload.limitations || [],
      createdAt: new Date().toISOString(),
    };

    await saveScore(scoreRecord);
    scores.push(scoreRecord);

    const anchor = await anchorScore({
      score: scoreRecord.score,
      riskLevel: scoreRecord.riskLevel,
      tier: scoreRecord.tier,
      factors: scoreRecord.factors,
      userId: scoreRecord.userId,
      userAddress,
      timestamp: scoreRecord.createdAt,
    });

    // Borrower-facing response: tier and behavioural categories only. The raw
    // score, risk label, and SHAP factors stay server-side and are released
    // to lenders through /lender/score/:userId and the loan-request detail.
    return res.json({
      message: "Score computed successfully.",
      userId,
      hasScore: true,
      hasStatement: true,
      ...borrowerTier(scoreRecord),
      categories: buildCategorySummaries(features),
      history: historyAdequacy(features),
      limitations: payload.limitations,
      blockchain: anchor,
      createdAt: scoreRecord.createdAt,
    });
  } catch (error) {
    console.error("Compute score error:", error.message);
    return res.status(500).json({
      message: "Failed to compute score.",
      details: error.response?.data || error.message,
    });
  }
});

module.exports = router;
