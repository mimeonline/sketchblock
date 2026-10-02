ALTER TABLE app_sessions
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'repository',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS purge_after timestamptz NULL,
  ADD COLUMN IF NOT EXISTS title text NULL,
  ADD COLUMN IF NOT EXISTS participant_download boolean NOT NULL DEFAULT true;

ALTER TABLE app_sessions
  ADD CONSTRAINT app_sessions_source_kind_check
    CHECK (source_kind IN ('repository', 'adhoc', 'workspace'));

ALTER TABLE app_sessions
  ALTER COLUMN repository_id DROP NOT NULL;

ALTER TABLE app_sessions
  ADD CONSTRAINT app_sessions_repository_required_check
    CHECK (source_kind <> 'repository' OR repository_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS app_sessions_purge_after_idx
  ON app_sessions (purge_after)
  WHERE purge_after IS NOT NULL;
