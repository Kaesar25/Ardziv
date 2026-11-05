-- =====================================================================
--  ARDZIV 2 — schéma de la base de données (V1 : organisation)
--  À coller tel quel dans Supabase → SQL Editor → New query → Run.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Types ----------
create type member_role as enum ('player', 'captain', 'coach', 'staff');
create type squad_line  as enum ('GB', 'DEF', 'MIL', 'ATT');
create type event_type  as enum ('training', 'match', 'other');
create type availability_status as enum ('yes', 'maybe', 'no');
create type squad_slot  as enum ('starter', 'bench');

-- ---------- Réglages de l'équipe (une seule ligne) ----------
create table team_settings (
  id            int primary key default 1 check (id = 1),
  team_name     text not null default 'EUGA Ardziv 2',
  invite_code   text not null,
  season        text not null default '2026-2027',
  created_at    timestamptz not null default now()
);
insert into team_settings (invite_code) values ('ARDZIV2');

-- ---------- Membres ----------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  first_name  text not null,
  last_name   text,
  role        member_role not null default 'player',
  line        squad_line,
  position    text,
  number      int,
  phone       text,
  created_at  timestamptz not null default now()
);

-- ---------- Événements (entraînements, matchs) ----------
create table events (
  id                 uuid primary key default gen_random_uuid(),
  type               event_type not null,
  title              text not null,
  starts_at          timestamptz not null,
  meeting_at         timestamptz,
  location           text,
  is_home            boolean,
  opponent           text,
  competition        text,
  matchday           text,
  notes              text,
  response_deadline  timestamptz,
  created_by         uuid references profiles(id),
  created_at         timestamptz not null default now()
);
create index events_starts_at_idx on events (starts_at);

-- ---------- Disponibilités ----------
create table availabilities (
  event_id    uuid not null references events(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  status      availability_status not null,
  comment     text,
  updated_at  timestamptz not null default now(),
  primary key (event_id, profile_id)
);

-- ---------- Convocations ----------
create table squads (
  event_id      uuid primary key references events(id) on delete cascade,
  published_at  timestamptz,
  published_by  uuid references profiles(id),
  message       text
);
create table squad_players (
  event_id    uuid not null references events(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  slot        squad_slot not null default 'starter',
  primary key (event_id, profile_id)
);

-- ---------- Résultats ----------
create table match_results (
  event_id       uuid primary key references events(id) on delete cascade,
  goals_for      int not null default 0,
  goals_against  int not null default 0,
  summary        text,
  updated_at     timestamptz not null default now()
);
create table match_stats (
  event_id    uuid not null references events(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  played      boolean not null default true,
  minutes     int,
  goals       int not null default 0,
  assists     int not null default 0,
  yellow      int not null default 0,
  red         int not null default 0,
  primary key (event_id, profile_id)
);

-- ---------- Messages du capitaine / staff ----------
create table announcements (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references profiles(id),
  body        text not null,
  created_at  timestamptz not null default now()
);

-- =====================================================================
--  Fonctions utilitaires
-- =====================================================================
create or replace function is_member() returns boolean
language sql stable security definer as $$
  select exists (select 1 from profiles where id = auth.uid());
$$;

create or replace function is_staff() returns boolean
language sql stable security definer as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('coach', 'staff'));
$$;

create or replace function is_captain_or_staff() returns boolean
language sql stable security definer as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('captain', 'coach', 'staff'));
$$;

-- Rejoindre l'équipe avec le code d'invitation (crée le profil).
create or replace function join_team(code text, p_first_name text, p_last_name text default null)
returns profiles
language plpgsql security definer as $$
declare
  p profiles;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from team_settings where upper(invite_code) = upper(code)) then
    raise exception 'invalid_code';
  end if;
  insert into profiles (id, first_name, last_name)
  values (auth.uid(), p_first_name, p_last_name)
  on conflict (id) do update set first_name = excluded.first_name, last_name = excluded.last_name
  returning * into p;
  return p;
end;
$$;

-- =====================================================================
--  Sécurité (RLS)
-- =====================================================================
alter table team_settings  enable row level security;
alter table profiles       enable row level security;
alter table events         enable row level security;
alter table availabilities enable row level security;
alter table squads         enable row level security;
alter table squad_players  enable row level security;
alter table match_results  enable row level security;
alter table match_stats    enable row level security;
alter table announcements  enable row level security;

-- team_settings : lecture membres, écriture staff
create policy "settings read"  on team_settings for select using (is_member());
create policy "settings write" on team_settings for update using (is_staff());

-- profiles : tout membre lit tout le monde ; chacun modifie sa fiche ; le staff modifie tout
create policy "profiles read"        on profiles for select using (is_member());
create policy "profiles self update" on profiles for update using (id = auth.uid());
create policy "profiles staff all"   on profiles for all    using (is_staff());

-- events : lecture membres, écriture staff
create policy "events read"  on events for select using (is_member());
create policy "events write" on events for all    using (is_staff());

-- availabilities : lecture membres ; chacun gère la sienne ; staff gère tout
create policy "avail read"  on availabilities for select using (is_member());
create policy "avail self"  on availabilities for all    using (profile_id = auth.uid());
create policy "avail staff" on availabilities for all    using (is_staff());

-- squads : lecture membres (brouillon visible seulement par le staff), écriture staff
create policy "squads read"  on squads for select using (is_member() and (published_at is not null or is_staff()));
create policy "squads write" on squads for all    using (is_staff());
create policy "squad_players read"  on squad_players for select
  using (is_member() and (is_staff() or exists (select 1 from squads s where s.event_id = squad_players.event_id and s.published_at is not null)));
create policy "squad_players write" on squad_players for all using (is_staff());

-- résultats et stats : lecture membres, écriture capitaine + staff
create policy "results read"  on match_results for select using (is_member());
create policy "results write" on match_results for all    using (is_captain_or_staff());
create policy "stats read"    on match_stats   for select using (is_member());
create policy "stats write"   on match_stats   for all    using (is_captain_or_staff());

-- annonces : lecture membres, écriture capitaine + staff (auteur = soi)
create policy "ann read"  on announcements for select using (is_member());
create policy "ann write" on announcements for insert with check (is_captain_or_staff() and author_id = auth.uid());
create policy "ann own"   on announcements for delete using (author_id = auth.uid() or is_staff());

-- =====================================================================
--  Données de départ : les matchs déjà joués et à venir (D2 poule B)
-- =====================================================================
insert into events (type, title, starts_at, location, is_home, opponent, competition, matchday) values
 ('match', 'Ardziv 2 – AS Marseillaise St Loup', '2026-09-06 15:00+02', 'Stade Sévan', true,  'AS Marseillaise St Loup', 'Départemental 2', 'J1'),
 ('match', 'SO Septèmes – Ardziv 2',            '2026-09-20 15:00+02', 'Septèmes',    false, 'SO Septèmes',             'Départemental 2', 'J2'),
 ('match', 'Ardziv 2 – Burel FC',               '2026-09-27 15:00+02', 'Stade Sévan', true,  'Burel FC',                'Départemental 2', 'J3'),
 ('match', 'SC Vitrolles – Ardziv 2',           '2026-10-04 15:00+02', 'Vitrolles',   false, 'SC Vitrolles',            'Départemental 2', 'J4'),
 ('match', 'Ardziv 2 – SMUC 2',                 '2026-10-11 15:00+02', 'Stade Sévan', true,  'SMUC 2',                  'Départemental 2', 'J5'),
 ('match', 'Saint-Henri FC – Ardziv 2',         '2026-10-25 15:00+01', 'Saint-Henri', false, 'Saint-Henri FC',          'Départemental 2', 'J6'),
 ('match', 'Ardziv 2 – US Farenque 2',          '2026-11-01 12:00+01', 'Stade Sévan', true,  'US Farenque 2',           'Départemental 2', 'J7'),
 ('match', 'FC Algérien – Ardziv 2',            '2026-11-08 12:45+01', 'Extérieur',   false, 'FC Algérien',             'Départemental 2', 'J8'),
 ('match', 'Ardziv 2 – JO St Gabriel',          '2026-11-22 13:00+01', 'Stade Sévan', true,  'JO St Gabriel',           'Départemental 2', 'J9'),
 ('match', 'Grand St Barthélemy – Ardziv 2',    '2026-11-29 15:00+01', 'Extérieur',   false, 'Grand St Barthélemy',     'Départemental 2', 'J10'),
 ('match', 'Ardziv 2 – JS Pennes Mirabeau',     '2026-12-06 15:00+01', 'Stade Sévan', true,  'JS Pennes Mirabeau',      'Départemental 2', 'J11'),
 ('match', 'Ardziv 2 – SC Allauch',             '2026-12-13 13:00+01', 'Stade Sévan', true,  'SC Allauch',              'Départemental 2', 'J12'),
 ('match', 'CA Plan de Cuques – Ardziv 2',      '2027-01-10 15:00+01', 'Extérieur',   false, 'CA Plan de Cuques',       'Départemental 2', 'J13'),
 ('match', 'Ardziv 2 – SO Septèmes',            '2027-01-17 15:00+01', 'Stade Sévan', true,  'SO Septèmes',             'Départemental 2', 'J14'),
 ('match', 'Burel FC – Ardziv 2',               '2027-01-24 12:45+01', 'Extérieur',   false, 'Burel FC',                'Départemental 2', 'J15'),
 ('match', 'Ardziv 2 – SC Vitrolles',           '2027-02-07 15:00+01', 'Stade Sévan', true,  'SC Vitrolles',            'Départemental 2', 'J16'),
 ('match', 'SMUC 2 – Ardziv 2',                 '2027-02-14 15:00+01', 'Extérieur',   false, 'SMUC 2',                  'Départemental 2', 'J17');

insert into match_results (event_id, goals_for, goals_against)
select e.id, r.gf, r.ga from events e
join (values
  ('J1', 3, 1), ('J2', 2, 3), ('J3', 3, 1), ('J4', 1, 0), ('J5', 1, 0), ('J6', 2, 1), ('J7', 6, 1)
) as r(md, gf, ga) on r.md = e.matchday;

-- Entraînements récurrents (mardi et jeudi 19:15) jusqu'à la trêve
insert into events (type, title, starts_at, location)
select 'training', 'Entraînement', d + time '19:15', 'Stade Sévan'
from generate_series(date '2026-11-10', date '2026-12-17', interval '1 day') as d
where extract(dow from d) in (2, 4);
