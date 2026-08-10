-- Fiches client, comptes-rendus et notes de séance, centralisés dans Supabase
-- (remplace le stockage local par appareil). Chaque ligne n'est visible que
-- par l'utilisateur qui l'a créée (Row Level Security).

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  address text not null default '',
  contact_info text not null default '',
  quick_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients enable row level security;

create policy "Users manage their own clients"
  on public.clients
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  patient_name text not null default '',
  content text not null default '',
  photo_paths text[] not null default '{}'::text[],
  photo_labels text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "Users manage their own reports"
  on public.reports
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Stockage des photos jointes aux comptes-rendus (bucket privé, un dossier par utilisateur)
insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', false)
on conflict (id) do nothing;

create policy "Users manage their own report photos"
  on storage.objects
  for all
  using (bucket_id = 'report-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'report-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create table public.session_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  title text not null default '',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.session_notes enable row level security;

create policy "Users manage their own session notes"
  on public.session_notes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Acceptation des conditions générales de vente et d'utilisation.
-- Une ligne par utilisateur et par version acceptée : sert de preuve du
-- consentement recueilli avant l'accès à l'application. Les lignes ne sont
-- jamais modifiables ni supprimables par l'utilisateur (pas de policy update
-- ni delete), pour que la preuve reste intacte.

create table public.cgv_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  accepted_at timestamptz not null default now(),
  user_email text not null default '',
  user_agent text not null default '',
  unique (user_id, version)
);

alter table public.cgv_acceptances enable row level security;

create policy "Users read their own CGV acceptances"
  on public.cgv_acceptances
  for select
  using (auth.uid() = user_id);

create policy "Users record their own CGV acceptance"
  on public.cgv_acceptances
  for insert
  with check (auth.uid() = user_id);
