const express = require("express");
const {
  getUserById,
  getUserByPhone,
  getLatestScoreByUser,
  getLoanRequestsByLender,
  getFlaggedUsers,
  hasConsent,
} = require("../data/db");
const { requireAuth } = require("../middlewares/validation");
const { normalizePhone } = require("../services/otp");
const { describeFactors } = require("../services/insights");
const { verifyScoreAnchor } = require("../services/blockchain");

const router = express.Router();

router.get("/score/:userId", requireAuth, async (req, res) => {
  const { userId } = req.params;
  const user =
    (await getUserById(userId)) ||
    (await getUserByPhone(normalizePhone(userId)));

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  if (!hasConsent(user)) {
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
    blockchain: {
      status: latestScore.anchor_status || "not_configured",
      scoreHash: latestScore.score_hash || null,
      transactionHash: latestScore.transaction_hash || null,
      explorerUrl: latestScore.transaction_hash
        ? `https://amoy.polygonscan.com/tx/${latestScore.transaction_hash}`
        : null,
    },
  });
});

router.get("/score/:userId/blockchain", requireAuth, async (req, res) => {
  const requestedUser =
    (await getUserById(req.params.userId)) ||
    (await getUserByPhone(normalizePhone(req.params.userId)));
  if (!requestedUser || requestedUser.role !== "borrower") {
    return res.status(404).json({ message: "Borrower not found." });
  }

  const lender = await getUserById(req.user.id);
  if (!lender || lender.role !== "lender") {
    return res.status(403).json({ message: "Lender access required." });
  }
  const requests = await getLoanRequestsByLender(lender.id);
  if (!requests.some((item) => item.borrowerId === requestedUser.id)) {
    return res
      .status(403)
      .json({ message: "This borrower is not your applicant." });
  }

  const score = await getLatestScoreByUser(requestedUser.id);
  if (!score?.score_hash) {
    return res.json({
      status: score?.anchor_status || "not_configured",
      scoreHash: null,
    });
  }
  return res.json(await verifyScoreAnchor(score.score_hash));
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
