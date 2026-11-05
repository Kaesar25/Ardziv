-- Migration 008 : V3 (2e partie) — lien avec l'équipe 1, vidéo, fil d'actualité et photos,
-- quiz, cagnottes, sponsors, pages publiques, suspensions, événements du club.

-- ============ Rôle « Coach équipe 1 » (lecture seule) ============
-- Le rôle n'est utilisé nulle part dans cette migration : Postgres interdit d'utiliser
-- une valeur d'enum ajoutée dans la même transaction.
alter type member_role add value if not exists 'guest';

-- Montées et descentes entre l'équipe 1 et l'équipe 2
create table if not exists squad_moves (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  direction   text not null check (direction in ('up', 'down')),
  on_date     date not null default current_date,
  note        text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table squad_moves enable row level security;
drop policy if exists "moves read" on squad_moves;
drop policy if exists "moves write" on squad_moves;
create policy "moves read"  on squad_moves for select using (is_member());
create policy "moves write" on squad_moves for all using (is_staff()) with check (is_staff());

-- ============ Événements : catégorie (équipe / club & communauté) ============
alter table events add column if not exists category text not null default 'team' check (category in ('team', 'club'));

-- ============ Suspensions officielles ============
create table if not exists suspensions (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  matches      int not null check (matches between 1 and 20),
  starts_after date not null default current_date,
  reason       text,
  created_at   timestamptz not null default now()
);
alter table suspensions enable row level security;
drop policy if exists "susp read" on suspensions;
drop policy if exists "susp write" on suspensions;
create policy "susp read"  on suspensions for select using (is_member());
create policy "susp write" on suspensions for all using (is_staff()) with check (is_staff());

-- ============ Vidéo : clips annotés (liens YouTube, Drive, Veo…) ============
create table if not exists video_clips (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid references events(id) on delete set null,
  url         text not null,
  title       text not null,
  start_sec   int,
  kind        text not null default 'match' check (kind in ('match', 'causerie', 'exemple')),
  note        text,
  tagged      uuid[] not null default '{}',
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table video_clips enable row level security;
drop policy if exists "clips read" on video_clips;
drop policy if exists "clips write" on video_clips;
create policy "clips read"  on video_clips for select using (is_member());
create policy "clips write" on video_clips for all using (is_staff()) with check (is_staff());

-- ============ Fil d'actualité et galerie ============
create table if not exists posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references profiles(id) on delete cascade,
  body        text,
  photos      text[] not null default '{}',   -- chemins dans le stockage « photos »
  event_id    uuid references events(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (coalesce(length(body), 0) > 0 or cardinality(photos) > 0)
);
create table if not exists post_likes (
  post_id     uuid not null references posts(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  primary key (post_id, profile_id)
);
alter table posts enable row level security;
alter table post_likes enable row level security;
drop policy if exists "posts read" on posts;
drop policy if exists "posts own" on posts;
drop policy if exists "posts staff" on posts;
create policy "posts read"  on posts for select using (is_member());
create policy "posts own"   on posts for all using (author_id = auth.uid()) with check (author_id = auth.uid() and is_member());
create policy "posts staff" on posts for delete using (is_staff());
drop policy if exists "likes read" on post_likes;
drop policy if exists "likes own" on post_likes;
create policy "likes read" on post_likes for select using (is_member());
create policy "likes own"  on post_likes for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Stockage privé des photos : lecture et dépôt réservés aux membres, 5 Mo max par fichier
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "photos read" on storage.objects;
drop policy if exists "photos upload" on storage.objects;
drop policy if exists "photos delete" on storage.objects;
create policy "photos read"   on storage.objects for select to authenticated using (bucket_id = 'photos' and public.is_member());
create policy "photos upload" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.is_member() and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos delete" on storage.objects for delete to authenticated using (bucket_id = 'photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

-- ============ Quiz sur l'histoire du club ============
create table if not exists quiz_scores (
  profile_id  uuid primary key references profiles(id) on delete cascade,
  best        int not null,
  total       int not null,
  updated_at  timestamptz not null default now()
);
alter table quiz_scores enable row level security;
drop policy if exists "quiz read" on quiz_scores;
drop policy if exists "quiz own" on quiz_scores;
create policy "quiz read" on quiz_scores for select using (is_member());
create policy "quiz own"  on quiz_scores for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ============ Cagnottes ============
create table if not exists pots (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  goal         numeric(8,2),
  closes_on    date,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create table if not exists pot_contributions (
  pot_id      uuid not null references pots(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  amount      numeric(8,2) not null check (amount > 0),
  received    boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (pot_id, profile_id)
);
alter table pots enable row level security;
alter table pot_contributions enable row level security;
drop policy if exists "pots read" on pots;
drop policy if exists "pots write" on pots;
create policy "pots read"  on pots for select using (is_member());
create policy "pots write" on pots for all using (is_captain_or_staff()) with check (is_captain_or_staff());
drop policy if exists "contrib read" on pot_contributions;
drop policy if exists "contrib own" on pot_contributions;
drop policy if exists "contrib staff" on pot_contributions;
create policy "contrib read"  on pot_contributions for select using (is_member());
create policy "contrib own"   on pot_contributions for all using (profile_id = auth.uid() and not received) with check (profile_id = auth.uid() and not received);
create policy "contrib staff" on pot_contributions for all using (is_captain_or_staff()) with check (is_captain_or_staff());

-- ============ Sponsors et contreparties (staff uniquement) ============
create table if not exists sponsors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  contact     text,
  amount      numeric(8,2),
  season      text not null default '2026-2027',
  notes       text,
  created_at  timestamptz not null default now()
);
create table if not exists sponsor_items (
  id          uuid primary key default gen_random_uuid(),
  sponsor_id  uuid not null references sponsors(id) on delete cascade,
  label       text not null,
  due         date,
  done        boolean not null default false
);
alter table sponsors enable row level security;
alter table sponsor_items enable row level security;
drop policy if exists "sponsors staff" on sponsors;
drop policy if exists "sponsor items staff" on sponsor_items;
create policy "sponsors staff"      on sponsors for all using (is_staff()) with check (is_staff());
create policy "sponsor items staff" on sponsor_items for all using (is_staff()) with check (is_staff());

-- ============ Pages publiques (sans connexion) ============
-- Fiche d'un match : uniquement des informations publiques (pas de numéros, pas de dispos).
create or replace function public_match(p_id uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'title', e.title, 'starts_at', e.starts_at, 'location', e.location, 'is_home', e.is_home,
    'opponent', e.opponent, 'competition', e.competition, 'matchday', e.matchday, 'status', e.status,
    'result', (select json_build_object('for', r.goals_for, 'against', r.goals_against) from match_results r where r.event_id = e.id),
    'live', (select json_build_object('phase', l.phase, 'for', l.goals_for, 'against', l.goals_against) from live_matches l where l.event_id = e.id),
    'scorers', (select coalesce(json_agg(json_build_object('name', p.first_name, 'goals', s.goals) order by s.goals desc), '[]'::json)
                from match_stats s join profiles p on p.id = s.profile_id where s.event_id = e.id and s.goals > 0)
  )
  from events e where e.id = p_id and e.type = 'match';
$$;
grant execute on function public_match(uuid) to anon, authenticated;

-- Fiche de l'équipe : classement, calendrier, résultats.
create or replace function public_team() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'name', (select team_name from team_settings where id = 1),
    'season', (select season from team_settings where id = 1),
    'standings', (select coalesce(json_agg(s order by s.points desc, (s.goals_for - s.goals_against) desc), '[]'::json) from standings s),
    'matches', (select coalesce(json_agg(json_build_object('id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'is_home', e.is_home, 'opponent', e.opponent, 'matchday', e.matchday, 'status', e.status,
                 'for', r.goals_for, 'against', r.goals_against) order by e.starts_at), '[]'::json)
                from events e left join match_results r on r.event_id = e.id where e.type = 'match')
  );
$$;
grant execute on function public_team() to anon, authenticated;
