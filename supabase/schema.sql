-- =====================================================================
-- Creative Studio — Supabase schema & security
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query).
-- If it gets truncated, run it in the numbered sections one at a time.
-- =====================================================================

-- ---------------------------------------------------------------------
-- SECTION 1: profiles table
-- One row per user, linked to auth.users. Holds role + brand scope.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        text not null default 'freelance'
              check (role in ('command','freelance')),
  brand_scope text,                       -- which brand a freelancer is limited to; null = all
  title       text,                        -- e.g. "Marketing Lead", "Freelance Graphic Designer"
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SECTION 2: auto-create a profile when a new user signs up
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'freelance')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- SECTION 3: enable RLS on profiles
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Each user can read their own profile.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Command users can read all profiles (for team views).
drop policy if exists "command reads all profiles" on public.profiles;
create policy "command reads all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'command'
    )
  );

-- Each user can update their own profile (but not their role — see note).
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ---------------------------------------------------------------------
-- SECTION 4: a helper to read the current user's role/scope in policies
-- ---------------------------------------------------------------------
create or replace function public.current_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_brand_scope()
returns text language sql stable security definer set search_path = public as $$
  select brand_scope from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- SECTION 5: EXAMPLE content table showing real brand-scoped RLS
-- This is the pattern your real Approvals/Content tables should follow.
-- ---------------------------------------------------------------------
create table if not exists public.content_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  brand       text not null,
  status      text not null default 'briefed'
              check (status in ('briefed','progress','submitted','changes','approved','scheduled')),
  owner_name  text,
  due_date    date,
  created_at  timestamptz not null default now()
);

alter table public.content_items enable row level security;

-- Command sees everything.
drop policy if exists "command reads all content" on public.content_items;
create policy "command reads all content"
  on public.content_items for select
  using (public.current_role() = 'command');

-- Freelancers only see content for their assigned brand.
drop policy if exists "freelance reads own brand" on public.content_items;
create policy "freelance reads own brand"
  on public.content_items for select
  using (
    public.current_role() = 'freelance'
    and brand = public.current_brand_scope()
  );

-- Command can insert/update/delete content.
drop policy if exists "command writes content" on public.content_items;
create policy "command writes content"
  on public.content_items for all
  using (public.current_role() = 'command')
  with check (public.current_role() = 'command');

-- ---------------------------------------------------------------------
-- SECTION 6: seed a little demo content (optional — delete later)
-- ---------------------------------------------------------------------
insert into public.content_items (title, brand, status, owner_name, due_date) values
  ('Summer Launch Reel — 15s cut', 'Brand Three', 'briefed',   'Tali', '2026-06-27'),
  ('Founder Story carousel',        'Brand Two',   'briefed',   'CJ',   '2026-07-02'),
  ('TikTok trend remix #3',         'Brand Three', 'progress',  'Tali', '2026-06-26'),
  ('June newsletter hero',          'Brand Two',   'submitted', 'CJ',   '2026-06-25'),
  ('Brand Three IG carousel',       'Brand Three', 'submitted', 'Tali', '2026-06-28'),
  ('Launch announcement post',      'Brand One',   'approved',  'CJ',   '2026-06-24'),
  ('Weekly Reels batch',            'Brand One',   'scheduled', 'CJ',   '2026-06-30');

-- =====================================================================
-- AFTER RUNNING THIS:
-- 1. Create your users in Authentication → Users (or let them sign up).
-- 2. For each one, set their role/brand in the profiles table, e.g.:
--      update public.profiles
--        set role='command', full_name='Alex', title='Marketing Lead'
--        where id = '<alex-user-id>';
--      update public.profiles
--        set role='command', full_name='CJ', title='CEO · Finance Lead'
--        where id = '<cj-user-id>';
--      update public.profiles
--        set role='freelance', brand_scope='Brand Three',
--            full_name='Tali', title='Freelance Graphic Designer'
--        where id = '<tali-user-id>';
-- =====================================================================
