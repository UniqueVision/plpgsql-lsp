do $BODY$
declare
  i int;
  ui uuid;
  user_ids uuid[];
begin
  for i in 1..10 loop
    insert into migrations_test.users (username , email)
      values ('user_' || i , 'user_' || i || '@email.com')
    returning
      user_id into ui;
    user_ids[i] = ui;
  end loop;

  insert into migrations_test.teams ("name")
    values ('team 1');
  insert into migrations_test.teams ("name")
    values ('team 2');

  insert into migrations_test.user_team (team_id , user_id)
    values (1 , user_ids[1]);
  insert into migrations_test.user_team (team_id , user_id)
    values (1 , user_ids[2]);
  insert into migrations_test.user_team (team_id , user_id)
    values (1 , user_ids[3]);
  insert into migrations_test.user_team (team_id , user_id)
    values (1 , user_ids[4]);
  insert into migrations_test.user_team (team_id , user_id)
    values (2 , user_ids[1]);
  insert into migrations_test.user_team (team_id , user_id)
    values (2 , user_ids[4]);
  insert into migrations_test.user_team (team_id , user_id)
    values (2 , user_ids[5]);
  insert into migrations_test.user_team (team_id , user_id)
    values (2 , user_ids[6]);
  insert into migrations_test.user_team (team_id , user_id)
    values (2 , user_ids[7]);

end;
$BODY$
language plpgsql;
