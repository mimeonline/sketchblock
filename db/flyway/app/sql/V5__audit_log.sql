CREATE TABLE IF NOT EXISTS app_audit_events (
  id uuid PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id text,
  actor_username text NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('instance_owner', 'user', 'system', 'anonymous')),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  outcome text NOT NULL CHECK (outcome IN ('success', 'failure')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id text,
  session_id text
);

CREATE INDEX IF NOT EXISTS app_audit_events_occurred_at_idx
  ON app_audit_events (occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS app_audit_events_actor_idx
  ON app_audit_events (actor_id, occurred_at DESC)
  WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS app_audit_events_action_idx
  ON app_audit_events (action, occurred_at DESC);

CREATE INDEX IF NOT EXISTS app_audit_events_outcome_idx
  ON app_audit_events (outcome, occurred_at DESC);
