CREATE TABLE IF NOT EXISTS app_repositories (
  id text PRIMARY KEY,
  owner text NOT NULL,
  name text NOT NULL,
  branch text NOT NULL,
  html_url text NOT NULL,
  api_url text NOT NULL,
  status text NOT NULL CHECK (status IN ('ready', 'syncing', 'error')),
  last_scan_at timestamptz,
  drawing_count integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_sessions (
  id text PRIMARY KEY,
  repository_id text NOT NULL,
  drawing_path text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'closed', 'saved')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS app_sessions_repository_id_idx
  ON app_sessions (repository_id);

CREATE INDEX IF NOT EXISTS app_sessions_updated_at_idx
  ON app_sessions (updated_at DESC);

CREATE TABLE IF NOT EXISTS app_session_snapshots (
  session_id text PRIMARY KEY REFERENCES app_sessions(id) ON DELETE CASCADE,
  drawing_path text NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  content jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  updated_by text NOT NULL
);
