const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const {
  statements,
  saveStatement,
  getStatementsByUser,
} = require("../data/db");
const { requireAuth } = require("../middlewares/validation");
const { mlServiceUrl } = require("../config");
const { historyAdequacy } = require("../services/insights");
const {
  isStorageConfigured,
  objectPath,
  uploadFile,
} = require("../services/storage");

const router = express.Router();

// Kept modest so a borrower on a slow mobile connection is told the file is
// too large before spending their data allowance uploading it.
const MAX_STATEMENT_BYTES = 10 * 1024 * 1024;

// Uploaded statements are retained so a lender reviewing a loan request can
// open the source document behind a borrower's score.
const statementDir = path.join(__dirname, "..", "uploads", "statements");
fs.mkdirSync(statementDir, { recursive: true });
const upload = multer({
  dest: statementDir,
  limits: { fileSize: MAX_STATEMENT_BYTES },
});

// Surfaces multer's own errors (notably the size limit) as actionable JSON
// instead of a generic 500.
function handleUpload(req, res, next) {
  upload.single("statement")(req, res, (error) => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: "This statement file is too large.",
        details: `Please upload a file of ${MAX_STATEMENT_BYTES / (1024 * 1024)} MB or less.`,
      });
    }
    return res.status(400).json({
      message: "The statement file could not be read.",
      details: error.message,
    });
  });
}

function isSupportedStatement(filename) {
  return /\.(pdf|csv)$/i.test(filename || "");
}

// bKash and Nagad e-statements are password-protected PDFs. The password is
// only ever held in memory for the length of this request: it unlocks the file
// for parsing and is never written to disk, to the database, or to a log.
function statementForm(fileBuffer, file, password) {
  const form = new FormData();
  form.append("statement", fileBuffer, {
    filename: file.originalname,
    contentType: file.mimetype,
  });
  if (password) form.append("password", password);
  return form;
}

// The ML service reports borrower-fixable problems as
// { detail: { code, message } }. Those need to reach the borrower as guidance
// they can act on, not as a generic 500.
const STATEMENT_ERROR_MESSAGES = {
  password_required: "This statement is locked with a password.",
  password_incorrect: "That statement password did not work.",
  no_text_layer: "This statement could not be read.",
  unreadable_pdf: "This statement could not be opened.",
  no_transactions: "No transactions could be read from this statement.",
  unsupported_type: "Unsupported statement file type.",
};

function statementErrorResponse(error) {
  const detail = error?.response?.data?.detail;
  if (!detail || typeof detail !== "object" || !detail.code) return null;
  return {
    status: error.response.status === 400 ? 400 : 422,
    body: {
      code: detail.code,
      message:
        STATEMENT_ERROR_MESSAGES[detail.code] ||
        "This statement could not be processed.",
      details: detail.message,
    },
  };
}

router.get("/mine", requireAuth, async (req, res) => {
  try {
    const rows = await getStatementsByUser(req.user.id);
    return res.json({ statements: rows });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to load statements.", details: error.message });
  }
});

router.post("/upload", requireAuth, handleUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "A statement file is required." });
    }

    if (!isSupportedStatement(req.file.originalname)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        message: "Unsupported statement file type.",
        details: "Please upload a PDF or CSV transaction statement.",
      });
    }

    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);
    const password =
      typeof req.body?.password === "string" ? req.body.password.trim() : "";

    const verificationForm = statementForm(fileBuffer, req.file, password);
    const verificationResponse = await axios.post(
      `${mlServiceUrl}/verify-statement`,
      verificationForm,
      { headers: verificationForm.getHeaders() },
    );

    if (!verificationResponse.data.valid) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        message: "Statement verification failed.",
        details:
          verificationResponse.data.details ||
          "File rejected by validation layer.",
      });
    }

    const featuresForm = statementForm(fileBuffer, req.file, password);
    const featuresResponse = await axios.post(
      `${mlServiceUrl}/extract-features`,
      featuresForm,
      { headers: featuresForm.getHeaders() },
    );

    const storedPath = isStorageConfigured()
      ? await uploadFile(
          filePath,
          objectPath(`statements/${req.user.id}`, req.file.originalname),
          req.file.mimetype,
        )
      : (() => {
          const storedName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, "_")}`;
          const localPath = path.join(statementDir, storedName);
          fs.renameSync(filePath, localPath);
          return localPath;
        })();

    if (isStorageConfigured() && fs.existsSync(filePath))
      fs.unlinkSync(filePath);

    const statementRecord = {
      id: `statement_${Date.now()}`,
      userId: req.user.id,
      filename: req.file.originalname,
      path: storedPath,
      mimeType: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
      verified: verificationResponse.data.valid,
      extractedFeatures: featuresResponse.data.features || {},
    };

    await saveStatement(statementRecord);
    statements.push(statementRecord);

    const history = historyAdequacy(statementRecord.extractedFeatures);

    return res.status(201).json({
      message: "Statement uploaded and validated successfully.",
      statement: {
        id: statementRecord.id,
        userId: statementRecord.userId,
        filename: statementRecord.filename,
        uploadedAt: statementRecord.uploadedAt,
        verified: statementRecord.verified,
        extractedFeatures: statementRecord.extractedFeatures,
      },
      history,
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    const known = statementErrorResponse(error);
    if (known) {
      return res.status(known.status).json(known.body);
    }

    console.error("Statement upload error:", error.message);
    return res.status(500).json({
      message: "Failed to process statement upload.",
      details: error.response?.data || error.message,
    });
  }
});

module.exports = router;
