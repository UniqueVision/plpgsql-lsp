/* plpgsql-language-server:disable validation */

DROP FUNCTION IF EXISTS function_column_does_not_exist;

CREATE FUNCTION function_column_does_not_exist(
  p_id integer
)
RETURNS SETOF public.users AS $FUNCTION$
DECLARE
BEGIN
  RETURN QUERY
  SELECT
    id,
    name,
    tags,
    deleted_at
  FROM
    public.users
  WHERE
    id = p_id;
END;
$FUNCTION$ LANGUAGE plpgsql;
