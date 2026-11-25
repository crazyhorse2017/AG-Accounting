-- AG Accounting: initial schema.
--
-- HARD RULE: this database never stores payment card data, tax returns,
-- Social Security numbers, or bank account numbers. Documents go through the
-- client portal provider and payments through PayPal; the site only links out.
--
-- Contact requests are kept only long enough to respond, then deleted by the
-- Worker's daily scheduled cleanup (see CONTACT_RETENTION_DAYS in src/worker).

CREATE TABLE IF NOT EXISTS contact_requests (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  name               TEXT    NOT NULL,
  email              TEXT    NOT NULL,
  phone              TEXT,
  topic              TEXT    NOT NULL,
  preferred_contact  TEXT    NOT NULL CHECK (preferred_contact IN ('email', 'phone')),
  message            TEXT    NOT NULL,
  -- Salted daily hash of the sender's IP address, used only for rate limiting.
  rate_key           TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_requests_created_at ON contact_requests (created_at);
CREATE INDEX IF NOT EXISTS idx_contact_requests_rate_key ON contact_requests (rate_key, created_at);
