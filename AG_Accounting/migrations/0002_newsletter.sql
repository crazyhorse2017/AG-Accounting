-- AG Accounting: newsletter and scheduled email support.
--
-- Subscriber names and email addresses live in Brevo (with their consent records),
-- NOT here. These tables hold only rate-limit keys and a log of which approved
-- items have already been sent, so nothing goes out twice.

CREATE TABLE IF NOT EXISTS rate_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT    NOT NULL,
  rate_key    TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_rate_events_lookup ON rate_events (kind, rate_key, created_at);

CREATE TABLE IF NOT EXISTS email_sends (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  kind               TEXT    NOT NULL CHECK (kind IN ('tip', 'newsletter')),
  item_id            TEXT    NOT NULL,
  mode               TEXT    NOT NULL CHECK (mode IN ('draft', 'auto')),
  brevo_campaign_id  TEXT,
  created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (kind, item_id)
);
