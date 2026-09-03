const express = require("express");
const axios = require("axios");
const {
  scores,
  getUserById,
  saveScore,
  getLatestScoreByUser,
} = require("../data/db");
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

router.get("/me", requireAuth, async (req, res) => {
  try {
    const latestScore = await getLatestScoreByUser(req.user.id);

    if (!latestScore) {
      return res.json({
        userId: req.user.id,
        hasScore: false,
        score: null,
        tier: null,
        factors: {},
        riskLevel: null,
        createdAt: null,
      });
    }

    return res.json({
      userId: req.user.id,
      hasScore: true,
      score: latestScore.raw_score ?? latestScore.score,
      tier: latestScore.tier,
      factors: latestScore.factors,
      riskLevel: latestScore.risk_label ?? latestScore.riskLevel,
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

    if (!user.consentGiven) {
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

    return res.json({
      message: "Score computed successfully.",
      userId,
      score: payload.score,
      rawClassIndex: payload.rawClassIndex,
      scoreScale: payload.scoreScale,
      scoreInterpretation: payload.scoreInterpretation,
      tier: payload.tier,
      factors: payload.factors,
      riskLevel: payload.riskLevel,
      limitations: payload.limitations,
      blockchain: anchor,
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
