-- Instance workspace: boards stored in Postgres, private per local user.
CREATE TABLE IF NOT EXISTS app_workspace_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  path text NOT NULL,
  title text NOT NULL,
  revision integer NOT NULL,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  UNIQUE (owner_user_id, path)
);

CREATE TABLE IF NOT EXISTS app_workspace_board_versions (
  board_id uuid NOT NULL REFERENCES app_workspace_boards(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  message text,
  PRIMARY KEY (board_id, revision)
);

-- The per-user instance workspace is a pseudo repository without a GitHub identity,
-- so repository selections must no longer require a GitHub user id. The unique
-- indexes keep the existing ON CONFLICT (github_user_id, repository_id) upserts valid.
ALTER TABLE app_user_repositories
  DROP CONSTRAINT IF EXISTS app_user_repositories_pkey;

ALTER TABLE app_user_repositories
  ALTER COLUMN github_user_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_user_repositories_github_repository_idx
  ON app_user_repositories (github_user_id, repository_id);

CREATE UNIQUE INDEX IF NOT EXISTS app_user_repositories_user_repository_idx
  ON app_user_repositories (user_id, repository_id);
