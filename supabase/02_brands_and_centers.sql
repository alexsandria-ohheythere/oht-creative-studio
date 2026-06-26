-- =====================================================================
-- Creative Studio — Migration 02: Brands as first-class entities
-- Run AFTER schema.sql, in the Supabase SQL Editor.
-- Adds a real `brands` table so you can manage 5+ brands as data
-- (voice, style, messaging, templates) instead of hardcoding them.
-- =====================================================================

-- ---------------------------------------------------------------------
-- SECTION 1: brands table — the heart of multi-brand management
-- ---------------------------------------------------------------------
create table if not exists public.brands (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  tagline       text,                      -- short descriptor
  color         text not null default '#9494AA',  -- hex used semantically in UI
  voice         text,                      -- brand voice description
  style_guide   text,                      -- style guidelines (free text / markdown)
  messaging     text[],                    -- approved messaging pillars
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.brands enable row level security;

-- Command sees & manages all brands. Freelancers see only their scoped brand.
drop policy if exists "command reads all brands" on public.brands;
create policy "command reads all brands"
  on public.brands for select
  using (public.current_role() = 'command');

drop policy if exists "freelance reads own brand" on public.brands;
create policy "freelance reads own brand"
  on public.brands for select
  using (
    public.current_role() = 'freelance'
    and name = public.current_brand_scope()
  );

drop policy if exists "command writes brands" on public.brands;
create policy "command writes brands"
  on public.brands for all
  using (public.current_role() = 'command')
  with check (public.current_role() = 'command');

-- ---------------------------------------------------------------------
-- SECTION 2: brand templates (reusable content templates per brand)
-- ---------------------------------------------------------------------
create table if not exists public.brand_templates (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid references public.brands(id) on delete cascade,
  name        text not null,
  kind        text,                        -- e.g. 'caption','carousel','email'
  body        text,
  created_at  timestamptz not null default now()
);

alter table public.brand_templates enable row level security;

drop policy if exists "command reads templates" on public.brand_templates;
create policy "command reads templates"
  on public.brand_templates for select
  using (public.current_role() = 'command');

drop policy if exists "freelance reads templates" on public.brand_templates;
create policy "freelance reads templates"
  on public.brand_templates for select
  using (
    public.current_role() = 'freelance'
    and exists (
      select 1 from public.brands b
      where b.id = brand_id and b.name = public.current_brand_scope()
    )
  );

drop policy if exists "command writes templates" on public.brand_templates;
create policy "command writes templates"
  on public.brand_templates for all
  using (public.current_role() = 'command')
  with check (public.current_role() = 'command');

-- ---------------------------------------------------------------------
-- SECTION 3: extend content_items with publishing + analytics fields
-- ---------------------------------------------------------------------
alter table public.content_items add column if not exists channel       text;     -- instagram / youtube / linkedin / tiktok
alter table public.content_items add column if not exists publish_at    timestamptz;
alter table public.content_items add column if not exists reach         integer default 0;
alter table public.content_items add column if not exists engagement    integer default 0;
alter table public.content_items add column if not exists ctr           numeric(5,2) default 0;
alter table public.content_items add column if not exists conversions   integer default 0;
alter table public.content_items add column if not exists revenue       numeric(12,2) default 0;

-- ---------------------------------------------------------------------
-- SECTION 4: seed 5 brands (edit names/colors to taste)
-- Uses the OH HEY THERE palette. Safe to re-run.
-- ---------------------------------------------------------------------
insert into public.brands (name, tagline, color, voice, style_guide, messaging) values
  ('OH HEY THERE',  'The flagship lifestyle brand',  '#EE268C',
   'Warm, witty, a little irreverent. Speaks like a clever friend, never corporate.',
   'Sentence-case headlines. Hot pink accents. Generous whitespace. Lowercase social captions.',
   array['You belong here','Made with intention','Show up as you are']),
  ('Matcha Club',   'Calm energy, daily ritual',     '#64BC46',
   'Soothing, grounded, gently aspirational. Slow-living tone.',
   'Soft greens, hand-drawn marks, lots of negative space.',
   array['Ritual over rush','Calm is a superpower','Brew slow']),
  ('Sky Studio',    'Design that breathes',          '#AED8FF',
   'Clean, confident, minimal. Lets the work speak.',
   'Sky-blue gradients, thin type, lots of air.',
   array['Less, but better','Designed to last','Clarity wins']),
  ('Lavender Lane', 'Soft, playful, unmistakably you','#FFAEF1',
   'Playful, tender, a touch whimsical. Speaks to comfort and self-expression.',
   'Lavender tones, rounded shapes, friendly type.',
   array['Soft is strong','Permission to play','Your kind of cozy']),
  ('Lime Lab',      'Bold ideas, brighter results',  '#DDEE26',
   'High-energy, sharp, results-driven. Confident and direct.',
   'Electric lime accents, bold type, high contrast.',
   array['Think loud','Bet on bold','Results, not noise'])
on conflict (name) do nothing;

-- =====================================================================
-- After running: your Brand Center, Content/Publishing/Analytics Centers
-- will read these brands automatically. Add more anytime via the UI
-- (command role) or by inserting into public.brands.
-- =====================================================================
