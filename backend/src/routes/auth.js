const express = require("express");
const {
  users,
  createUser,
  getUserByPhone,
  getUserById,
  updateUser,
  saveConsent,
} = require("../data/db");
const { signToken } = require("../utils/auth");
const {
  createOtpForPhone,
  normalizePhone,
  verifyOtp,
} = require("../services/otp");
const {
  validateRegister,
  validateLogin,
  requireAuth,
} = require("../middlewares/validation");

const router = express.Router();

async function ensureUserFromPhone({ name, phone, role = "borrower" }) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedRole = ["borrower", "lender", "admin"].includes(role)
    ? role
    : "borrower";

  const existingUser = await getUserByPhone(normalizedPhone);
  if (existingUser) {
    return {
      user: existingUser,
      phone: normalizedPhone,
      role: normalizedRole,
    };
  }

  const nextUserId = `user_${String(users.length + 1).padStart(3, "0")}`;
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

router.post("/register", validateRegister, async (req, res) => {
  const { name, phone, role = "borrower" } = req.body;
  const normalizedPhone = normalizePhone(phone);

  const { user } = await ensureUserFromPhone({
    name,
    phone: normalizedPhone,
    role,
  });
  await createOtpForPhone(normalizedPhone);

  return res.status(201).json({
    message: "OTP sent to your phone. Please verify the code to continue.",
    otpSent: true,
    user: {
      id: user.id,
      name: user.name,
      phone: normalizedPhone,
      role: user.role,
      consentGiven: user.consentGiven,
      nidVerified: user.nidVerified,
    },
  });
});

router.post("/login", validateLogin, async (req, res) => {
  const { phone, otp, name, role = "borrower" } = req.body;
  const normalizedPhone = normalizePhone(phone);

  const { user } = await ensureUserFromPhone({
    name,
    phone: normalizedPhone,
    role,
  });

  if (!verifyOtp(normalizedPhone, otp)) {
    return res.status(401).json({ message: "Invalid or expired OTP." });
  }

  const token = signToken({
    id: user.id,
    phone: normalizedPhone,
    role: user.role,
  });

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

router.post("/request-otp", validateRegister, async (req, res) => {
  const { name, phone, role = "borrower" } = req.body;
  const normalizedPhone = normalizePhone(phone);

  const { user } = await ensureUserFromPhone({
    name,
    phone: normalizedPhone,
    role,
  });
  await createOtpForPhone(normalizedPhone);

  return res.json({
    message: "OTP sent to your phone.",
    otpSent: true,
    user: {
      id: user.id,
      name: user.name,
      phone: normalizedPhone,
      role: user.role,
    },
  });
});

router.post("/verify-otp", validateLogin, async (req, res) => {
  const { phone, otp, name, role = "borrower" } = req.body;
  const normalizedPhone = normalizePhone(phone);

  const { user } = await ensureUserFromPhone({
    name,
    phone: normalizedPhone,
    role,
  });

  if (!verifyOtp(normalizedPhone, otp)) {
    return res.status(401).json({ message: "Invalid or expired OTP." });
  }

  const token = signToken({
    id: user.id,
    phone: normalizedPhone,
    role: user.role,
  });

  return res.json({
    message: "OTP verified successfully.",
    token,
    user: {
      id: user.id,
      name: user.name,
      phone: normalizedPhone,
      email: user.email,
      role: user.role,
      consentGiven: user.consentGiven,
      nidVerified: user.nidVerified,
    },
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
