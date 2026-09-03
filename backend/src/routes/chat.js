const express = require("express");
const { requireAuth } = require("../middlewares/validation");
const {
  getLatestScoreByUser,
  getOrCreateConversation,
  getConversationMessages,
  saveConversationMessage,
  getUserById,
  getUserByPhone,
  getLoanRequestsByLender,
} = require("../data/db");
const { answerQuestion } = require("../services/chatbot");
const { normalizePhone } = require("../services/otp");

const router = express.Router();

async function resolveSubjectUser(req, mode, requestedSubjectId) {
  if (mode === "borrower") {
    return req.user.role === "borrower" ? req.user.id : null;
  }

  if (req.user.role !== "lender" || !requestedSubjectId) return null;
  const subject =
    (await getUserById(requestedSubjectId)) ||
    (await getUserByPhone(normalizePhone(requestedSubjectId)));
  if (!subject || subject.role !== "borrower" || !subject.consentGiven)
    return null;

  const requests = await getLoanRequestsByLender(req.user.id);
  return requests.some((item) => item.borrowerId === subject.id)
    ? subject.id
    : null;
}

async function getChatContext(req, mode, requestedSubjectId) {
  const subjectUserId = await resolveSubjectUser(req, mode, requestedSubjectId);
  if (!subjectUserId) return null;

  const score = await getLatestScoreByUser(subjectUserId);
  const conversation = await getOrCreateConversation({
    userId: req.user.id,
    mode,
    subjectUserId: mode === "lender" ? subjectUserId : null,
    scoreId: score?.id || null,
  });
  const messages = await getConversationMessages(conversation.id);

  return { conversation, messages, score };
}

function scoreInput(score) {
  return {
    score: score?.raw_score ?? score?.score ?? null,
    riskLevel: score?.risk_label ?? score?.riskLevel ?? null,
    tier: score?.tier ?? null,
    factors: score?.factors || {},
  };
}

async function handleChat(mode, req, res) {
  try {
    const body = req.body || {};
    const question =
      typeof body.question === "string" ? body.question.trim() : "";
    if (!question)
      return res.status(400).json({ message: "question is required" });

    const context = await getChatContext(req, mode, body.subjectUserId);
    if (!context)
      return res.status(403).json({ message: "You cannot access this chat." });

    const language = body.language === "en" ? "en" : "bn";
    const result = await answerQuestion(mode, {
      question,
      language,
      ...scoreInput(context.score),
      history: context.messages,
    });
    const userMessage = await saveConversationMessage({
      conversationId: context.conversation.id,
      role: "user",
      content: question,
    });
    const assistantMessage = await saveConversationMessage({
      conversationId: context.conversation.id,
      role: "assistant",
      content: result.answer,
    });

    return res.json({
      mode,
      ...result,
      conversationId: context.conversation.id,
      messages: [...context.messages, userMessage, assistantMessage],
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function handleHistory(mode, req, res) {
  try {
    const context = await getChatContext(req, mode, req.query.subjectUserId);
    if (!context)
      return res.status(403).json({ message: "You cannot access this chat." });
    return res.json({
      conversationId: context.conversation.id,
      hasScore: Boolean(context.score),
      messages: context.messages,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

router.get("/borrower/history", requireAuth, (req, res) =>
  handleHistory("borrower", req, res),
);
router.get("/lender/history", requireAuth, (req, res) =>
  handleHistory("lender", req, res),
);
router.post("/borrower", requireAuth, (req, res) =>
  handleChat("borrower", req, res),
);
router.post("/lender", requireAuth, (req, res) =>
  handleChat("lender", req, res),
);

module.exports = router;
