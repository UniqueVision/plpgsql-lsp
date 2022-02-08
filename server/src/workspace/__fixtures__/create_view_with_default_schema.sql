CREATE VIEW public.deleted_users AS
SELECT
    *
FROM
    public.users
WHERE
    deleted_at <> NULL;
