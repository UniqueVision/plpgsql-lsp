DROP TABLE IF EXISTS public.users CASCADE;

CREATE TABLE public.users (
  id integer not null PRIMARY KEY,
  name varchar(10) not null,
  company_id integer not null references public.companies(id),
  created_at timestamp with time zone not null DEFAULT now(),
  deleted_at timestamp with time zone CHECK (deleted_at > created_at)
);

CREATE INDEX users_id_name_index ON public.users (id, name);
