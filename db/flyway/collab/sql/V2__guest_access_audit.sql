-- Persist guest-access revocation boundaries in the existing session audit log.
ALTER TABLE collab_session_audit_events
  DROP CONSTRAINT collab_session_audit_events_event_type_check;

ALTER TABLE collab_session_audit_events
  ADD CONSTRAINT collab_session_audit_events_event_type_check CHECK (
    event_type IN (
      'session_created', 'session_joined', 'snapshot_updated', 'yjs_updated',
      'client_kicked', 'session_status_changed', 'session_closed', 'guest_access_changed'
    )
  );
