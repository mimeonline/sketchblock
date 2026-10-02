ALTER TABLE app_sessions
  ADD COLUMN IF NOT EXISTS allow_anonymous_viewers boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS app_session_guests (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES app_sessions(id) ON DELETE CASCADE,
  invite_id text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_app_session_guests_session ON app_session_guests (session_id);
