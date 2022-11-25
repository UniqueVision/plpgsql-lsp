-- plpgsql-language-server:use-keyword-query-parameter

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

-- name: DoNotValidate :many
-- plpgsql-language-server:disable
SELECT
  id,
  name
FROM
  users
WHERE
  name = ANY(@names);
