CREATE SEQUENCE app_user_session_identity_seq
  AS bigint
  START WITH -2
  INCREMENT BY -1
  MAXVALUE -2
  MINVALUE -9007199254740991
  NO CYCLE;

ALTER TABLE app_users
  ADD COLUMN session_identity_id bigint;

UPDATE app_users
SET session_identity_id = nextval('app_user_session_identity_seq')
WHERE session_identity_id IS NULL;

ALTER TABLE app_users
  ALTER COLUMN session_identity_id SET DEFAULT nextval('app_user_session_identity_seq'),
  ALTER COLUMN session_identity_id SET NOT NULL,
  ADD CONSTRAINT app_users_session_identity_id_negative
    CHECK (session_identity_id BETWEEN -9007199254740991 AND -2),
  ADD CONSTRAINT app_users_session_identity_id_unique UNIQUE (session_identity_id);
