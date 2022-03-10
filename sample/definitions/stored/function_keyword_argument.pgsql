DROP FUNCTION IF EXISTS function_keyword_argument;

CREATE FUNCTION function_keyword_argument(
    i integer
)
RETURNS integer
AS $$
BEGIN
    RETURN i + 1;
END;
$$
LANGUAGE plpgsql;
