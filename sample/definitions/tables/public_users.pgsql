DROP TABLE IF EXISTS public.users CASCADE;

CREATE TABLE public.users (
    id integer not null,
    name varchar(10) not null,
    deleted_at timestamp with time zone
);
