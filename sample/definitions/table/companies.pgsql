DROP TABLE IF EXISTS companies CASCADE;

CREATE TABLE companies (
  id integer not null PRIMARY KEY,
  name varchar(10) not null UNIQUE
);
