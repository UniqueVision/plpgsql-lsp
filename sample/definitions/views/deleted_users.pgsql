DROP VIEW IF EXISTS deleted_users CASCADE;

CREATE VIEW deleted_users AS
SELECT
    id,
    name
FROM
    users
WHERE
    deleted_at <> NULL;
