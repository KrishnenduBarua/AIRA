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
  blockchain_address TEXT UNIQUE,
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
ALTER TABLE users ADD COLUMN IF NOT EXISTS blockchain_address TEXT;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN phone_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_number_unique ON users (phone_number) WHERE phone_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_nid_number_unique ON users (nid_number) WHERE nid_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_blockchain_address_unique ON users (blockchain_address) WHERE blockchain_address IS NOT NULL;

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
  score_hash TEXT,
  transaction_hash TEXT,
  anchor_status TEXT NOT NULL DEFAULT 'not_configured',
  anchored_at TIMESTAMP,
  anchor_network TEXT,
  anchor_contract_address TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE scores ADD COLUMN IF NOT EXISTS score_hash TEXT;
ALTER TABLE scores ADD COLUMN IF NOT EXISTS transaction_hash TEXT;
ALTER TABLE scores ADD COLUMN IF NOT EXISTS anchor_status TEXT NOT NULL DEFAULT 'not_configured';
ALTER TABLE scores ADD COLUMN IF NOT EXISTS anchored_at TIMESTAMP;
ALTER TABLE scores ADD COLUMN IF NOT EXISTS anchor_network TEXT;
ALTER TABLE scores ADD COLUMN IF NOT EXISTS anchor_contract_address TEXT;

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

-- Lenders can refer a borrower to an admin for a human fraud review. This is
-- separate from the model's risk label and does not automatically decide a
-- loan or mark the borrower as fraudulent.
CREATE TABLE IF NOT EXISTS fraud_reviews (
  id TEXT PRIMARY KEY,
  borrower_id TEXT NOT NULL REFERENCES users(id),
  lender_id TEXT NOT NULL REFERENCES users(id),
  loan_request_id TEXT NOT NULL REFERENCES loan_requests(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewing', 'cleared', 'confirmed')),
  admin_notes TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS fraud_reviews_open_request_unique
  ON fraud_reviews (loan_request_id)
  WHERE status IN ('pending', 'reviewing');
CREATE INDEX IF NOT EXISTS idx_fraud_reviews_status_created
  ON fraud_reviews (status, created_at DESC);

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
