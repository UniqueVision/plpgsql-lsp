-- plpgsql-language-server:use-keyword-query-parameter keywords=[id, names]

SELECT
  id,
  name,
  'This text contains "@tags" :('
FROM
  users
WHERE
  id = @id AND name = ANY(@names);
