DROP TABLE IF EXISTS users_1 CASCADE;
DROP TABLE IF EXISTS users_2 CASCADE;
DROP TABLE IF EXISTS users_3 CASCADE;

CREATE TABLE users_1 (
  id integer not null PRIMARY KEY,
  updated_at timestamp with time zone not null DEFAULT now()
);
CREATE TABLE users_2 (
  id integer not null PRIMARY KEY
);
CREATE TABLE users_3 (
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

create trigger update_users_3_modtime -- should raise error
  before update on users_3 for each row
  execute function update_updated_at_column ();

create trigger update_users_1_modtime
  before update on users_1 for each row
  execute function update_updated_at_column ();

create trigger update_users_2_modtime -- should raise error
  before update on users_2 for each row
  execute function update_updated_at_column ();
