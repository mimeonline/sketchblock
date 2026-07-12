DROP INDEX IF EXISTS app_user_repositories_one_active_idx;

CREATE UNIQUE INDEX app_user_repositories_one_active_user_idx
  ON app_user_repositories (user_id)
  WHERE is_active;
