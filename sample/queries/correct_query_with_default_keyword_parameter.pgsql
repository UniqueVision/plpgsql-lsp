/* plpgsql-language-server:disable validation */
/* plpgsql-language-server:use-query-parameter */

SELECT
  id,
  name
FROM
  users
WHERE
  id = :id AND name = ANY(:names);
