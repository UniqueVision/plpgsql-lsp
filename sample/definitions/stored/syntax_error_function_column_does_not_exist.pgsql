/* plpgsql-language-server:disable validation */

DROP FUNCTION IF EXISTS function_column_does_not_exist;

CREATE FUNCTION function_column_does_not_exist(
  p_id uuid
)
RETURNS SETOF public.users AS $FUNCTION$
DECLARE
BEGIN
  RETURN QUERY
  SELECT
    name,
    tags
  FROM
    public.users;
END;
$FUNCTION$ LANGUAGE plpgsql;
