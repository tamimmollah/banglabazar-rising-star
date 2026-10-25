-- BANGLABAZAR RISING STAR — Supabase schema + Row Level Security
-- Run this file in Supabase Dashboard -> SQL Editor, in order.
-- It creates the tables only. It does NOT create an admin user for you,
-- and it does NOT connect this ZIP export to Supabase by itself.
-- After running it, follow docs/DEPLOYMENT.md to wire the frontend client.
--
-- IMPORTANT: never put the service-role key in frontend code or in git.
-- The browser uses only the anon/public key (VITE_SUPABASE_ANON_KEY).

-- Extensions (uuid generation)
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  jersey_number integer not null,
  position text not null check (position in ('Goalkeeper', 'Defender', 'Midfielder', 'Forward')),
  nationality text,
  bio text,
  portrait_url text,
  is_captain boolean not null default false,
  is_published boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.management (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  portrait_url text,
  bio text,
  display_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  opponent text not null,
  match_date date not null,
  kickoff time not null,
  venue text,
  home_or_away text not null check (home_or_away in ('Home', 'Away')),
  status text not null check (status in ('upcoming', 'completed')) default 'upcoming',
  brs_score integer,
  opponent_score integer,
  poster_url text,
  report text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'upcoming') or (brs_score is not null and opponent_score is not null))
);

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('Match Announcement', 'Match Result', 'Player Announcement', 'Training Update', 'Club Event', 'Tournament News')),
  published_date date not null default CURRENT_DATE,
  excerpt text,
  body text,
  image_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Single-row club settings. Insert one row after creating the table and
-- update it from the admin panel; do not create extra rows in the UI.
create table if not exists public.club_settings (
  id integer primary key check (id = 1),
  club_name text not null default 'BANGLABAZAR RISING STAR',
  short_name text not null default 'BRS',
  description text,
  hero_headline text not null default 'BUILT TO COMPETE. UNITED TO WIN.',
  logo_url text,
  contact_email text,
  contact_phone text,
  location text,
  social_links jsonb not null default '{}'::jsonb,
  footer_text text,
  updated_at timestamptz not null default now()
);

insert into public.club_settings (id) values (1)
on conflict (id) do nothing;

-- Admin roles. Supabase Auth owns the user account; this table only records
-- which authenticated user is allowed to administer the club.
-- After creating your first admin user in Auth, insert their user id here:
--   insert into public.admin_roles (user_id, role)
--   values ('<auth-user-uuid>', 'admin');
create table if not exists public.admin_roles (
  user_id uuid primary key,
  role text not null check (role in ('admin', 'editor')),
  created_at timestamptz not null default now()
);

-- Helper: is the current authenticated user an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.admin_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security — enable on every table
-- Public visitors: SELECT on published rows only.
-- Admins: full SELECT / INSERT / UPDATE / DELETE.
-- Everyone else: no write access.
-- ---------------------------------------------------------------------------

alter table public.players enable row level security;
alter table public.management enable row level security;
alter table public.matches enable row level security;
alter table public.news enable row level security;
alter table public.club_settings enable row level security;
alter table public.admin_roles enable row level security;

-- Players
create policy "Public can read published players"
  on public.players for select using (is_published = true);
create policy "Admins can manage players"
  on public.players for all using (public.is_admin()) with check (public.is_admin());

-- Management
create policy "Public can read published management"
  on public.management for select using (is_published = true);
create policy "Admins can manage management"
  on public.management for all using (public.is_admin()) with check (public.is_admin());

-- Matches (public can read all matches; scores are public club results)
create policy "Public can read matches"
  on public.matches for select using (true);
create policy "Admins can manage matches"
  on public.matches for all using (public.is_admin()) with check (public.is_admin());

-- News
create policy "Public can read published news"
  on public.news for select using (is_published = true);
create policy "Admins can manage news"
  on public.news for all using (public.is_admin()) with check (public.is_admin());

-- Club settings: public read, admin write only
create policy "Public can read club settings"
  on public.club_settings for select using (true);
create policy "Admins can manage club settings"
  on public.club_settings for all using (public.is_admin()) with check (public.is_admin());

-- Admin roles: only admins can read or change roles (prevents privilege escalation)
create policy "Admins can read admin roles"
  on public.admin_roles for select using (public.is_admin());
create policy "Admins can manage admin roles"
  on public.admin_roles for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage bucket (create in Dashboard -> Storage, or with the SQL below
-- if your project allows it). Public read, authenticated admin write.
-- Bucket name used by the frontend: club-images
-- ---------------------------------------------------------------------------
-- insert into storage.buckets (id, name, public) values ('club-images', 'club-images', true)
-- on conflict (id) do nothing;
--
-- Then add storage policies in Dashboard -> Storage -> Policies, for example:
--   SELECT on storage.objects where bucket_id = 'club-images' (public)
--   INSERT / UPDATE / DELETE on storage.objects where bucket_id = 'club-images'
--   and the caller is an admin (use the same is_admin() check via a
--   storage policy, or restrict uploads to authenticated users and verify
--   admin status in the app before uploading).
--
-- NOTE: verify the storage policies in your own project before uploading
-- real portraits. Do not leave a bucket writable by anonymous users.
