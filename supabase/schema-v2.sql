-- BANGLABAZAR RISING STAR — v2 upgrade migration
-- Run AFTER supabase/schema.sql, in Supabase Dashboard -> SQL Editor.
-- Safe to run more than once (all statements use IF NOT EXISTS / ON CONFLICT).
-- It adds every field the v2 admin panel needs. It never deletes data.
-- Never put the service_role key in frontend code; RLS below enforces writes.

-- Players: vice-captain, active status, date of birth, optional stats
alter table public.players add column if not exists is_vice_captain boolean not null default false;
alter table public.players add column if not exists is_active boolean not null default true;
alter table public.players add column if not exists date_of_birth date;
alter table public.players add column if not exists appearances integer;
alter table public.players add column if not exists goals integer;
alter table public.players add column if not exists assists integer;

-- Matches: competition, opponent logo, live status, goalscorers, summary
alter table public.matches add column if not exists competition text;
alter table public.matches add column if not exists opponent_logo_url text;
alter table public.matches add column if not exists goalscorers text;
alter table public.matches add column if not exists summary text;
-- Widen the status check to include Live, then re-apply it.
alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches add constraint matches_status_check
  check (status in ('upcoming', 'live', 'completed'));
-- Scores are required for completed matches, allowed (but optional) for live ones.
alter table public.matches drop constraint if exists matches_check;
alter table public.matches add constraint matches_score_check
  check ((status = 'upcoming') or (status = 'live') or (brs_score is not null and opponent_score is not null));

-- Club settings: hero subtitle (the original schema has hero_headline only)
alter table public.club_settings add column if not exists hero_subtitle text;

-- Hero banners table
create table if not exists public.hero_banners (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  headline text,
  subtitle text,
  button_text text,
  button_url text,
  is_active boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.hero_banners enable row level security;
drop policy if exists "Public can read active banners" on public.hero_banners;
create policy "Public can read active banners"
  on public.hero_banners for select using (is_active = true);
drop policy if exists "Admins can manage banners" on public.hero_banners;
create policy "Admins can manage banners"
  on public.hero_banners for all using (public.is_admin()) with check (public.is_admin());

-- Keep updated_at fresh (harmless if the function already exists)
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists players_updated_at on public.players;
create trigger players_updated_at before update on public.players
  for each row execute function public.set_updated_at();
drop trigger if exists matches_updated_at on public.matches;
create trigger matches_updated_at before update on public.matches
  for each row execute function public.set_updated_at();
drop trigger if exists news_updated_at on public.news;
create trigger news_updated_at before update on public.news
  for each row execute function public.set_updated_at();
drop trigger if exists banners_updated_at on public.hero_banners;
create trigger banners_updated_at before update on public.hero_banners
  for each row execute function public.set_updated_at();

-- Storage bucket for images (public read, admin-only write).
-- If your project does not allow this SQL, create the bucket in
-- Dashboard -> Storage instead and add the same policies there.
insert into storage.buckets (id, name, public) values ('club-images', 'club-images', true)
on conflict (id) do nothing;
drop policy if exists "Public read club-images" on storage.objects;
create policy "Public read club-images" on storage.objects
  for select using (bucket_id = 'club-images');
drop policy if exists "Admins write club-images" on storage.objects;
create policy "Admins write club-images" on storage.objects
  for insert with check (bucket_id = 'club-images' and public.is_admin());
drop policy if exists "Admins update club-images" on storage.objects;
create policy "Admins update club-images" on storage.objects
  for update using (bucket_id = 'club-images' and public.is_admin());
drop policy if exists "Admins delete club-images" on storage.objects;
create policy "Admins delete club-images" on storage.objects
  for delete using (bucket_id = 'club-images' and public.is_admin());
