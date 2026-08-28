const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config");

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(`${password}:${jwtSecret}`)
    .digest("hex");
}

function signToken(payload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: "7d" });
}

function verifyToken(token) {
  return jwt.verify(token, jwtSecret);
}

module.exports = {
  hashPassword,
  signToken,
  verifyToken,
};
