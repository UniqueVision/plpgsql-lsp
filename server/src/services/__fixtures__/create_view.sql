CREATE VIEW deleted_users AS
SELECT
    *
FROM
    users
WHERE
    deleted_at <> NULL;
