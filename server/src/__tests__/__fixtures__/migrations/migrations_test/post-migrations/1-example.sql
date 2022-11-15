create or replace function before_update_updated_at ()
  returns trigger
  as $BODY$
begin
  if row (new.*::text) is distinct from row (old.*::text) then
    new.updated_at = NOW();
  end if;
  return NEW;
end;
$BODY$
language plpgsql;
