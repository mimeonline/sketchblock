-- Repository records are per local user: the same GitHub repository may be
-- connected by several users, each with an independent record.
DROP INDEX IF EXISTS app_repositories_github_repository_id_idx;

CREATE UNIQUE INDEX IF NOT EXISTS app_repositories_user_github_repository_idx
  ON app_repositories (connected_by_user_id, github_repository_id)
  WHERE github_repository_id IS NOT NULL;
