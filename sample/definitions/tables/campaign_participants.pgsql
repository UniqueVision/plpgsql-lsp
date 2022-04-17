DROP TABLE IF EXISTS campaign.participants CASCADE;

CREATE TABLE campaign.participants (
  id integer not null PRIMARY KEY,
  name varchar(10) not null,
  created_at timestamp with time zone not null DEFAULT now(),
  deleted_at timestamp with time zone CHECK (deleted_at > created_at)
)
  PARTITION BY HASH (id);
