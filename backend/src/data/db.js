const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { databaseUrl, useInMemoryDb } = require("../config");
const { normalizePhone } = require("../services/otp");
const { hashPassword } = require("../utils/auth");

const users = [];

const statements = [];
const scores = [];
const consentRecords = [];
const lenderApplications = [];

function mapUserRow(row) {
  if (!row) return null;

  return {
    ...row,
    phoneNumber: row.phoneNumber ?? row.phone_number,
    passwordHash: row.passwordHash ?? row.password_hash,
    consentGiven: row.consentGiven ?? row.consent_given,
    nidVerified: row.nidVerified ?? row.nid_verified,
    dateOfBirth: row.dateOfBirth ?? row.date_of_birth,
    nidNumber: row.nidNumber ?? row.nid_number,
    permanentAddress: row.permanentAddress ?? row.permanent_address,
    nidFrontUrl: row.nidFrontUrl ?? row.nid_front_url,
    nidBackUrl: row.nidBackUrl ?? row.nid_back_url,
    createdAt: row.createdAt ?? row.created_at,
  };
}

function mapLenderApplicationRow(row) {
  if (!row) return null;

  return {
    ...row,
    userId: row.userId ?? row.user_id,
    organizationName: row.organizationName ?? row.organization_name,
    tradeLicenseNumber: row.tradeLicenseNumber ?? row.trade_license_number,
    tinNumber: row.tinNumber ?? row.tin_number,
    binNumber: row.binNumber ?? row.bin_number,
    phoneNumber: row.phoneNumber ?? row.phone_number,
    personalNidNumber: row.personalNidNumber ?? row.personal_nid_number,
    createdAt: row.createdAt ?? row.created_at,
    reviewedBy: row.reviewedBy ?? row.reviewed_by,
    reviewedAt: row.reviewedAt ?? row.reviewed_at,
  };
}

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
  await pool.query(
    "ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;",
  );
  await pool.query("ALTER TABLE users ALTER COLUMN email DROP DEFAULT;");
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;",
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS nid_number TEXT;",
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS permanent_address TEXT;",
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS nid_front_url TEXT;",
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS nid_back_url TEXT;",
  );
  const adminPhone = normalizePhone("01882373777");
  if (!(await getUserByPhone(adminPhone))) {
    await createUser({
      id: "admin_default",
      name: "AIRA Administrator",
      email: null,
      phoneNumber: adminPhone,
      passwordHash: hashPassword("1234"),
      role: "admin",
      consentGiven: true,
      nidVerified: true,
    });
  }
  return { mode: "postgres" };
}

async function createUser(user) {
  if (pool) {
    const result = await pool.query(
      `
        INSERT INTO users (
          id,
          name,
          email,
          phone_number,
          password_hash,
          role,
          consent_given,
          nid_verified,
          date_of_birth,
          nid_number,
          permanent_address,
          nid_front_url,
          nid_back_url,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        ON CONFLICT (id) DO NOTHING
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
        user.dateOfBirth || null,
        user.nidNumber || null,
        user.permanentAddress || null,
        user.nidFrontUrl || null,
        user.nidBackUrl || null,
      ],
    );
    return mapUserRow(result.rows[0]) || (await getUserById(user.id));
  }

  users.push(user);
  return user;
}

async function getUserByPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const target = normalized;

  if (pool) {
    const result = await pool.query(
      "SELECT * FROM users WHERE phone_number = $1 LIMIT 1",
      [target],
    );
    return mapUserRow(result.rows[0]);
  }

  return (
    users.find((user) => {
      return normalizePhone(user.phoneNumber) === target;
    }) || null
  );
}

async function getUserByNidNumber(nidNumber) {
  const normalized = String(nidNumber || "")
    .replace(/\s+/g, "")
    .toUpperCase();
  if (!normalized) return null;

  if (pool) {
    const result = await pool.query(
      "SELECT * FROM users WHERE nid_number = $1 LIMIT 1",
      [normalized],
    );
    return mapUserRow(result.rows[0]);
  }

  return (
    users.find((user) => {
      const current = String(user.nidNumber || "")
        .replace(/\s+/g, "")
        .toUpperCase();
      return current === normalized;
    }) || null
  );
}

async function getUserByEmail(email) {
  if (pool) {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1 LIMIT 1",
      [email.toLowerCase()],
    );
    return mapUserRow(result.rows[0]);
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
    return mapUserRow(result.rows[0]);
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
    return mapUserRow(result.rows[0]);
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

async function saveLenderApplication(application) {
  const record = {
    id: application.id || `lender_app_${Date.now()}`,
    userId: application.userId || null,
    organizationName: application.organizationName,
    tradeLicenseNumber: application.tradeLicenseNumber,
    tinNumber: application.tinNumber,
    binNumber: application.binNumber,
    phoneNumber: application.phoneNumber,
    personalNidNumber: application.personalNidNumber,
    status: application.status || "pending",
    documents: application.documents || {},
    createdAt: new Date().toISOString(),
  };

  if (pool) {
    const result = await pool.query(
      `
        INSERT INTO lender_applications (
          id, user_id, organization_name, trade_license_number, tin_number, bin_number,
          phone_number, personal_nid_number, status, documents, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (id) DO UPDATE SET
          organization_name = EXCLUDED.organization_name,
          trade_license_number = EXCLUDED.trade_license_number,
          tin_number = EXCLUDED.tin_number,
          bin_number = EXCLUDED.bin_number,
          phone_number = EXCLUDED.phone_number,
          personal_nid_number = EXCLUDED.personal_nid_number,
          status = EXCLUDED.status,
          documents = EXCLUDED.documents
        RETURNING *
      `,
      [
        record.id,
        record.userId,
        record.organizationName,
        record.tradeLicenseNumber,
        record.tinNumber,
        record.binNumber,
        record.phoneNumber,
        record.personalNidNumber,
        record.status,
        JSON.stringify(record.documents || {}),
      ],
    );
    return result.rows[0];
  }

  lenderApplications.push(record);
  return record;
}

async function getLenderApplications() {
  if (pool) {
    const result = await pool.query(
      "SELECT * FROM lender_applications ORDER BY created_at DESC",
    );
    return result.rows.map(mapLenderApplicationRow);
  }

  return [...lenderApplications].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );
}

async function getLenderApplicationByPhone(phone) {
  const normalizedPhone = normalizePhone(phone);
  if (pool) {
    const result = await pool.query(
      "SELECT * FROM lender_applications WHERE phone_number = $1 ORDER BY created_at DESC LIMIT 1",
      [normalizedPhone],
    );
    return mapLenderApplicationRow(result.rows[0]);
  }

  return (
    [...lenderApplications]
      .filter(
        (application) =>
          normalizePhone(application.phoneNumber) === normalizedPhone,
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
  );
}

async function approveLenderApplication(applicationId, adminUserId) {
  const list = await getLenderApplications();
  const application = list.find((item) => item.id === applicationId);

  if (!application) return null;

  const approved = {
    ...application,
    status: "approved",
    reviewedBy: adminUserId,
    reviewedAt: new Date().toISOString(),
  };

  if (pool) {
    const result = await pool.query(
      "UPDATE lender_applications SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3 RETURNING *",
      ["approved", adminUserId, applicationId],
    );
    if (application.userId) {
      await updateUser(application.userId, { role: "lender" });
    }
    return result.rows[0] || approved;
  }

  const currentIndex = lenderApplications.findIndex(
    (item) => item.id === applicationId,
  );
  if (currentIndex >= 0) lenderApplications[currentIndex] = approved;
  return approved;
}

async function completeLenderApplication(applicationId, userId) {
  if (pool) {
    const result = await pool.query(
      "UPDATE lender_applications SET status = $1, user_id = $2 WHERE id = $3 RETURNING *",
      ["onboarded", userId, applicationId],
    );
    return result.rows[0] || null;
  }

  const currentIndex = lenderApplications.findIndex(
    (item) => item.id === applicationId,
  );
  if (currentIndex < 0) return null;

  lenderApplications[currentIndex] = {
    ...lenderApplications[currentIndex],
    status: "onboarded",
    userId,
  };
  return lenderApplications[currentIndex];
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
  lenderApplications,
  pool,
  initDatabase,
  createUser,
  getUserByPhone,
  getUserByNidNumber,
  getUserByEmail,
  getUserById,
  updateUser,
  saveStatement,
  saveConsent,
  saveLenderApplication,
  getLenderApplications,
  getLenderApplicationByPhone,
  approveLenderApplication,
  completeLenderApplication,
  saveScore,
  getLatestScoreByUser,
  getFlaggedUsers,
  getStatementsByUser,
};
