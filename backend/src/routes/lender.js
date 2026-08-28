const express = require("express");
const { getUserById, getLatestScoreByUser } = require("../data/db");
const { requireAuth } = require("../middlewares/validation");

const router = express.Router();

router.get("/score/:userId", requireAuth, async (req, res) => {
  const { userId } = req.params;
  const user = await getUserById(userId);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  if (user.consentGiven !== true) {
    return res
      .status(403)
      .json({ message: "Consent is required before sharing a lender score." });
  }

  const latestScore = await getLatestScoreByUser(userId);

  if (!latestScore) {
    return res
      .status(404)
      .json({ message: "No score record found for this user." });
  }

  return res.json({
    userId,
    score: latestScore.raw_score ?? latestScore.score,
    tier: latestScore.tier,
    factors: latestScore.factors,
    riskLevel: latestScore.risk_label ?? latestScore.riskLevel,
    createdAt: latestScore.created_at ?? latestScore.createdAt,
  });
});

module.exports = router;
