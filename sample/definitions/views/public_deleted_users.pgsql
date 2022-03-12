DROP VIEW IF EXISTS public.deleted_users CASCADE;

CREATE VIEW public.deleted_users AS
SELECT
  *
FROM
  public.users
WHERE
  deleted_at <> NULL;
