CREATE TABLE IF NOT EXISTS app_users (
  github_user_id bigint PRIMARY KEY,
  login text NOT NULL,
  name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_repositories
  ADD COLUMN IF NOT EXISTS github_repository_id bigint,
  ADD COLUMN IF NOT EXISTS private boolean NOT NULL DEFAULT false;

ALTER TABLE app_repositories
  DROP CONSTRAINT IF EXISTS app_repositories_status_check;

ALTER TABLE app_repositories
  ADD CONSTRAINT app_repositories_status_check
  CHECK (status IN ('ready', 'syncing', 'empty', 'error'));

CREATE UNIQUE INDEX IF NOT EXISTS app_repositories_github_repository_id_idx
  ON app_repositories (github_repository_id)
  WHERE github_repository_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS app_user_repositories (
  github_user_id bigint NOT NULL REFERENCES app_users(github_user_id) ON DELETE CASCADE,
  repository_id text NOT NULL REFERENCES app_repositories(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  selected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (github_user_id, repository_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS app_user_repositories_one_active_idx
  ON app_user_repositories (github_user_id)
  WHERE is_active;
