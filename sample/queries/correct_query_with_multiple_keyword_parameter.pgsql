-- plpgsql-language-server:use-keyword-query-parameter
SELECT
  id,
  name
FROM
  users
WHERE
  id = sqlc.arg('id') AND name = ANY(@names);
