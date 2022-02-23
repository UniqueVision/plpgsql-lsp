CREATE VIEW garbage.deleted_users AS
SELECT
    *
FROM
    garbage.users
WHERE
    deleted_at <> NULL;
