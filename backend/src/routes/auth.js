const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const {
  users,
  createUser,
  getUserByPhone,
  getUserByNidNumber,
  getUserById,
  getBorrowers,
  deleteUser,
  hasConsent,
  getFraudReviews,
  getFraudReviewById,
  updateFraudReview,
  getLatestScoreByUser,
  getLoanRequestById,
  updateUser,
  saveConsent,
  saveLenderApplication,
  getLenderApplications,
  getLenderApplicationByPhone,
  approveLenderApplication,
  completeLenderApplication,
} = require("../data/db");
const {
  signToken,
  verifyToken,
  hashPassword,
  comparePassword,
} = require("../utils/auth");
const {
  createOtpForPhone,
  normalizePhone,
  verifyOtp,
  isPhoneVerified,
  consumePhoneVerification,
} = require("../services/otp");
const {
  validateRegister,
  validatePhoneOnly,
  validateLogin,
  validateOtp,
  requireAuth,
  optionalAuth,
} = require("../middlewares/validation");

const uploadDir = path.join(__dirname, "..", "uploads", "nid");
fs.mkdirSync(uploadDir, { recursive: true });
const FRAUD_REVIEW_STATUSES = ["pending", "reviewing", "cleared", "confirmed"];

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const cleanName = file.originalname.replace(/\s+/g, "_");
      cb(null, `${Date.now()}-${cleanName}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image files are allowed for NID uploads."));
  },
});

const lenderDocumentUpload = multer({
  storage: upload.storage,
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf"
    ) {
      cb(null, true);
      return;
    }
    cb(new Error("Only images and PDF documents are allowed."));
  },
});

const router = express.Router();

function sessionCookie(role) {
  return `aira_${role}_session`;
}

function setSessionCookie(res, token, role) {
  res.cookie(sessionCookie(role), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 60 * 1000,
    path: "/",
  });
}

function clearSessionCookie(res) {
  ["borrower", "lender", "admin"].forEach((role) =>
    res.clearCookie(sessionCookie(role), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    }),
  );
}

function normalizeNidNumber(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function safeNidPath(user, side) {
  const storedPath = side === "front" ? user?.nidFrontUrl : user?.nidBackUrl;
  if (!storedPath) return null;

  const root = path.resolve(uploadDir);
  const resolved = path.resolve(storedPath);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}

function profilePayload(user, documents) {
  return {
    id: user.id,
    name: user.name,
    email: user.email || null,
    phoneNumber: user.phoneNumber,
    dateOfBirth: user.dateOfBirth || null,
    nidNumber: user.nidNumber || null,
    permanentAddress: user.permanentAddress || null,
    consentGiven: hasConsent(user),
    nidVerified:
      user.nidVerified === true ||
      user.nidVerified === 1 ||
      user.nidVerified === "1" ||
      user.nidVerified === "true",
    createdAt: user.createdAt || null,
    documents,
  };
}

async function requireAdminUser(req, res) {
  const admin = await getUserById(req.user.id);
  if (!admin || admin.role !== "admin") {
    res.status(403).json({ message: "Admin access required." });
    return null;
  }
  return admin;
}

function getPasswordHash(user) {
  return user?.passwordHash || user?.password_hash || null;
}

async function ensureUserFromPhone({ name, phone, role = "borrower" }) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedRole = ["borrower", "lender", "admin"].includes(role)
    ? role
    : "borrower";

  const existingUser = await getUserByPhone(normalizedPhone);
  if (existingUser) {
    return { user: existingUser, phone: normalizedPhone, role: normalizedRole };
  }

  const nextUserId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const newUser = {
    id: nextUserId,
    name: name || "New User",
    email: null,
    phoneNumber: normalizedPhone,
    passwordHash: null,
    role: normalizedRole,
    consentGiven: false,
    nidVerified: false,
    createdAt: new Date().toISOString(),
  };

  await createUser(newUser);
  return { user: newUser, phone: normalizedPhone, role: normalizedRole };
}

router.post("/request-otp", validatePhoneOnly, async (req, res) => {
  const { name, phone, role = "borrower" } = req.body;
  const normalizedPhone = normalizePhone(phone);
  const existingUser = await getUserByPhone(normalizedPhone);

  if (role === "lender") {
    const application = await getLenderApplicationByPhone(normalizedPhone);
    if (!application || application.status !== "approved") {
      return res.status(403).json({
        message: "This phone number has not been approved for lender signup.",
      });
    }
  }

  if (getPasswordHash(existingUser)) {
    return res
      .status(409)
      .json({ message: "This phone number already has an account." });
  }

  const { user } = await ensureUserFromPhone({
    name: name || existingUser?.name || "New User",
    phone: normalizedPhone,
    role,
  });
  const delivery = await createOtpForPhone(normalizedPhone);

  return res.json({
    message: delivery.mocked
      ? "OTP generated in demo mode. Use the returned code to continue."
      : "OTP sent to your phone.",
    otpSent: true,
    otp: delivery.otp || null,
    mode: delivery.mode || "live",
    user: {
      id: user.id,
      name: user.name,
      phone: normalizedPhone,
      role: user.role,
    },
  });
});

router.post("/verify-otp", validateOtp, async (req, res) => {
  const { phone, otp } = req.body;
  const normalizedPhone = normalizePhone(phone);

  if (!verifyOtp(normalizedPhone, otp)) {
    return res.status(401).json({ message: "Invalid or expired OTP." });
  }

  const user = await getUserByPhone(normalizedPhone);
  return res.json({
    message: "OTP verified successfully.",
    phoneVerified: true,
    isPhoneVerified: true,
    verificationToken: signToken({
      purpose: "phone_verification",
      phone: normalizedPhone,
    }),
    user: user
      ? {
          id: user.id,
          name: user.name,
          phone: normalizedPhone,
          role: user.role,
        }
      : null,
  });
});

router.post(
  "/register",
  upload.fields([
    { name: "nidFront", maxCount: 1 },
    { name: "nidBack", maxCount: 1 },
  ]),
  validateRegister,
  async (req, res) => {
    const {
      phone,
      fullName,
      dob,
      nidNumber,
      permanentAddress,
      password,
      verificationToken,
      role = "borrower",
    } = req.body;

    const normalizedPhone = normalizePhone(phone);
    const normalizedNid = normalizeNidNumber(nidNumber);
    let lenderApplication = null;
    if (role === "lender") {
      lenderApplication = await getLenderApplicationByPhone(normalizedPhone);
      if (!lenderApplication || lenderApplication.status !== "approved") {
        return res.status(403).json({
          message: "This phone number has not been approved for lender signup.",
        });
      }
    }
    let existingUser = await getUserByPhone(normalizedPhone);
    let tokenVerified = false;

    if (verificationToken) {
      try {
        const claims = verifyToken(verificationToken);
        tokenVerified =
          claims.purpose === "phone_verification" &&
          claims.phone === normalizedPhone;
      } catch (_error) {
        tokenVerified = false;
      }
    }

    if (!tokenVerified && !isPhoneVerified(normalizedPhone)) {
      return res.status(400).json({
        message:
          "Phone number verification is required before account creation.",
      });
    }

    if (!existingUser) {
      const created = await ensureUserFromPhone({
        name: fullName || "New User",
        phone: normalizedPhone,
        role,
      });
      existingUser = created.user;
    }

    if (getPasswordHash(existingUser)) {
      return res
        .status(409)
        .json({ message: "This phone number already has an account." });
    }

    const duplicateNid = await getUserByNidNumber(normalizedNid);
    if (duplicateNid && duplicateNid.id !== existingUser.id) {
      return res.status(409).json({
        message: "This NID number is already registered with another account.",
      });
    }

    const frontFile = req.files?.nidFront?.[0];
    const backFile = req.files?.nidBack?.[0];

    if (role !== "lender" && (!frontFile || !backFile)) {
      return res.status(400).json({
        message: "Both NID front and back images are required.",
      });
    }

    const passwordHash = hashPassword(password);
    const user = await updateUser(existingUser.id, {
      name:
        role === "lender"
          ? lenderApplication.organizationName || existingUser.name || "Lender"
          : fullName,
      phoneNumber: normalizedPhone,
      email: null,
      dateOfBirth: role === "lender" ? null : dob,
      nidNumber: role === "lender" ? null : normalizedNid,
      permanentAddress: role === "lender" ? null : permanentAddress,
      passwordHash,
      nidFrontUrl: frontFile ? frontFile.path.replace(/\\/g, "/") : null,
      nidBackUrl: backFile ? backFile.path.replace(/\\/g, "/") : null,
      role,
      nidVerified: true,
    });
    if (role === "lender" && lenderApplication) {
      await completeLenderApplication(lenderApplication.id, user.id);
    }
    consumePhoneVerification(normalizedPhone);

    const token = signToken({
      id: user.id,
      phone: normalizedPhone,
      role: user.role,
    });
    clearSessionCookie(res);
    setSessionCookie(res, token, user.role);

    return res.status(201).json({
      message: "Borrower account created successfully.",
      user: {
        id: user.id,
        name: user.name,
        phone: normalizedPhone,
        role: user.role,
        consentGiven: user.consentGiven,
        nidVerified: user.nidVerified,
      },
      token,
    });
  },
);

router.post("/login", validateLogin, async (req, res) => {
  const { phone, password, role: expectedRole } = req.body;
  const normalizedPhone = normalizePhone(phone);
  const user = await getUserByPhone(normalizedPhone);

  const passwordHash = getPasswordHash(user);

  if (!user || !passwordHash) {
    return res
      .status(401)
      .json({ message: "Invalid phone number or password." });
  }

  if (expectedRole && user.role !== expectedRole) {
    return res.status(403).json({
      message: `This account cannot access the ${expectedRole} portal.`,
    });
  }

  if (!comparePassword(password, passwordHash)) {
    return res
      .status(401)
      .json({ message: "Invalid phone number or password." });
  }

  const token = signToken({
    id: user.id,
    phone: normalizedPhone,
    role: user.role,
  });
  clearSessionCookie(res);
  setSessionCookie(res, token, user.role);

  return res.json({
    message: "Login successful.",
    user: {
      id: user.id,
      name: user.name,
      phone: normalizedPhone,
      email: user.email,
      role: user.role,
      consentGiven: user.consentGiven,
      nidVerified: user.nidVerified,
    },
    token,
  });
});

router.get("/session", optionalAuth, async (req, res) => {
  if (!req.user) {
    return res.json({ authenticated: false, user: null });
  }

  const user = await getUserById(req.user.id);
  if (!user)
    return res.status(401).json({ message: "Session user not found." });

  return res.json({
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      phone: normalizePhone(user.phoneNumber),
      email: user.email || null,
      role: user.role,
      consentGiven: user.consentGiven,
      nidVerified: user.nidVerified,
    },
  });
});

router.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  return res.json({ message: "Logged out successfully." });
});

// A borrower can inspect the identity details submitted during signup. The
// password is intentionally never returned, even though it is part of signup.
router.get("/profile", requireAuth, async (req, res) => {
  const user = await getUserById(req.user.id);
  if (!user || user.role !== "borrower") {
    return res.status(404).json({ message: "Borrower profile not found." });
  }

  return res.json({
    profile: profilePayload(user, {
      front: user.nidFrontUrl ? "/auth/profile/nid/front" : null,
      back: user.nidBackUrl ? "/auth/profile/nid/back" : null,
    }),
  });
});

router.get("/profile/nid/:side", requireAuth, async (req, res) => {
  if (!["front", "back"].includes(req.params.side)) {
    return res.status(404).json({ message: "NID document not found." });
  }

  const user = await getUserById(req.user.id);
  const filePath = safeNidPath(user, req.params.side);
  if (!user || user.role !== "borrower" || !filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ message: "NID document not found." });
  }

  return res.sendFile(filePath);
});

// Borrower identity review does not create an approval queue. Admins can open
// the submitted details and documents, and remove the account when something
// is wrong or abusive.
router.get("/admin/borrowers", requireAuth, async (req, res) => {
  if (!(await requireAdminUser(req, res))) return;

  const borrowers = await getBorrowers();
  return res.json({
    borrowers: borrowers.map((user) => ({
      id: user.id,
      name: user.name,
      phoneNumber: user.phoneNumber,
      nidNumber: user.nidNumber || null,
      nidVerified:
        user.nidVerified === true ||
        user.nidVerified === 1 ||
        user.nidVerified === "1" ||
        user.nidVerified === "true",
      consentGiven: hasConsent(user),
      createdAt: user.createdAt || null,
      hasNidFront: Boolean(user.nidFrontUrl),
      hasNidBack: Boolean(user.nidBackUrl),
    })),
  });
});

router.get("/admin/borrowers/:borrowerId/nid/:side", requireAuth, async (req, res) => {
  if (!(await requireAdminUser(req, res))) return;
  if (!["front", "back"].includes(req.params.side)) {
    return res.status(404).json({ message: "NID document not found." });
  }

  const borrower = await getUserById(req.params.borrowerId);
  const filePath = safeNidPath(borrower, req.params.side);
  if (
    !borrower ||
    borrower.role !== "borrower" ||
    !filePath ||
    !fs.existsSync(filePath)
  ) {
    return res.status(404).json({ message: "NID document not found." });
  }

  return res.sendFile(filePath);
});

router.get("/admin/borrowers/:borrowerId", requireAuth, async (req, res) => {
  if (!(await requireAdminUser(req, res))) return;

  const borrower = await getUserById(req.params.borrowerId);
  if (!borrower || borrower.role !== "borrower") {
    return res.status(404).json({ message: "Borrower not found." });
  }

  const borrowerId = encodeURIComponent(borrower.id);
  return res.json({
    borrower: profilePayload(borrower, {
      front: borrower.nidFrontUrl
        ? `/auth/admin/borrowers/${borrowerId}/nid/front`
        : null,
      back: borrower.nidBackUrl
        ? `/auth/admin/borrowers/${borrowerId}/nid/back`
        : null,
    }),
  });
});

router.delete("/admin/borrowers/:borrowerId", requireAuth, async (req, res) => {
  if (!(await requireAdminUser(req, res))) return;

  const borrower = await getUserById(req.params.borrowerId);
  if (!borrower || borrower.role !== "borrower") {
    return res.status(404).json({ message: "Borrower not found." });
  }

  const files = [safeNidPath(borrower, "front"), safeNidPath(borrower, "back")];
  const deleted = await deleteUser(borrower.id);
  if (!deleted) {
    return res.status(404).json({ message: "Borrower not found." });
  }

  files.filter(Boolean).forEach((filePath) => {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (error) {
      console.warn("Could not remove deleted borrower document:", error.message);
    }
  });

  return res.json({ message: "Borrower account deleted successfully." });
});

router.get("/admin/fraud-reviews", requireAuth, async (req, res) => {
  if (!(await requireAdminUser(req, res))) return;
  return res.json({ fraudReviews: await getFraudReviews() });
});

router.get("/admin/fraud-reviews/:reviewId", requireAuth, async (req, res) => {
  if (!(await requireAdminUser(req, res))) return;

  const fraudReview = await getFraudReviewById(req.params.reviewId);
  if (!fraudReview) {
    return res.status(404).json({ message: "Fraud review not found." });
  }

  const borrower = await getUserById(fraudReview.borrowerId);
  const lender = await getUserById(fraudReview.lenderId);
  const loanRequest = await getLoanRequestById(fraudReview.loanRequestId);
  if (!borrower || borrower.role !== "borrower") {
    return res.status(404).json({ message: "Borrower not found." });
  }

  const borrowerId = encodeURIComponent(borrower.id);
  const score = await getLatestScoreByUser(borrower.id);
  return res.json({
    fraudReview: {
      ...fraudReview,
      borrower: profilePayload(borrower, {
        front: borrower.nidFrontUrl
          ? `/auth/admin/borrowers/${borrowerId}/nid/front`
          : null,
        back: borrower.nidBackUrl
          ? `/auth/admin/borrowers/${borrowerId}/nid/back`
          : null,
      }),
      lender: lender
        ? { id: lender.id, name: lender.name, phoneNumber: lender.phoneNumber }
        : null,
      loanRequest,
      score: score
        ? {
            score: score.raw_score ?? score.score,
            riskLevel: score.risk_label ?? score.riskLevel,
            tier: score.tier,
          }
        : null,
    },
  });
});

router.patch("/admin/fraud-reviews/:reviewId", requireAuth, async (req, res) => {
  const admin = await requireAdminUser(req, res);
  if (!admin) return;

  const { status } = req.body || {};
  const adminNotes =
    typeof req.body?.adminNotes === "string"
      ? req.body.adminNotes.trim().slice(0, 2000)
      : "";
  if (!FRAUD_REVIEW_STATUSES.includes(status)) {
    return res.status(400).json({
      message: `status must be one of: ${FRAUD_REVIEW_STATUSES.join(", ")}.`,
    });
  }

  const updated = await updateFraudReview(
    req.params.reviewId,
    status,
    adminNotes,
    admin.id,
  );
  if (!updated) {
    return res.status(404).json({ message: "Fraud review not found." });
  }

  return res.json({
    message: "Fraud review updated successfully.",
    fraudReview: updated,
  });
});

router.post("/dev-test-otp", validatePhoneOnly, async (req, res) => {
  const { name, phone, role = "borrower" } = req.body;
  const normalizedPhone = normalizePhone(phone);

  const { user } = await ensureUserFromPhone({
    name: name || "New User",
    phone: normalizedPhone,
    role,
  });
  const delivery = await createOtpForPhone(normalizedPhone);

  return res.status(200).json({
    message: "Developer OTP generated successfully.",
    otpSent: true,
    otp: delivery.otp,
    mode: delivery.mode || "demo",
    phone: normalizedPhone,
    user: {
      id: user.id,
      name: user.name,
      phone: normalizedPhone,
      role: user.role,
    },
  });
});

router.post("/lender-application", requireAuth, async (req, res) => {
  const {
    organizationName,
    tradeLicenseNumber,
    tinNumber,
    binNumber,
    phoneNumber,
    personalNidNumber,
    documents = {},
  } = req.body || {};

  if (!organizationName || !phoneNumber || !personalNidNumber) {
    return res.status(400).json({
      message:
        "Organization name, phone number, and personal NID are required.",
    });
  }

  const application = await saveLenderApplication({
    id: `lender_app_${Date.now()}`,
    userId: req.user.id,
    organizationName,
    tradeLicenseNumber,
    tinNumber,
    binNumber,
    phoneNumber: normalizePhone(phoneNumber),
    personalNidNumber,
    status: "pending",
    documents,
  });

  return res.status(201).json({
    message: "Lender approval request submitted for admin review.",
    application,
  });
});

router.post(
  "/admin/lender-approvals",
  requireAuth,
  lenderDocumentUpload.fields([
    { name: "tradeLicense", maxCount: 1 },
    { name: "tinCertificate", maxCount: 1 },
    { name: "binCertificate", maxCount: 1 },
    { name: "personalNid", maxCount: 1 },
  ]),
  async (req, res) => {
    const admin = await getUserById(req.user.id);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ message: "Admin access required." });
    }

    const { organizationName, phoneNumber } = req.body || {};
    const normalizedPhone = normalizePhone(phoneNumber);
    const existingUser = await getUserByPhone(normalizedPhone);
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "This phone number already has an account." });
    }

    const existingApplication =
      await getLenderApplicationByPhone(normalizedPhone);
    if (existingApplication) {
      return res
        .status(409)
        .json({ message: "An approval already exists for this phone number." });
    }

    const files = req.files || {};
    const requiredDocuments = [
      "tradeLicense",
      "tinCertificate",
      "binCertificate",
      "personalNid",
    ];
    if (
      !organizationName ||
      !normalizedPhone ||
      requiredDocuments.some((name) => !files[name]?.[0])
    ) {
      return res.status(400).json({
        message:
          "Organization, phone, and all four lender documents are required.",
      });
    }

    const documents = Object.fromEntries(
      requiredDocuments.map((name) => [
        name,
        files[name][0].path.replace(/\\/g, "/"),
      ]),
    );
    const application = await saveLenderApplication({
      id: `lender_app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      organizationName,
      phoneNumber: normalizedPhone,
      personalNidNumber: "uploaded",
      status: "pending",
      documents,
    });

    return res
      .status(201)
      .json({ message: "Lender account approval created.", application });
  },
);

router.get("/lender-applications", requireAuth, async (req, res) => {
  const user = await getUserById(req.user.id);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }

  const applications = await getLenderApplications();
  return res.json({ applications });
});

router.post("/approve-lender", requireAuth, async (req, res) => {
  const user = await getUserById(req.user.id);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }

  const { applicationId } = req.body || {};
  const application = await approveLenderApplication(applicationId, user.id);

  if (!application) {
    return res.status(404).json({ message: "Lender application not found." });
  }

  return res.json({
    message: "Lender application approved.",
    application,
  });
});

router.post("/consent", requireAuth, async (req, res) => {
  const { consentGiven = false } = req.body || {};
  const user = await getUserById(req.user.id);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const updatedUser = await updateUser(user.id, {
    consentGiven: !!consentGiven,
  });
  await saveConsent(user.id, !!consentGiven, "borrower");

  return res.json({
    message: "Consent updated successfully.",
    consentGiven: updatedUser.consentGiven,
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      phone: updatedUser.phoneNumber,
      consentGiven: updatedUser.consentGiven,
    },
  });
});

module.exports = router;
