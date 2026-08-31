function validateRegister(req, res, next) {
  const { name, phone, role } = req.body || {};

  if (!name || !phone) {
    return res.status(400).json({ message: "name and phone are required." });
  }

  if (!["borrower", "lender", "admin"].includes(role || "borrower")) {
    return res
      .status(400)
      .json({ message: "role must be borrower, lender, or admin." });
  }

  next();
}

function validateLogin(req, res, next) {
  const { phone, otp } = req.body || {};

  if (!phone || !otp) {
    return res.status(400).json({ message: "phone and otp are required." });
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
