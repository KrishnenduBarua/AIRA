const express = require("express");
const axios = require("axios");
const { scores, getUserById, saveScore } = require("../data/db");
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
      tier: payload.tier,
      riskLevel: payload.riskLevel,
      factors: payload.factors || {},
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
      tier: payload.tier,
      factors: payload.factors,
      riskLevel: payload.riskLevel,
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
