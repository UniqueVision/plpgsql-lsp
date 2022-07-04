DROP FUNCTION IF EXISTS correct_function;

CREATE FUNCTION correct_function(
  p_id integer
)
RETURNS SETOF public.users AS $FUNCTION$
DECLARE
BEGIN
  RETURN QUERY
  SELECT
    id,
    name,
    company_id,
    created_at,
    updated_at,
    deleted_at
  FROM
    public.users
  WHERE
    id = p_id;
END;
$FUNCTION$ LANGUAGE plpgsql;
