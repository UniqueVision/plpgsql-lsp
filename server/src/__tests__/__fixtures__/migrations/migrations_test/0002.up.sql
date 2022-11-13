create table migrations_test.user_team (
  team_id int not null
  , user_id uuid not null
  , primary key (user_id , team_id)
  , foreign key (user_id) references migrations_test.users (user_id) on delete cascade
  , foreign key (team_id) references migrations_test.teams (team_id) on delete cascade
);
