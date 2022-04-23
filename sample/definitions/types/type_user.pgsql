DROP TYPE IF EXISTS type_user CASCADE;

CREATE TYPE type_user AS (
  id uuid,
  name text
);
