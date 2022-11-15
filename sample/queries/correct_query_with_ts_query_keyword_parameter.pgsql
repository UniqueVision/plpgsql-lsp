-- plpgsql-language-server:use-keyword-query-parameter

SELECT
  id,
  LOWER(TS_HEADLINE('english', COALESCE(name, ''),
    WEBSEARCH_TO_TSQUERY('english', @query), 'StartSel=<--,StopSel=-->, FragmentDelimiter=$#$')) as headline,
  LOWER(TS_HEADLINE('english', COALESCE(name, ''),
    WEBSEARCH_TO_TSQUERY('english', sqlc.arg('query2')), 'StartSel=<--,StopSel=-->, FragmentDelimiter=$#$')) as headline2
FROM
  users
WHERE
  id = @id;
