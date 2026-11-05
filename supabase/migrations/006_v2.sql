-- Migration 006 : V2 — covoiturage, jour J, score en direct, homme du match,
-- caisse, tâches tournantes, sondages, tactique, fiches adversaires, reports.
-- À coller dans Supabase → SQL Editor → Run.

-- ============ Statut des événements (report / annulation) ============
alter table events add column if not exists status text not null default 'scheduled'
  check (status in ('scheduled', 'postponed', 'cancelled'));
alter table events add column if not exists status_note text;

-- ============ Covoiturage ============
create table if not exists carpools (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  driver_id     uuid not null references profiles(id) on delete cascade,
  seats         int not null default 3 check (seats between 1 and 8),
  meeting_point text,
  meeting_time  text,
  created_at    timestamptz not null default now(),
  unique (event_id, driver_id)
);
create table if not exists carpool_passengers (
  carpool_id  uuid not null references carpools(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  primary key (carpool_id, profile_id)
);
alter table carpools enable row level security;
alter table carpool_passengers enable row level security;
drop policy if exists "carpools read" on carpools;
drop policy if exists "carpools own" on carpools;
drop policy if exists "carpools staff" on carpools;
create policy "carpools read"  on carpools for select using (is_member());
create policy "carpools own"   on carpools for all using (driver_id = auth.uid()) with check (driver_id = auth.uid());
create policy "carpools staff" on carpools for all using (is_staff());
drop policy if exists "passengers read" on carpool_passengers;
drop policy if exists "passengers self" on carpool_passengers;
drop policy if exists "passengers driver" on carpool_passengers;
create policy "passengers read"   on carpool_passengers for select using (is_member());
create policy "passengers self"   on carpool_passengers for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "passengers driver" on carpool_passengers for delete using (exists (select 1 from carpools c where c.id = carpool_id and c.driver_id = auth.uid()) or is_staff());

-- ============ Jour J : déroulé + checklist staff ============
create table if not exists matchday_plans (
  event_id   uuid primary key references events(id) on delete cascade,
  timeline   jsonb not null default '[]'::jsonb,   -- [{ "time": "13:45", "label": "RDV vestiaire", "sub": "" }]
  checklist  jsonb not null default '[]'::jsonb,   -- [{ "label": "Licences", "done": false }]
  updated_at timestamptz not null default now()
);
alter table matchday_plans enable row level security;
drop policy if exists "plans read" on matchday_plans;
drop policy if exists "plans write" on matchday_plans;
create policy "plans read"  on matchday_plans for select using (is_member());
create policy "plans write" on matchday_plans for all using (is_staff()) with check (is_staff());

-- ============ Score en direct ============
create table if not exists live_matches (
  event_id      uuid primary key references events(id) on delete cascade,
  phase         text not null default 'pre' check (phase in ('pre', 'first_half', 'half_time', 'second_half', 'finished')),
  goals_for     int not null default 0,
  goals_against int not null default 0,
  started_at    timestamptz,
  updated_at    timestamptz not null default now()
);
create table if not exists live_events (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  minute      int,
  kind        text not null check (kind in ('goal_for', 'goal_against', 'yellow', 'red', 'sub', 'note')),
  profile_id  uuid references profiles(id) on delete set null,
  text        text,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);
alter table live_matches enable row level security;
alter table live_events enable row level security;
drop policy if exists "live read" on live_matches;
drop policy if exists "live write" on live_matches;
create policy "live read"  on live_matches for select using (is_member());
create policy "live write" on live_matches for all using (is_captain_or_staff()) with check (is_captain_or_staff());
drop policy if exists "live ev read" on live_events;
drop policy if exists "live ev write" on live_events;
create policy "live ev read"  on live_events for select using (is_member());
create policy "live ev write" on live_events for all using (is_captain_or_staff()) with check (is_captain_or_staff());

-- ============ Homme du match ============
create table if not exists motm_votes (
  event_id    uuid not null references events(id) on delete cascade,
  voter_id    uuid not null references profiles(id) on delete cascade,
  nominee_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (event_id, voter_id),
  check (voter_id <> nominee_id)
);
alter table motm_votes enable row level security;
drop policy if exists "motm own read" on motm_votes;
drop policy if exists "motm vote" on motm_votes;
drop policy if exists "motm change" on motm_votes;
-- Vote secret : chacun ne voit que son propre vote. Les résultats passent par motm_results().
create policy "motm own read" on motm_votes for select using (voter_id = auth.uid());
create policy "motm vote"     on motm_votes for insert with check (voter_id = auth.uid() and is_member());
create policy "motm change"   on motm_votes for update using (voter_id = auth.uid()) with check (voter_id = auth.uid());

-- Le vote se clôt 48 h après le coup d'envoi. Résultats visibles par tous après clôture, par le staff à tout moment.
create or replace function motm_results(p_event uuid)
returns table (nominee_id uuid, votes bigint, total bigint, closed boolean)
language sql stable security definer as $$
  with e as (select starts_at + interval '48 hours' < now() as closed from events where id = p_event),
       v as (select nominee_id, count(*) as votes from motm_votes where event_id = p_event group by nominee_id)
  select v.nominee_id, v.votes, (select count(*) from motm_votes where event_id = p_event), e.closed
  from v, e
  where is_member() and (e.closed or is_staff())
  order by v.votes desc;
$$;

-- Classement de la saison : nombre de fois élu homme du match (votes clôturés uniquement)
create or replace function motm_season()
returns table (profile_id uuid, wins bigint)
language sql stable security definer as $$
  with counts as (
    select mv.event_id, mv.nominee_id, count(*) as n
    from motm_votes mv join events e on e.id = mv.event_id
    where e.starts_at + interval '48 hours' < now()
    group by mv.event_id, mv.nominee_id
  ), best as (
    select event_id, max(n) as n from counts group by event_id
  )
  select c.nominee_id, count(*) as wins
  from counts c join best b on b.event_id = c.event_id and b.n = c.n
  where is_member()
  group by c.nominee_id
  order by wins desc;
$$;

-- ============ Caisse : amendes, cotisations ============
create table if not exists fines (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  kind        text not null default 'fine' check (kind in ('fine', 'dues', 'other')),
  label       text not null,
  amount      numeric(8,2) not null check (amount >= 0),
  paid        boolean not null default false,
  paid_at     timestamptz,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);
create table if not exists fine_presets (
  id      uuid primary key default gen_random_uuid(),
  label   text not null unique,
  amount  numeric(8,2) not null
);
alter table fines enable row level security;
alter table fine_presets enable row level security;
drop policy if exists "fines read" on fines;
drop policy if exists "fines write" on fines;
create policy "fines read"  on fines for select using (is_member());
create policy "fines write" on fines for all using (is_staff()) with check (is_staff());
drop policy if exists "presets read" on fine_presets;
drop policy if exists "presets write" on fine_presets;
create policy "presets read"  on fine_presets for select using (is_member());
create policy "presets write" on fine_presets for all using (is_staff()) with check (is_staff());
insert into fine_presets (label, amount) values
  ('Retard à l''entraînement', 2), ('Retard au rendez-vous du match', 5), ('Oubli de tenue', 5),
  ('Absence non prévenue', 10), ('Carton jaune pour contestation', 5), ('Cotisation', 20)
on conflict (label) do nothing;

-- ============ Tâches tournantes ============
create table if not exists duties (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  profile_id  uuid not null references profiles(id) on delete cascade,
  week_start  date not null,
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (label, week_start)
);
alter table duties enable row level security;
drop policy if exists "duties read" on duties;
drop policy if exists "duties staff" on duties;
drop policy if exists "duties self done" on duties;
create policy "duties read"      on duties for select using (is_member());
create policy "duties staff"     on duties for all using (is_captain_or_staff()) with check (is_captain_or_staff());
create policy "duties self done" on duties for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ============ Sondages ============
create table if not exists polls (
  id          uuid primary key default gen_random_uuid(),
  question    text not null,
  options     jsonb not null,               -- ["Vendredi", "Samedi"]
  multiple    boolean not null default false,
  anonymous   boolean not null default false,
  closes_at   timestamptz,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);
create table if not exists poll_votes (
  poll_id     uuid not null references polls(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  option_idx  int not null,
  primary key (poll_id, profile_id, option_idx)
);
alter table polls enable row level security;
alter table poll_votes enable row level security;
drop policy if exists "polls read" on polls;
drop policy if exists "polls write" on polls;
create policy "polls read"  on polls for select using (is_member());
create policy "polls write" on polls for all using (is_captain_or_staff()) with check (is_captain_or_staff());
drop policy if exists "pv read" on poll_votes;
drop policy if exists "pv self" on poll_votes;
create policy "pv read" on poll_votes for select
  using (profile_id = auth.uid() or (is_member() and exists (select 1 from polls p where p.id = poll_id and not p.anonymous)));
create policy "pv self" on poll_votes for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and exists (select 1 from polls p where p.id = poll_id and (p.closes_at is null or p.closes_at > now())));

create or replace function poll_counts(p_poll uuid)
returns table (option_idx int, votes bigint, voters bigint)
language sql stable security definer as $$
  select option_idx, count(*), (select count(distinct profile_id) from poll_votes where poll_id = p_poll)
  from poll_votes where poll_id = p_poll and is_member()
  group by option_idx;
$$;

-- ============ Tactique ============
create table if not exists lineups (
  event_id      uuid primary key references events(id) on delete cascade,
  formation     text not null default '4-4-2',
  positions     jsonb not null default '[]'::jsonb,   -- [{ "profile_id": "...", "x": 50, "y": 12 }]
  collective    jsonb not null default '[]'::jsonb,   -- ["Bloc haut", ...]
  individual    jsonb not null default '{}'::jsonb,   -- { "<profile_id>": ["Consigne 1", ...] }
  published     boolean not null default false,
  updated_at    timestamptz not null default now()
);
alter table lineups enable row level security;
drop policy if exists "lineups read" on lineups;
drop policy if exists "lineups write" on lineups;
create policy "lineups read"  on lineups for select using (is_member() and (published or is_staff()));
create policy "lineups write" on lineups for all using (is_staff()) with check (is_staff());

create table if not exists set_pieces (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('corner_off', 'corner_def', 'free_kick', 'penalty', 'throw_in', 'kick_off')),
  name        text not null,
  taker       text,
  description text not null default '',
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
alter table set_pieces enable row level security;
drop policy if exists "sp read" on set_pieces;
drop policy if exists "sp write" on set_pieces;
create policy "sp read"  on set_pieces for select using (is_member());
create policy "sp write" on set_pieces for all using (is_staff()) with check (is_staff());

create table if not exists opponent_scouting (
  opponent    text primary key,
  system      text,
  strengths   jsonb not null default '[]'::jsonb,
  weaknesses  jsonb not null default '[]'::jsonb,
  key_players text,
  notes       text,
  updated_at  timestamptz not null default now()
);
alter table opponent_scouting enable row level security;
drop policy if exists "scout read" on opponent_scouting;
drop policy if exists "scout write" on opponent_scouting;
create policy "scout read"  on opponent_scouting for select using (is_member());
create policy "scout write" on opponent_scouting for all using (is_staff()) with check (is_staff());
