DROP TABLE IF EXISTS schedule CASCADE;

CREATE TABLE schedule(
  id SERIAL PRIMARY KEY not null,
  room_name TEXT not null,
  reservation_time tsrange not null,
  EXCLUDE USING GIST (reservation_time WITH &&)
);
