DROP DOMAIN IF EXISTS public.jp_postal_code;

CREATE DOMAIN public.jp_postal_code AS text
CHECK(
   VALUE ~ '^\d{3}-\d{4}$'
);
