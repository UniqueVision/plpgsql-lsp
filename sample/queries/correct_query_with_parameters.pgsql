/* plpgsql-language-server:query-parameter-number 2 */

SELECT
  id,
  name
FROM
  users
WHERE
  id = $1 AND name = ANY($2);
