function validateRegister(req, res, next) {
  const { name, email, password, role } = req.body || {};

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: "name, email, and password are required." });
  }

  if (!["borrower", "lender"].includes(role || "borrower")) {
    return res
      .status(400)
      .json({ message: "role must be borrower or lender." });
  }

  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "email and password are required." });
  }

  next();
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const decoded = require("jsonwebtoken").verify(
      token,
      require("../config").jwtSecret,
    );
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

module.exports = {
  validateRegister,
  validateLogin,
  requireAuth,
};
