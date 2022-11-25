create table bad_migrations_test.user_team (
  team_id int not null
  , user_id uuid not null
  , primary key (user_id , team_id)
  , foreign key (user_id) references bad_migrations_test.users (user_id) on delete cascade
  -- bad fk
  , foreign key (fff) references bad_migrations_test.teams (team_id) on delete cascade
);
