/* plpgsql-language-server:use-positional-query-parameter */

SELECT
  id,
  name
FROM
  users
WHERE
  id = $1 AND name = ANY($2);
