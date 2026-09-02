const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config");

function hashPassword(password) {
  return bcrypt.hashSync(String(password), 10);
}

function comparePassword(password, hash) {
  return bcrypt.compareSync(String(password), String(hash || ""));
}

function signToken(payload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: "30m" });
}

function verifyToken(token) {
  return jwt.verify(token, jwtSecret);
}

module.exports = {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
};
