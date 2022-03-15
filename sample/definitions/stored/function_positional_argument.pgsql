DROP FUNCTION IF EXISTS function_positional_argument;

CREATE FUNCTION function_positional_argument(
  integer,
  integer
)
RETURNS integer AS
  'select $1 + $2;'
LANGUAGE SQL
IMMUTABLE
RETURNS NULL ON NULL INPUT;
