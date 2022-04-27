DROP FUNCTION IF EXISTS update_user_update_at CASCADE;

CREATE FUNCTION update_user_update_at() RETURNS trigger AS $FUNCTION$
BEGIN
  UPDATE users SET updated_at = now();
END;
$FUNCTION$
LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS check_update_trigger ON users CASCADE;

CREATE TRIGGER check_update_trigger
    AFTER UPDATE ON users
    EXECUTE FUNCTION update_user_update_at();
