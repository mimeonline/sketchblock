DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM app_user_repositories WHERE user_id IS NULL) THEN
    RAISE EXCEPTION 'V6 migration could not resolve a local user for every repository selection';
  END IF;
  IF EXISTS (SELECT 1 FROM app_repositories WHERE connected_by_user_id IS NULL) THEN
    RAISE EXCEPTION 'V6 migration could not resolve an owner for every configured repository';
  END IF;
  IF (SELECT count(*) FROM app_instance_owners) > 0
    AND (SELECT count(*) FROM app_users WHERE role = 'instance_owner') <> 1 THEN
    RAISE EXCEPTION 'V6 migration requires exactly one migrated instance owner';
  END IF;
END $$;

ALTER TABLE app_user_repositories
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE app_repositories
  ALTER COLUMN connected_by_user_id SET NOT NULL;

ALTER TABLE app_sessions
  ADD COLUMN IF NOT EXISTS created_by_user_id text REFERENCES app_users(id) ON DELETE RESTRICT;

UPDATE app_sessions
SET created_by_user_id = created_by_owner_id
WHERE created_by_user_id IS NULL AND created_by_owner_id IS NOT NULL;

ALTER TABLE app_session_invites
  ADD COLUMN IF NOT EXISTS created_by_user_id text REFERENCES app_users(id) ON DELETE RESTRICT;

UPDATE app_session_invites
SET created_by_user_id = created_by_owner_id
WHERE created_by_user_id IS NULL AND created_by_owner_id IS NOT NULL;
