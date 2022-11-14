do $BODY$
begin
  drop function before_update_updated_at; -- ensure fail when not found
end;
$BODY$
language plpgsql;
