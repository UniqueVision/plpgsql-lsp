DROP FUNCTION IF EXISTS warning_function_unused_variable;

CREATE OR REPLACE FUNCTION warning_function_unused_variable(
  p_id uuid
)
RETURNS SETOF uuid AS $FUNCTION$
DECLARE
  w_id uuid;
BEGIN
  RETURN QUERY
  SELECT
    p_id;
END;
$FUNCTION$ LANGUAGE plpgsql;
