const express = require("express");
const {
  getUserById,
  getUserByPhone,
  getLatestScoreByUser,
  getFlaggedUsers,
} = require("../data/db");
const { requireAuth } = require("../middlewares/validation");
const { normalizePhone } = require("../services/otp");
const { describeFactors } = require("../services/insights");

const router = express.Router();

router.get("/score/:userId", requireAuth, async (req, res) => {
  const { userId } = req.params;
  const user =
    (await getUserById(userId)) ||
    (await getUserByPhone(normalizePhone(userId)));

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  if (user.consent_given !== true && user.consentGiven !== true) {
    return res
      .status(403)
      .json({ message: "Consent is required before sharing a lender score." });
  }

  const latestScore = await getLatestScoreByUser(user.id);

  if (!latestScore) {
    return res
      .status(404)
      .json({ message: "No score record found for this user." });
  }

  return res.json({
    userId: user.id,
    score: latestScore.raw_score ?? latestScore.score,
    tier: latestScore.tier,
    factors: latestScore.factors,
    // Plain-language, ordered version of the same factors, so the lender UI
    // does not have to interpret raw feature column names.
    describedFactors: describeFactors(latestScore.factors),
    riskLevel: latestScore.risk_label ?? latestScore.riskLevel,
    createdAt: latestScore.created_at ?? latestScore.createdAt,
  });
});

router.get("/admin/flagged", requireAuth, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required." });
    }

    const flaggedUsers = await getFlaggedUsers();
    return res.json({ flaggedUsers });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load flagged users.",
      details: error.message,
    });
  }
});

module.exports = router;
