-- plpgsql-language-server:use-positional-query-parameter number=2

SELECT
  id,
  name,
  'This text contains "$3" :('
FROM
  users
WHERE
  id = $1 AND name = ANY($2);
