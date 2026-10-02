ALTER TABLE app_session_participants
  ADD COLUMN IF NOT EXISTS removed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS removed_by_user_id text NULL;
