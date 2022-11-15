create schema migrations_test;

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
