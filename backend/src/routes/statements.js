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

const router = express.Router();

// Uploaded statements are retained so a lender reviewing a loan request can
// open the source document behind a borrower's score.
const statementDir = path.join(__dirname, "..", "uploads", "statements");
fs.mkdirSync(statementDir, { recursive: true });
const upload = multer({ dest: statementDir });

function isSupportedStatement(filename) {
  return /\.(pdf|csv)$/i.test(filename || "");
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

router.post(
  "/upload",
  requireAuth,
  upload.single("statement"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ message: "A statement file is required." });
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

      const verificationForm = new FormData();
      verificationForm.append("statement", fileBuffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });
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

      const featuresForm = new FormData();
      featuresForm.append("statement", fileBuffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });
      const featuresResponse = await axios.post(
        `${mlServiceUrl}/extract-features`,
        featuresForm,
        { headers: featuresForm.getHeaders() },
      );

      const storedName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, "_")}`;
      const storedPath = path.join(statementDir, storedName);
      fs.renameSync(filePath, storedPath);

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

      return res.status(201).json({
        message: "Statement uploaded and validated successfully.",
        statement: {
          id: statementRecord.id,
          userId: statementRecord.userId,
          verified: statementRecord.verified,
          extractedFeatures: statementRecord.extractedFeatures,
        },
      });
    } catch (error) {
      console.error("Statement upload error:", error.message);
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(500).json({
        message: "Failed to process statement upload.",
        details: error.response?.data || error.message,
      });
    }
  },
);

module.exports = router;
