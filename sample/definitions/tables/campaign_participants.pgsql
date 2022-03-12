DROP TABLE IF EXISTS campaign.participants CASCADE;

CREATE TABLE campaign.participants (
  id integer not null,
  name varchar(10) not null,
  deleted_at timestamp with time zone
);
