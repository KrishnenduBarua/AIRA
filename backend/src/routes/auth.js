const express = require("express");
const {
  users,
  createUser,
  getUserByEmail,
  getUserById,
  updateUser,
  saveConsent,
} = require("../data/db");
const { hashPassword, signToken } = require("../utils/auth");
const {
  validateRegister,
  validateLogin,
  requireAuth,
} = require("../middlewares/validation");

const router = express.Router();

router.post("/register", validateRegister, async (req, res) => {
  const { name, email, password, role = "borrower" } = req.body;

  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    return res.status(409).json({ message: "User already exists." });
  }

  const nextUserId = `user_${String(users.length + 1).padStart(3, "0")}`;
  const user = {
    id: nextUserId,
    name,
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    role,
    consentGiven: false,
    nidVerified: false,
    createdAt: new Date().toISOString(),
  };

  await createUser(user);

  const token = signToken({ id: user.id, email: user.email, role: user.role });

  res.status(201).json({
    message: "User registered successfully.",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      consentGiven: user.consentGiven,
      nidVerified: user.nidVerified,
    },
    token,
  });
});

router.post("/login", validateLogin, async (req, res) => {
  const { email, password } = req.body;

  const user = await getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const hashedInput = hashPassword(password);
  if (user.passwordHash !== hashedInput) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });

  res.json({
    message: "Login successful.",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      consentGiven: user.consentGiven,
      nidVerified: user.nidVerified,
    },
    token,
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
      consentGiven: updatedUser.consentGiven,
    },
  });
});

module.exports = router;
