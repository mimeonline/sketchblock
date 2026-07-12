CREATE TABLE IF NOT EXISTS collab_sessions (
  session_id text PRIMARY KEY,
  drawing_path text,
  status text NOT NULL CHECK (status IN ('active', 'closed', 'saved')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  snapshot_revision integer,
  snapshot_content jsonb,
  snapshot_updated_at timestamptz,
  snapshot_updated_by text,
  yjs_state_base64 text,
  yjs_revision integer NOT NULL DEFAULT 0,
  yjs_updated_at timestamptz,
  yjs_updated_by text,
  CONSTRAINT collab_snapshot_complete CHECK (
    snapshot_revision IS NULL
    OR (
      snapshot_revision > 0
      AND snapshot_updated_at IS NOT NULL
      AND snapshot_updated_by IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS collab_sessions_updated_at_idx
  ON collab_sessions (updated_at DESC);

CREATE TABLE IF NOT EXISTS collab_session_audit_events (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES collab_sessions(session_id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (
    event_type IN (
      'session_created',
      'session_joined',
      'snapshot_updated',
      'yjs_updated',
      'client_kicked',
      'session_status_changed',
      'session_closed'
    )
  ),
  at timestamptz NOT NULL,
  actor text NOT NULL,
  message text NOT NULL,
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS collab_session_audit_events_session_id_at_idx
  ON collab_session_audit_events (session_id, at);
