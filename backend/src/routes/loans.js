const express = require("express");
const fs = require("fs");
const {
  getUserById,
  getLenderDirectory,
  createLoanRequest,
  getOpenLoanRequest,
  getLoanRequestById,
  getLoanRequestsByBorrower,
  getLoanRequestsByLender,
  updateLoanRequestStatus,
  getLatestScoreByUser,
  getStatementsByUser,
  getStatementById,
} = require("../data/db");
const { requireAuth } = require("../middlewares/validation");

const router = express.Router();

const DECISIONS = ["accepted", "declined"];

async function requireRole(req, res, role) {
  const user = await getUserById(req.user.id);
  if (!user || user.role !== role) {
    res.status(403).json({ message: `${role} access required.` });
    return null;
  }
  return user;
}

function normalizeScore(record) {
  if (!record) return null;

  return {
    score: record.raw_score ?? record.score,
    tier: record.tier,
    riskLevel: record.risk_label ?? record.riskLevel,
    factors: record.factors || {},
    createdAt: record.created_at ?? record.createdAt,
  };
}

function normalizeStatement(record) {
  return {
    id: record.id,
    filename: record.filename,
    verified: record.verified,
    uploadedAt: record.uploaded_at ?? record.uploadedAt,
    extractedFeatures: record.extracted_features ?? record.extractedFeatures,
  };
}

// Borrower: the directory of lenders they can apply to, annotated with the
// borrower's own request status so the UI can render per-lender state.
router.get("/lenders", requireAuth, async (req, res) => {
  try {
    const borrower = await requireRole(req, res, "borrower");
    if (!borrower) return;

    const [lenders, myRequests] = await Promise.all([
      getLenderDirectory(),
      getLoanRequestsByBorrower(borrower.id),
    ]);

    const latestByLender = new Map();
    myRequests.forEach((request) => {
      if (!latestByLender.has(request.lenderId)) {
        latestByLender.set(request.lenderId, request);
      }
    });

    return res.json({
      lenders: lenders.map((lender) => {
        const existing = latestByLender.get(lender.id);
        return {
          ...lender,
          requestStatus: existing?.status || null,
          requestedAt: existing?.createdAt || null,
        };
      }),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load the lender directory.",
      details: error.message,
    });
  }
});

// Borrower: send a loan request to a chosen lender.
router.post("/requests", requireAuth, async (req, res) => {
  try {
    const borrower = await requireRole(req, res, "borrower");
    if (!borrower) return;

    const { lenderId } = req.body || {};
    if (!lenderId) {
      return res.status(400).json({ message: "lenderId is required." });
    }

    if (!borrower.consentGiven) {
      return res.status(403).json({
        message: "Grant data consent before sending a loan request.",
      });
    }

    const lender = await getUserById(lenderId);
    if (!lender || lender.role !== "lender") {
      return res.status(404).json({ message: "Lender not found." });
    }

    const existing = await getOpenLoanRequest(borrower.id, lenderId);
    if (existing) {
      return res.status(409).json({
        message: "You already have a pending request with this lender.",
      });
    }

    const request = await createLoanRequest({
      borrowerId: borrower.id,
      lenderId,
    });

    return res.status(201).json({
      message: "Loan request sent to the lender.",
      request,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to send the loan request.",
      details: error.message,
    });
  }
});

// Borrower: their own outgoing requests.
router.get("/requests/mine", requireAuth, async (req, res) => {
  try {
    const borrower = await requireRole(req, res, "borrower");
    if (!borrower) return;

    return res.json({ requests: await getLoanRequestsByBorrower(borrower.id) });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load your loan requests.",
      details: error.message,
    });
  }
});

// Lender: the incoming request inbox.
router.get("/requests", requireAuth, async (req, res) => {
  try {
    const lender = await requireRole(req, res, "lender");
    if (!lender) return;

    const requests = await getLoanRequestsByLender(lender.id);
    return res.json({
      requests,
      pendingCount: requests.filter((item) => item.status === "pending").length,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load loan requests.",
      details: error.message,
    });
  }
});

// Lender: the full borrower profile behind one request — identity details,
// uploaded statements, and the trust score with its factor breakdown.
router.get("/requests/:requestId", requireAuth, async (req, res) => {
  try {
    const lender = await requireRole(req, res, "lender");
    if (!lender) return;

    const request = await getLoanRequestById(req.params.requestId);
    if (!request || request.lenderId !== lender.id) {
      return res.status(404).json({ message: "Loan request not found." });
    }

    const borrower = await getUserById(request.borrowerId);
    if (!borrower) {
      return res.status(404).json({ message: "Borrower not found." });
    }

    if (!borrower.consentGiven) {
      return res.status(403).json({
        message: "This borrower has withdrawn data consent.",
      });
    }

    const [scoreRecord, statementRows] = await Promise.all([
      getLatestScoreByUser(borrower.id),
      getStatementsByUser(borrower.id),
    ]);

    return res.json({
      request,
      borrower: {
        id: borrower.id,
        name: borrower.name,
        phone: borrower.phoneNumber,
        dateOfBirth: borrower.dateOfBirth,
        nidNumber: borrower.nidNumber,
        permanentAddress: borrower.permanentAddress,
        nidVerified: borrower.nidVerified,
        consentGiven: borrower.consentGiven,
        joinedAt: borrower.createdAt,
      },
      score: normalizeScore(scoreRecord),
      statements: statementRows.map(normalizeStatement),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load the borrower profile.",
      details: error.message,
    });
  }
});

// Lender: open the source statement document behind a request.
router.get(
  "/requests/:requestId/statements/:statementId",
  requireAuth,
  async (req, res) => {
    try {
      const lender = await requireRole(req, res, "lender");
      if (!lender) return;

      const request = await getLoanRequestById(req.params.requestId);
      if (!request || request.lenderId !== lender.id) {
        return res.status(404).json({ message: "Loan request not found." });
      }

      const borrower = await getUserById(request.borrowerId);
      if (!borrower?.consentGiven) {
        return res.status(403).json({
          message: "This borrower has withdrawn data consent.",
        });
      }

      const statement = await getStatementById(req.params.statementId);
      const ownerId = statement?.user_id ?? statement?.userId;
      if (!statement || ownerId !== request.borrowerId) {
        return res.status(404).json({ message: "Statement not found." });
      }

      const filePath = statement.file_path ?? statement.path;
      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({
          message: "The stored statement file is no longer available.",
        });
      }

      return res.sendFile(filePath);
    } catch (error) {
      return res.status(500).json({
        message: "Failed to open the statement.",
        details: error.message,
      });
    }
  },
);

// Lender: accept or decline a request.
router.post("/requests/:requestId/decision", requireAuth, async (req, res) => {
  try {
    const lender = await requireRole(req, res, "lender");
    if (!lender) return;

    const { status } = req.body || {};
    if (!DECISIONS.includes(status)) {
      return res
        .status(400)
        .json({ message: `status must be one of: ${DECISIONS.join(", ")}.` });
    }

    const request = await getLoanRequestById(req.params.requestId);
    if (!request || request.lenderId !== lender.id) {
      return res.status(404).json({ message: "Loan request not found." });
    }

    const updated = await updateLoanRequestStatus(request.id, status);
    return res.json({ message: `Loan request ${status}.`, request: updated });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update the loan request.",
      details: error.message,
    });
  }
});

module.exports = router;
