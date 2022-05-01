DROP DOMAIN IF EXISTS us_postal_code;

CREATE DOMAIN us_postal_code AS text
CHECK(
   VALUE ~ '^\d{5}$'
OR VALUE ~ '^\d{5}-\d{4}$'
);
