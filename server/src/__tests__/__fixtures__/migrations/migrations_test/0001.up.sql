create schema if not exists migrations_test;

create table migrations_test.teams (
  team_id serial not null
  , name text not null unique
  , primary key (team_id)
);

create table migrations_test.users (
  user_id uuid default gen_random_uuid () not null
  , username text not null unique
  , email text not null unique
  , primary key (user_id)
);

create table migrations_test.user_team (
  team_id int not null
  , user_id uuid not null
  , primary key (user_id , team_id)
  , foreign key (user_id) references migrations_test.users (user_id) on delete cascade
  , foreign key (team_id) references migrations_test.teams (team_id) on delete cascade
);
