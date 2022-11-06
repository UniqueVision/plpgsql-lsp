-- plpgsql-language-server:use-keyword-query-parameters

-- name: ListUser :many
SELECT
  id,
  name
FROM
  users
WHERE
  id = sqlc.arg('id');

-- name: ListUsers :many
SELECT
  id,
  name
FROM
  users
WHERE
  name = ANY(@names);
