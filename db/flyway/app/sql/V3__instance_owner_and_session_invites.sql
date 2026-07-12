CREATE TABLE IF NOT EXISTS app_instance_owners (
  id text PRIMARY KEY,
  instance_key smallint NOT NULL DEFAULT 1 UNIQUE CHECK (instance_key = 1),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  github_user_id bigint,
  github_login text,
  github_name text,
  github_avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS app_instance_owners_github_user_id_idx
  ON app_instance_owners (github_user_id)
  WHERE github_user_id IS NOT NULL;

ALTER TABLE app_sessions
  ADD COLUMN IF NOT EXISTS created_by_owner_id text REFERENCES app_instance_owners(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS app_session_invites (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES app_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('collaborator', 'viewer')),
  token_hash text NOT NULL UNIQUE,
  token_ciphertext text NOT NULL,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by_owner_id text REFERENCES app_instance_owners(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_session_invites_one_active_role_idx
  ON app_session_invites (session_id, role)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS app_session_participants (
  session_id text NOT NULL REFERENCES app_sessions(id) ON DELETE CASCADE,
  github_user_id bigint NOT NULL,
  github_login text NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  assigned_role text NOT NULL CHECK (assigned_role IN ('collaborator', 'viewer')),
  first_joined_at timestamptz NOT NULL DEFAULT now(),
  last_joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, github_user_id)
);

CREATE INDEX IF NOT EXISTS app_session_participants_last_joined_idx
  ON app_session_participants (last_joined_at DESC);
