CREATE TABLE IF NOT EXISTS app_demo_drawings (
  path text PRIMARY KEY,
  revision integer NOT NULL DEFAULT 1,
  content jsonb NOT NULL,
  demo_content jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
