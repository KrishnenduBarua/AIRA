CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NULL,
  phone_number TEXT NOT NULL UNIQUE,
  password_hash TEXT NULL DEFAULT NULL,
  role TEXT NOT NULL DEFAULT 'borrower',
  consent_given BOOLEAN NOT NULL DEFAULT FALSE,
  nid_verified BOOLEAN NOT NULL DEFAULT FALSE,
  date_of_birth DATE,
  nid_number TEXT,
  permanent_address TEXT,
  nid_front_url TEXT,
  nid_back_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN email DROP DEFAULT;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nid_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS permanent_address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nid_front_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nid_back_url TEXT;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN phone_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_number_unique ON users (phone_number) WHERE phone_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_nid_number_unique ON users (nid_number) WHERE nid_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS lender_applications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  organization_name TEXT NOT NULL,
  trade_license_number TEXT,
  tin_number TEXT,
  bin_number TEXT,
  phone_number TEXT NOT NULL,
  personal_nid_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  documents JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE lender_applications ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES users(id);
ALTER TABLE lender_applications ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS consent_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  consent_given BOOLEAN NOT NULL,
  source TEXT NOT NULL DEFAULT 'borrower',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS statements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  extracted_features JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS scores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  raw_score DOUBLE PRECISION NOT NULL,
  risk_label TEXT NOT NULL,
  tier TEXT NOT NULL,
  factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_requests (
  id TEXT PRIMARY KEY,
  borrower_id TEXT NOT NULL REFERENCES users(id),
  lender_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  decision_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP
);

-- Human oversight: every accept/decline carries the reviewing lender's
-- written reason, so a decision is always attributable to a person.
ALTER TABLE loan_requests ADD COLUMN IF NOT EXISTS decision_reason TEXT;

-- A borrower may hold only one open request per lender, but may re-apply
-- after that lender has accepted or declined the previous one.
CREATE UNIQUE INDEX IF NOT EXISTS loan_requests_open_unique
  ON loan_requests (borrower_id, lender_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  mode TEXT NOT NULL CHECK (mode IN ('borrower', 'lender')),
  subject_user_id TEXT REFERENCES users(id),
  score_id TEXT REFERENCES scores(id),
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS conversations_scope_unique
  ON conversations (user_id, mode, COALESCE(subject_user_id, ''));
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_subject ON conversations(subject_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
