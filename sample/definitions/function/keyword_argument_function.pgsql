DROP FUNCTION IF EXISTS keyword_argument_function;

CREATE FUNCTION keyword_argument_function(
  i integer
)
RETURNS integer
AS $$
BEGIN
  RETURN i + 1;
END;
$$
LANGUAGE plpgsql;
