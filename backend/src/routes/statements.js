const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const { statements, saveStatement } = require("../data/db");
const { requireAuth } = require("../middlewares/validation");
const { mlServiceUrl } = require("../config");

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, "..", "uploads") });

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

      const statementRecord = {
        id: `statement_${Date.now()}`,
        userId: req.user.id,
        filename: req.file.originalname,
        path: filePath,
        uploadedAt: new Date().toISOString(),
        verified: verificationResponse.data.valid,
        extractedFeatures: featuresResponse.data.features || {},
      };

      await saveStatement(statementRecord);
      statements.push(statementRecord);
      fs.unlinkSync(filePath);

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
      return res.status(500).json({
        message: "Failed to process statement upload.",
        details: error.response?.data || error.message,
      });
    }
  },
);

module.exports = router;
