DROP FUNCTION IF EXISTS positional_argument_function;

CREATE FUNCTION positional_argument_function(
  integer,
  integer
)
RETURNS integer AS
  'select $1 + $2;'
LANGUAGE SQL
IMMUTABLE
RETURNS NULL ON NULL INPUT;
