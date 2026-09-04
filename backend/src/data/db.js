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
const loanRequests = [];
const conversations = [];
const messages = [];
const fraudReviews = [];

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
    blockchainAddress: row.blockchainAddress ?? row.blockchain_address,
    createdAt: row.createdAt ?? row.created_at,
  };
}

// PostgreSQL returns BOOLEAN values as booleans, but older imported/demo rows
// can contain the equivalent value as a string or number. Keep consent
// decisions consistent at every API boundary without treating "false" as
// granted just because it is a non-empty string.
function hasConsent(user) {
  const value = user?.consentGiven ?? user?.consent_given;
  return value === true || value === 1 || value === "1" || value === "true";
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

function mapLoanRequestRow(row) {
  if (!row) return null;

  return {
    ...row,
    borrowerId: row.borrowerId ?? row.borrower_id,
    lenderId: row.lenderId ?? row.lender_id,
    createdAt: row.createdAt ?? row.created_at,
    reviewedAt: row.reviewedAt ?? row.reviewed_at,
    decisionReason: row.decisionReason ?? row.decision_reason ?? null,
  };
}

function mapFraudReviewRow(row) {
  if (!row) return null;

  return {
    ...row,
    borrowerId: row.borrowerId ?? row.borrower_id,
    lenderId: row.lenderId ?? row.lender_id,
    loanRequestId: row.loanRequestId ?? row.loan_request_id,
    adminNotes: row.adminNotes ?? row.admin_notes ?? "",
    reviewedBy: row.reviewedBy ?? row.reviewed_by,
    createdAt: row.createdAt ?? row.created_at,
    reviewedAt: row.reviewedAt ?? row.reviewed_at,
  };
}

const pool =
  databaseUrl && !useInMemoryDb
    ? new Pool({ connectionString: databaseUrl })
    : null;

async function ensureDefaultAdmin() {
  const adminPhone = normalizePhone("01882373777");
  if (await getUserByPhone(adminPhone)) return;

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

async function initDatabase() {
  if (!pool) {
    await ensureDefaultAdmin();
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
  await pool.query("ALTER TABLE users ALTER COLUMN phone_number SET NOT NULL;");
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
  await ensureDefaultAdmin();
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
          blockchain_address,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
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
        user.blockchainAddress || null,
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

async function getBorrowers() {
  if (pool) {
    const result = await pool.query(
      `SELECT id, name, email, phone_number, consent_given, nid_verified,
              date_of_birth, nid_number, permanent_address,
              nid_front_url, nid_back_url, created_at
       FROM users
       WHERE role = 'borrower'
       ORDER BY created_at DESC`,
    );
    return result.rows.map(mapUserRow);
  }

  return users
    .filter((user) => user.role === "borrower")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Remove a borrower and the records that reference the user. The foreign keys
// in older installations do not all use ON DELETE CASCADE, so doing this
// explicitly keeps account deletion reliable in both old and new databases.
async function deleteUser(userId) {
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM fraud_reviews WHERE borrower_id = $1 OR lender_id = $1",
        [userId],
      );
      await client.query(
        "DELETE FROM loan_requests WHERE borrower_id = $1 OR lender_id = $1",
        [userId],
      );
      await client.query(
        "DELETE FROM conversations WHERE user_id = $1 OR subject_user_id = $1",
        [userId],
      );
      await client.query("DELETE FROM statements WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM scores WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM consent_records WHERE user_id = $1", [
        userId,
      ]);
      await client.query("DELETE FROM lender_applications WHERE user_id = $1", [
        userId,
      ]);
      const result = await client.query(
        "DELETE FROM users WHERE id = $1 RETURNING id",
        [userId],
      );
      await client.query("COMMIT");
      return Boolean(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  const index = users.findIndex((user) => user.id === userId);
  if (index < 0) return false;

  const conversationIds = new Set(
    conversations
      .filter(
        (conversation) =>
          conversation.userId === userId ||
          conversation.subjectUserId === userId,
      )
      .map((conversation) => conversation.id),
  );
  users.splice(index, 1);
  statements.splice(
    0,
    statements.length,
    ...statements.filter((statement) => statement.userId !== userId),
  );
  scores.splice(
    0,
    scores.length,
    ...scores.filter((score) => score.userId !== userId),
  );
  consentRecords.splice(
    0,
    consentRecords.length,
    ...consentRecords.filter((record) => record.userId !== userId),
  );
  loanRequests.splice(
    0,
    loanRequests.length,
    ...loanRequests.filter(
      (request) => request.borrowerId !== userId && request.lenderId !== userId,
    ),
  );
  fraudReviews.splice(
    0,
    fraudReviews.length,
    ...fraudReviews.filter(
      (review) => review.borrowerId !== userId && review.lenderId !== userId,
    ),
  );
  conversations.splice(
    0,
    conversations.length,
    ...conversations.filter(
      (conversation) => !conversationIds.has(conversation.id),
    ),
  );
  messages.splice(
    0,
    messages.length,
    ...messages.filter(
      (message) => !conversationIds.has(message.conversationId),
    ),
  );
  lenderApplications.splice(
    0,
    lenderApplications.length,
    ...lenderApplications.filter(
      (application) => application.userId !== userId,
    ),
  );
  return true;
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
        INSERT INTO scores (id, user_id, raw_score, risk_label, tier, factors,
          score_hash, transaction_hash, anchor_status, anchored_at,
          anchor_network, anchor_contract_address, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        RETURNING *
      `,
      [
        record.id,
        record.userId,
        record.score,
        record.riskLevel || "unknown",
        record.tier,
        JSON.stringify(record.factors || {}),
        record.scoreHash || null,
        record.transactionHash || null,
        record.anchorStatus || "not_configured",
        record.anchoredAt || null,
        record.anchorNetwork || null,
        record.anchorContractAddress || null,
      ],
    );
    return result.rows[0];
  }

  return record;
}

async function updateScoreAnchor(scoreId, anchor) {
  if (pool) {
    const result = await pool.query(
      `UPDATE scores SET score_hash = $1, transaction_hash = $2,
        anchor_status = $3, anchored_at = $4, anchor_network = $5,
        anchor_contract_address = $6 WHERE id = $7 RETURNING *`,
      [
        anchor.scoreHash || null,
        anchor.transactionHash || null,
        anchor.status || "failed",
        anchor.anchoredAt || null,
        anchor.network || null,
        anchor.contractAddress || null,
        scoreId,
      ],
    );
    return result.rows[0] || null;
  }

  const score = scores.find((item) => item.id === scoreId);
  if (!score) return null;
  Object.assign(score, {
    scoreHash: anchor.scoreHash || null,
    transactionHash: anchor.transactionHash || null,
    anchorStatus: anchor.status || "failed",
    anchoredAt: anchor.anchoredAt || null,
    anchorNetwork: anchor.network || null,
    anchorContractAddress: anchor.contractAddress || null,
  });
  return score;
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

async function getOrCreateConversation({
  userId,
  mode,
  subjectUserId = null,
  scoreId = null,
}) {
  if (pool) {
    const result = await pool.query(
      `SELECT * FROM conversations
       WHERE user_id = $1 AND mode = $2
         AND subject_user_id IS NOT DISTINCT FROM $3
       LIMIT 1`,
      [userId, mode, subjectUserId],
    );
    if (result.rows[0]) {
      if (scoreId && result.rows[0].score_id !== scoreId) {
        const updated = await pool.query(
          "UPDATE conversations SET score_id = $1 WHERE id = $2 RETURNING *",
          [scoreId, result.rows[0].id],
        );
        return updated.rows[0];
      }
      return result.rows[0];
    }

    const id = `conversation_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const created = await pool.query(
      `INSERT INTO conversations (id, user_id, mode, subject_user_id, score_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, userId, mode, subjectUserId, scoreId],
    );
    return created.rows[0];
  }

  const existing = conversations.find(
    (item) =>
      item.userId === userId &&
      item.mode === mode &&
      (item.subjectUserId || null) === (subjectUserId || null),
  );
  if (existing) {
    if (scoreId) existing.scoreId = scoreId;
    return existing;
  }

  const conversation = {
    id: `conversation_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    mode,
    subjectUserId,
    scoreId,
    startedAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
  };
  conversations.push(conversation);
  return conversation;
}

async function getConversationMessages(conversationId) {
  if (pool) {
    const result = await pool.query(
      "SELECT id, role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC, id ASC",
      [conversationId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    }));
  }

  return messages
    .filter((item) => item.conversationId === conversationId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

async function saveConversationMessage({ conversationId, role, content }) {
  const id = `message_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  if (pool) {
    const result = await pool.query(
      `INSERT INTO messages (id, conversation_id, role, content)
       VALUES ($1, $2, $3, $4) RETURNING id, role, content, created_at`,
      [id, conversationId, role, content],
    );
    await pool.query(
      "UPDATE conversations SET last_message_at = NOW() WHERE id = $1",
      [conversationId],
    );
    const row = result.rows[0];
    return {
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    };
  }

  const message = {
    id,
    conversationId,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
  messages.push(message);
  const conversation = conversations.find((item) => item.id === conversationId);
  if (conversation) conversation.lastMessageAt = message.createdAt;
  return message;
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

async function getStatementById(statementId) {
  if (pool) {
    const result = await pool.query(
      "SELECT * FROM statements WHERE id = $1 LIMIT 1",
      [statementId],
    );
    return result.rows[0] || null;
  }

  return statements.find((entry) => entry.id === statementId) || null;
}

async function getLenderDirectory() {
  if (pool) {
    const result = await pool.query(
      `SELECT id, name, created_at FROM users
       WHERE role = 'lender' AND password_hash IS NOT NULL
       ORDER BY name ASC`,
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      joinedAt: row.created_at,
    }));
  }

  return users
    .filter((user) => user.role === "lender" && user.passwordHash)
    .map((user) => ({
      id: user.id,
      name: user.name,
      joinedAt: user.createdAt,
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

async function createLoanRequest({ borrowerId, lenderId }) {
  const record = {
    id: `loan_req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    borrowerId,
    lenderId,
    status: "pending",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };

  if (pool) {
    const result = await pool.query(
      `INSERT INTO loan_requests (id, borrower_id, lender_id, status, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [record.id, record.borrowerId, record.lenderId, record.status],
    );
    return mapLoanRequestRow(result.rows[0]);
  }

  loanRequests.push(record);
  return record;
}

async function getOpenLoanRequest(borrowerId, lenderId) {
  if (pool) {
    const result = await pool.query(
      `SELECT * FROM loan_requests
       WHERE borrower_id = $1 AND lender_id = $2 AND status = 'pending'
       LIMIT 1`,
      [borrowerId, lenderId],
    );
    return mapLoanRequestRow(result.rows[0]);
  }

  return (
    loanRequests.find(
      (item) =>
        item.borrowerId === borrowerId &&
        item.lenderId === lenderId &&
        item.status === "pending",
    ) || null
  );
}

async function getLoanRequestById(requestId) {
  if (pool) {
    const result = await pool.query(
      "SELECT * FROM loan_requests WHERE id = $1 LIMIT 1",
      [requestId],
    );
    return mapLoanRequestRow(result.rows[0]);
  }

  return loanRequests.find((item) => item.id === requestId) || null;
}

async function getLoanRequestsByBorrower(borrowerId) {
  if (pool) {
    const result = await pool.query(
      `SELECT r.*, u.name AS lender_name
       FROM loan_requests r
       INNER JOIN users u ON u.id = r.lender_id
       WHERE r.borrower_id = $1
       ORDER BY r.created_at DESC`,
      [borrowerId],
    );
    return result.rows.map((row) => ({
      ...mapLoanRequestRow(row),
      lenderName: row.lender_name,
    }));
  }

  return loanRequests
    .filter((item) => item.borrowerId === borrowerId)
    .map((item) => ({
      ...item,
      lenderName:
        users.find((user) => user.id === item.lenderId)?.name || item.lenderId,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getLoanRequestsByLender(lenderId) {
  if (pool) {
    const result = await pool.query(
      `SELECT r.*, u.name AS borrower_name, u.phone_number AS borrower_phone,
              u.nid_verified AS borrower_nid_verified,
              f.id AS fraud_review_id, f.status AS fraud_review_status,
              f.reason AS fraud_review_reason, f.admin_notes AS fraud_review_admin_notes,
              f.created_at AS fraud_review_created_at, f.reviewed_at AS fraud_review_reviewed_at
       FROM loan_requests r
       INNER JOIN users u ON u.id = r.borrower_id
       LEFT JOIN LATERAL (
         SELECT id, status, reason, admin_notes, created_at, reviewed_at
         FROM fraud_reviews
         WHERE loan_request_id = r.id
         ORDER BY created_at DESC
         LIMIT 1
       ) f ON TRUE
       WHERE r.lender_id = $1
       ORDER BY r.created_at DESC`,
      [lenderId],
    );
    return result.rows.map((row) => ({
      ...mapLoanRequestRow(row),
      borrowerName: row.borrower_name,
      borrowerPhone: row.borrower_phone,
      borrowerNidVerified: row.borrower_nid_verified,
      fraudReview: row.fraud_review_id
        ? {
            id: row.fraud_review_id,
            status: row.fraud_review_status,
            reason: row.fraud_review_reason,
            adminNotes: row.fraud_review_admin_notes,
            createdAt: row.fraud_review_created_at,
            reviewedAt: row.fraud_review_reviewed_at,
          }
        : null,
    }));
  }

  return loanRequests
    .filter((item) => item.lenderId === lenderId)
    .map((item) => {
      const borrower = users.find((user) => user.id === item.borrowerId);
      return {
        ...item,
        borrowerName: borrower?.name || item.borrowerId,
        borrowerPhone: borrower?.phoneNumber || null,
        borrowerNidVerified: Boolean(borrower?.nidVerified),
        fraudReview:
          [...fraudReviews]
            .filter((review) => review.loanRequestId === item.id)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] ||
          null,
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function updateLoanRequestStatus(
  requestId,
  status,
  decisionReason = null,
) {
  if (pool) {
    const result = await pool.query(
      `UPDATE loan_requests
       SET status = $1, decision_reason = $2, reviewed_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, decisionReason, requestId],
    );
    return mapLoanRequestRow(result.rows[0]);
  }

  const index = loanRequests.findIndex((item) => item.id === requestId);
  if (index < 0) return null;

  loanRequests[index] = {
    ...loanRequests[index],
    status,
    decisionReason,
    reviewedAt: new Date().toISOString(),
  };
  return loanRequests[index];
}

async function createFraudReview({
  borrowerId,
  lenderId,
  loanRequestId,
  reason,
}) {
  const record = {
    id: `fraud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    borrowerId,
    lenderId,
    loanRequestId,
    reason,
    status: "pending",
    adminNotes: "",
    reviewedBy: null,
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };

  if (pool) {
    const result = await pool.query(
      `INSERT INTO fraud_reviews
       (id, borrower_id, lender_id, loan_request_id, reason, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [
        record.id,
        record.borrowerId,
        record.lenderId,
        record.loanRequestId,
        record.reason,
        record.status,
      ],
    );
    return mapFraudReviewRow(result.rows[0]);
  }

  fraudReviews.push(record);
  return record;
}

async function getFraudReviewByRequestId(loanRequestId) {
  if (pool) {
    const result = await pool.query(
      `SELECT * FROM fraud_reviews
       WHERE loan_request_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [loanRequestId],
    );
    return mapFraudReviewRow(result.rows[0]);
  }

  return (
    [...fraudReviews]
      .filter((review) => review.loanRequestId === loanRequestId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
  );
}

async function getFraudReviewById(reviewId) {
  if (pool) {
    const result = await pool.query(
      "SELECT * FROM fraud_reviews WHERE id = $1 LIMIT 1",
      [reviewId],
    );
    return mapFraudReviewRow(result.rows[0]);
  }

  return fraudReviews.find((review) => review.id === reviewId) || null;
}

async function getFraudReviews() {
  if (pool) {
    const result = await pool.query(
      `SELECT f.*, b.name AS borrower_name, b.phone_number AS borrower_phone,
              l.name AS lender_name, r.status AS loan_status
       FROM fraud_reviews f
       INNER JOIN users b ON b.id = f.borrower_id
       INNER JOIN users l ON l.id = f.lender_id
       LEFT JOIN loan_requests r ON r.id = f.loan_request_id
       ORDER BY CASE WHEN f.status IN ('pending', 'reviewing') THEN 0 ELSE 1 END,
                f.created_at DESC`,
    );
    return result.rows.map((row) => ({
      ...mapFraudReviewRow(row),
      borrowerName: row.borrower_name,
      borrowerPhone: row.borrower_phone,
      lenderName: row.lender_name,
      loanStatus: row.loan_status,
    }));
  }

  return [...fraudReviews]
    .map((review) => {
      const borrower = users.find((user) => user.id === review.borrowerId);
      const lender = users.find((user) => user.id === review.lenderId);
      const loan = loanRequests.find(
        (item) => item.id === review.loanRequestId,
      );
      return {
        ...review,
        borrowerName: borrower?.name || review.borrowerId,
        borrowerPhone: borrower?.phoneNumber || null,
        lenderName: lender?.name || review.lenderId,
        loanStatus: loan?.status || null,
      };
    })
    .sort((a, b) => {
      const aOpen = ["pending", "reviewing"].includes(a.status);
      const bOpen = ["pending", "reviewing"].includes(b.status);
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
}

async function updateFraudReview(reviewId, status, adminNotes, reviewedBy) {
  if (pool) {
    const result = await pool.query(
      `UPDATE fraud_reviews
       SET status = $1, admin_notes = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4 RETURNING *`,
      [status, adminNotes, reviewedBy, reviewId],
    );
    return mapFraudReviewRow(result.rows[0]);
  }

  const index = fraudReviews.findIndex((review) => review.id === reviewId);
  if (index < 0) return null;
  fraudReviews[index] = {
    ...fraudReviews[index],
    status,
    adminNotes,
    reviewedBy,
    reviewedAt: new Date().toISOString(),
  };
  return fraudReviews[index];
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
  loanRequests,
  pool,
  initDatabase,
  createUser,
  getUserByPhone,
  getUserByNidNumber,
  getUserByEmail,
  getUserById,
  getBorrowers,
  deleteUser,
  hasConsent,
  updateUser,
  saveStatement,
  saveConsent,
  saveLenderApplication,
  getLenderApplications,
  getLenderApplicationByPhone,
  approveLenderApplication,
  completeLenderApplication,
  saveScore,
  updateScoreAnchor,
  getLatestScoreByUser,
  conversations,
  messages,
  fraudReviews,
  getOrCreateConversation,
  getConversationMessages,
  saveConversationMessage,
  getFlaggedUsers,
  getStatementsByUser,
  getStatementById,
  getLenderDirectory,
  createLoanRequest,
  getOpenLoanRequest,
  getLoanRequestById,
  getLoanRequestsByBorrower,
  getLoanRequestsByLender,
  updateLoanRequestStatus,
  createFraudReview,
  getFraudReviewByRequestId,
  getFraudReviewById,
  getFraudReviews,
  updateFraudReview,
};
