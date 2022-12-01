DROP TABLE IF EXISTS users_2 CASCADE;

CREATE TABLE users_2 (
  id integer not null PRIMARY KEY
);

create or replace function update_updated_at_column ()
  returns trigger
  language plpgsql
  as $function$
begin
  new.updated_at = NOW();
  return new;
end;
$function$;

-- TODO some kind of flag for disabling static analysis only per statement
-- plpgsql-language-server:disable-static
create trigger update_users_2_modtime -- should raise error
  before update on users_2 for each row
  execute function update_updated_at_column ();
