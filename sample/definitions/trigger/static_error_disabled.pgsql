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

-- plpgsql-language-server:disable-static
create trigger update_users_2_modtime_disabled -- error silenced
  before update on users_2 for each row
  execute function update_updated_at_column ();

create trigger update_users_2_modtime -- should raise error
  before update on users_2 for each row
  execute function update_updated_at_column ();
