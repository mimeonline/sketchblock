ALTER TABLE app_users RENAME TO app_legacy_github_users;

CREATE TABLE app_users (
  id text PRIMARY KEY,
  username text NOT NULL,
  display_name text,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('instance_owner', 'user')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_lower_idx
  ON app_users (lower(username));

CREATE UNIQUE INDEX IF NOT EXISTS app_users_single_instance_owner_idx
  ON app_users (role)
  WHERE role = 'instance_owner';

INSERT INTO app_users (
  id, username, password_hash, role, status, must_change_password,
  created_at, updated_at, last_login_at
)
SELECT
  id, username, password_hash, 'instance_owner', 'active', false,
  created_at, updated_at, last_login_at
FROM app_instance_owners
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS app_user_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_user_sessions_active_user_idx
  ON app_user_sessions (user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS app_user_github_identities (
  user_id text PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  github_user_id bigint NOT NULL UNIQUE,
  login text NOT NULL,
  name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_user_github_identities (user_id, github_user_id, login, name, avatar_url)
SELECT owner.id, owner.github_user_id, owner.github_login, owner.github_name, owner.github_avatar_url
FROM app_instance_owners owner
WHERE owner.github_user_id IS NOT NULL AND owner.github_login IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE app_user_repositories
  ADD COLUMN IF NOT EXISTS user_id text REFERENCES app_users(id) ON DELETE CASCADE;

UPDATE app_user_repositories repository_access
SET user_id = identity.user_id
FROM app_user_github_identities identity
WHERE repository_access.github_user_id = identity.github_user_id
  AND repository_access.user_id IS NULL;

ALTER TABLE app_repositories
  ADD COLUMN IF NOT EXISTS connected_by_user_id text REFERENCES app_users(id) ON DELETE RESTRICT;

UPDATE app_repositories repository
SET connected_by_user_id = repository_access.user_id
FROM app_user_repositories repository_access
WHERE repository_access.repository_id = repository.id
  AND repository_access.user_id IS NOT NULL
  AND repository.connected_by_user_id IS NULL;
