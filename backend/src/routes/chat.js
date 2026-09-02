const express = require("express");
const { requireAuth } = require("../middlewares/validation");
const { getLatestScoreByUser } = require("../data/db");
const { answerQuestion } = require("../services/chatbot");

const router = express.Router();

async function resolvePayload(req) {
  const body = req.body || {};
  const latestScore = req.user?.id
    ? await getLatestScoreByUser(req.user.id)
    : null;

  return {
    question: typeof body.question === "string" ? body.question.trim() : "",
    score: body.score ?? latestScore?.raw_score ?? latestScore?.score ?? null,
    riskLevel:
      body.riskLevel ??
      latestScore?.risk_label ??
      latestScore?.riskLevel ??
      null,
    tier: body.tier ?? latestScore?.tier ?? null,
    factors: body.factors ?? latestScore?.factors ?? {},
  };
}

function createChatHandler(mode) {
  return async (req, res) => {
    try {
      const payload = await resolvePayload(req);
      const result = await answerQuestion(mode, payload);
      return res.json({ mode, ...result });
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  };
}

router.post("/lender", requireAuth, createChatHandler("lender"));
router.post("/borrower", requireAuth, createChatHandler("borrower"));

module.exports = router;
