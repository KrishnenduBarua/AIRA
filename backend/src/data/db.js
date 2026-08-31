const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { databaseUrl, useInMemoryDb } = require("../config");
const { hashPassword } = require("../utils/auth");

const users = [
  {
    id: "user_001",
    name: "Demo Borrower",
    email: "borrower@example.com",
    phoneNumber: "+1234567890",
    passwordHash: null,
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

async function seedDemoUsers() {
  const demoUsers = [
    {
      id: "user_001",
      name: "Demo Borrower",
      email: "borrower@example.com",
      phoneNumber: "+1234567890",
      password: "demo-password",
      role: "borrower",
      consentGiven: true,
      nidVerified: true,
    },
    {
      id: "user_002",
      name: "Demo Lender",
      email: "lender@example.com",
      phoneNumber: "+1234567891",
      password: "lender-password",
      role: "lender",
      consentGiven: false,
      nidVerified: true,
    },
    {
      id: "user_003",
      name: "Admin User",
      email: "admin@example.com",
      phoneNumber: "+1234567892",
      password: "admin-password",
      role: "admin",
      consentGiven: true,
      nidVerified: true,
    },
  ];

  for (const user of demoUsers) {
    const existing = await getUserByPhone(user.phoneNumber);
    if (!existing) {
      await createUser({
        ...user,
        passwordHash: null,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return demoUsers;
}

async function seedDemoScores() {
  const demoScores = [
    {
      id: "score_user_001",
      userId: "user_001",
      score: 30,
      riskLevel: "high_risk",
      tier: "Bronze",
      factors: {
        income_regularity: 2.7,
        bill_payment_regularity: 1.97,
        spending_to_income_ratio: 4.83,
      },
    },
    {
      id: "score_user_002",
      userId: "user_002",
      score: 55,
      riskLevel: "medium_risk",
      tier: "Silver",
      factors: {
        income_regularity: 1.4,
        savings_ratio: 0.28,
        transaction_diversity: 0.9,
      },
    },
    {
      id: "score_user_003",
      userId: "user_003",
      score: 78,
      riskLevel: "low_risk",
      tier: "Gold",
      factors: {
        avg_monthly_income: 0.4,
        bill_payment_regularity: 1.2,
        balance_volatility: 0.3,
      },
    },
  ];

  for (const record of demoScores) {
    const existing = await getLatestScoreByUser(record.userId);
    if (!existing || existing.id !== record.id) {
      await pool.query(
        `
          INSERT INTO scores (id, user_id, raw_score, risk_label, tier, factors, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          ON CONFLICT (id) DO NOTHING
        `,
        [
          record.id,
          record.userId,
          record.score,
          record.riskLevel,
          record.tier,
          JSON.stringify(record.factors || {}),
        ],
      );
    }
  }

  return demoScores;
}

async function initDatabase() {
  if (!pool) {
    return { mode: "memory" };
  }

  const schemaSql = fs.readFileSync(
    path.join(__dirname, "..", "..", "sql", "schema.sql"),
    "utf-8",
  );

  await pool.query(schemaSql);
  await seedDemoUsers();
  await seedDemoScores();
  return { mode: "postgres" };
}

async function createUser(user) {
  if (pool) {
    const result = await pool.query(
      `
        INSERT INTO users (id, name, email, phone_number, password_hash, role, consent_given, nid_verified, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *
      `,
      [
        user.id,
        user.name,
        user.email || null,
        user.phoneNumber || null,
        user.passwordHash || null,
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

async function getUserByPhone(phone) {
  const normalized = String(phone || "").replace(/\s+/g, "");
  if (!normalized) return null;

  if (pool) {
    const result = await pool.query(
      "SELECT * FROM users WHERE phone_number = $1 LIMIT 1",
      [normalized.startsWith("+") ? normalized : `+${normalized}`],
    );
    return result.rows[0] || null;
  }

  return (
    users.find((user) => {
      const current = user.phoneNumber || "";
      return (
        current.replace(/\s+/g, "") ===
        (normalized.startsWith("+") ? normalized : `+${normalized}`)
      );
    }) || null
  );
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

async function getFlaggedUsers() {
  if (pool) {
    const result = await pool.query(
      `
        SELECT u.id AS user_id, u.name, u.role, s.raw_score, s.risk_label, s.tier, s.created_at
        FROM scores s
        INNER JOIN users u ON u.id = s.user_id
        WHERE s.risk_label IN ('medium_risk', 'high_risk')
        ORDER BY s.created_at DESC
      `,
    );

    return result.rows.map((row) => ({
      userId: row.user_id,
      name: row.name,
      role: row.role,
      score: row.raw_score,
      riskLevel: row.risk_label,
      tier: row.tier,
      status: row.risk_label === "high_risk" ? "Manual review" : "Monitor",
      createdAt: row.created_at,
    }));
  }

  return scores
    .filter((entry) => entry.riskLevel && entry.riskLevel !== "low_risk")
    .map((entry) => {
      const user = users.find((candidate) => candidate.id === entry.userId);
      return {
        userId: entry.userId,
        name: user?.name || entry.userId,
        role: user?.role || "borrower",
        score: entry.score,
        riskLevel: entry.riskLevel,
        tier: entry.tier,
        status: entry.riskLevel === "high_risk" ? "Manual review" : "Monitor",
        createdAt: entry.createdAt,
      };
    });
}

async function getStatementsByUser(userId) {
  if (pool) {
    const result = await pool.query(
      `SELECT * FROM statements WHERE user_id = $1 ORDER BY uploaded_at DESC`,
      [userId],
    );
    return result.rows;
  }

  return statements.filter((entry) => entry.userId === userId);
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
  getUserByPhone,
  getUserByEmail,
  getUserById,
  updateUser,
  saveStatement,
  saveConsent,
  saveScore,
  getLatestScoreByUser,
  getFlaggedUsers,
  getStatementsByUser,
  getUserByPhone,
};
