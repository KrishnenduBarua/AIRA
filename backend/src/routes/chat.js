const express = require("express");
const { requireAuth } = require("../middlewares/validation");
const { answerQuestion } = require("../services/chatbot");

const router = express.Router();

function createChatHandler(mode) {
  return async (req, res) => {
    try {
      const { question, score, riskLevel, tier, factors } = req.body || {};
      const result = await answerQuestion(mode, {
        question,
        score,
        riskLevel,
        tier,
        factors,
      });
      return res.json({ mode, ...result });
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  };
}

router.post("/lender", requireAuth, createChatHandler("lender"));
router.post("/borrower", requireAuth, createChatHandler("borrower"));

module.exports = router;
