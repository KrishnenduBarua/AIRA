function validateRegister(req, res, next) {
  const { phone, fullName, dob, nidNumber, permanentAddress, password } =
    req.body || {};

  if (req.body?.role === "lender") {
    if (!phone || !password) {
      return res.status(400).json({
        message: "Approved lender phone number and password are required.",
      });
    }
    return next();
  }

  if (
    !phone ||
    !fullName ||
    !dob ||
    !nidNumber ||
    !permanentAddress ||
    !password ||
    !req.files ||
    !req.files.nidFront ||
    !req.files.nidBack
  ) {
    return res.status(400).json({
      message:
        "phone, full name, date of birth, NID number, permanent address, password, and both NID files are required.",
    });
  }

  next();
}

function validatePhoneOnly(req, res, next) {
  const { phone, role } = req.body || {};

  if (!phone) {
    return res.status(400).json({ message: "phone is required." });
  }

  if (role && !["borrower", "lender", "admin"].includes(role)) {
    return res
      .status(400)
      .json({ message: "role must be borrower, lender, or admin." });
  }

  next();
}

function validateLogin(req, res, next) {
  const { phone, password } = req.body || {};

  if (!phone || !password) {
    return res
      .status(400)
      .json({ message: "phone and password are required." });
  }

  next();
}

function validateOtp(req, res, next) {
  const { phone, otp } = req.body || {};

  if (!phone || !otp) {
    return res.status(400).json({ message: "phone and otp are required." });
  }

  next();
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const cookies = Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf("=");
        return [
          entry.slice(0, separator).trim(),
          decodeURIComponent(entry.slice(separator + 1).trim()),
        ];
      }),
  );
  const requestedCookie = ["borrower", "lender", "admin"].includes(
    req.query.role,
  )
    ? cookies[`aira_${req.query.role}_session`]
    : null;
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.query.role
      ? requestedCookie
      : cookies.aira_borrower_session ||
        cookies.aira_lender_session ||
        cookies.aira_admin_session;

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

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const cookies = Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf("=");
        return [
          entry.slice(0, separator).trim(),
          decodeURIComponent(entry.slice(separator + 1).trim()),
        ];
      }),
  );
  const requestedCookie = ["borrower", "lender", "admin"].includes(
    req.query.role,
  )
    ? cookies[`aira_${req.query.role}_session`]
    : null;
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.query.role
      ? requestedCookie
      : cookies.aira_borrower_session ||
        cookies.aira_lender_session ||
        cookies.aira_admin_session;

  if (token) {
    try {
      req.user = require("jsonwebtoken").verify(
        token,
        require("../config").jwtSecret,
      );
    } catch (_error) {
      req.user = null;
    }
  }

  next();
}

module.exports = {
  validateRegister,
  validatePhoneOnly,
  validateLogin,
  validateOtp,
  requireAuth,
  optionalAuth,
};
