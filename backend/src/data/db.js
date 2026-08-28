const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { databaseUrl, useInMemoryDb } = require("../config");

const users = [
  {
    id: "user_001",
    name: "Demo Borrower",
    email: "borrower@example.com",
    passwordHash: "demo-password",
    role: "borrower",
    consentGiven: true,
    nidVerified: true,
    createdAt: new Date().toISOString(),
  },
];

const statements = [];
const scores = [];
const consentRecords = [];

const pool =
  databaseUrl && !useInMemoryDb
    ? new Pool({ connectionString: databaseUrl })
    : null;

async function initDatabase() {
  if (!pool) {
    return { mode: "memory" };
  }

  const schemaSql = fs.readFileSync(
    path.join(__dirname, "..", "..", "sql", "schema.sql"),
    "utf-8",
  );

  await pool.query(schemaSql);
  return { mode: "postgres" };
}

async function createUser(user) {
  if (pool) {
    const result = await pool.query(
      `
        INSERT INTO users (id, name, email, password_hash, role, consent_given, nid_verified, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *
      `,
      [
        user.id,
        user.name,
        user.email,
        user.passwordHash,
        user.role,
        user.consentGiven,
        user.nidVerified,
      ],
    );
    return result.rows[0];
  }

  users.push(user);
  return user;
}

async function getUserByEmail(email) {
  if (pool) {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1 LIMIT 1",
      [email.toLowerCase()],
    );
    return result.rows[0] || null;
  }

  return (
    users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ||
    null
  );
}

async function getUserById(userId) {
  if (pool) {
    const result = await pool.query(
      "SELECT * FROM users WHERE id = $1 LIMIT 1",
      [userId],
    );
    return result.rows[0] || null;
  }

  return users.find((user) => user.id === userId) || null;
}

async function updateUser(userId, updates) {
  if (pool) {
    const keys = Object.keys(updates);
    if (!keys.length) return getUserById(userId);

    const setClause = keys
      .map((key, index) => `${snakeCase(key)} = $${index + 2}`)
      .join(", ");

    const values = [userId, ...keys.map((key) => updates[key])];
    const result = await pool.query(
      `UPDATE users SET ${setClause} WHERE id = $1 RETURNING *`,
      values,
    );
    return result.rows[0] || null;
  }

  const userIndex = users.findIndex((user) => user.id === userId);
  if (userIndex === -1) return null;

  users[userIndex] = { ...users[userIndex], ...updates };
  return users[userIndex];
}

async function saveStatement(record) {
  if (pool) {
    const result = await pool.query(
      `
        INSERT INTO statements (id, user_id, filename, file_path, uploaded_at, verified, extracted_features)
        VALUES ($1, $2, $3, $4, NOW(), $5, $6)
        RETURNING *
      `,
      [
        record.id,
        record.userId,
        record.filename,
        record.path,
        record.verified,
        JSON.stringify(record.extractedFeatures || {}),
      ],
    );
    return result.rows[0];
  }

  statements.push(record);
  return record;
}

async function saveConsent(userId, consentGiven, source = "borrower") {
  const record = {
    id: `consent_${Date.now()}`,
    userId,
    consentGiven,
    source,
    createdAt: new Date().toISOString(),
  };

  if (pool) {
    const result = await pool.query(
      `
        INSERT INTO consent_records (id, user_id, consent_given, source, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `,
      [record.id, record.userId, record.consentGiven, record.source],
    );
    return result.rows[0];
  }

  consentRecords.push(record);
  return record;
}

async function saveScore(record) {
  if (pool) {
    const result = await pool.query(
      `
        INSERT INTO scores (id, user_id, raw_score, risk_label, tier, factors, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `,
      [
        record.id,
        record.userId,
        record.score,
        record.riskLevel || "unknown",
        record.tier,
        JSON.stringify(record.factors || {}),
      ],
    );
    return result.rows[0];
  }

  return record;
}

async function getLatestScoreByUser(userId) {
  if (pool) {
    const result = await pool.query(
      `SELECT * FROM scores WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    return result.rows[0] || null;
  }

  return (
    [...scores]
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
  );
}

function snakeCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

module.exports = {
  users,
  statements,
  scores,
  consentRecords,
  pool,
  initDatabase,
  createUser,
  getUserByEmail,
  getUserById,
  updateUser,
  saveStatement,
  saveConsent,
  saveScore,
  getLatestScoreByUser,
};
