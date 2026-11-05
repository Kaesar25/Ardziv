-- Migration 007 : V3 (1re partie) — entraînement, espace staff, cohésion.
-- Exercices avec schémas, planification des séances, ressenti après l'entraînement,
-- tests physiques, programmes individuels, objectifs, entretiens, dossiers administratifs,
-- charte d'équipe, boîte à idées et humeur anonymes.

-- ============ Bibliothèque d'exercices ============
create table if not exists exercises (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  category       text not null default 'technique',
  duration_min   int,
  players_count  text,
  material       text,
  description    text,
  coaching       text[] not null default '{}',
  diagram        jsonb not null default '{"items":[],"arrows":[]}',
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
alter table exercises enable row level security;
drop policy if exists "exercises read" on exercises;
drop policy if exists "exercises write" on exercises;
create policy "exercises read"  on exercises for select using (is_member());
create policy "exercises write" on exercises for all using (is_staff()) with check (is_staff());

-- ============ Plan de séance (objectif du jour) ============
create table if not exists training_plans (
  event_id    uuid primary key references events(id) on delete cascade,
  objective   text,
  theme       text,
  blocks      jsonb not null default '[]',
  updated_at  timestamptz not null default now()
);
alter table training_plans enable row level security;
drop policy if exists "tplans read" on training_plans;
drop policy if exists "tplans write" on training_plans;
create policy "tplans read"  on training_plans for select using (is_member());
create policy "tplans write" on training_plans for all using (is_staff()) with check (is_staff());

-- ============ Ressenti après l'entraînement ============
create table if not exists training_feedback (
  event_id    uuid not null references events(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  fatigue     int not null check (fatigue between 1 and 5),
  intensity   int not null check (intensity between 1 and 10),
  comment     text,
  created_at  timestamptz not null default now(),
  primary key (event_id, profile_id)
);
alter table training_feedback enable row level security;
drop policy if exists "feedback own" on training_feedback;
drop policy if exists "feedback staff" on training_feedback;
create policy "feedback own"   on training_feedback for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "feedback staff" on training_feedback for select using (is_staff());

-- ============ Tests physiques ============
create table if not exists test_results (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  test        text not null,
  value       numeric not null,
  tested_on   date not null default current_date,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table test_results enable row level security;
drop policy if exists "tests own read" on test_results;
drop policy if exists "tests own write" on test_results;
drop policy if exists "tests staff" on test_results;
create policy "tests own read"  on test_results for select using (profile_id = auth.uid());
create policy "tests own write" on test_results for insert with check (profile_id = auth.uid());
create policy "tests staff"     on test_results for all using (is_staff()) with check (is_staff());

-- ============ Programmes individuels ============
create table if not exists programs (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  kind         text not null default 'extra' check (kind in ('ete', 'reprise', 'extra', 'individuel')),
  description  text,
  sessions     jsonb not null default '[]',
  assigned_to  uuid[],              -- null = tout le groupe
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create table if not exists program_progress (
  program_id    uuid not null references programs(id) on delete cascade,
  profile_id    uuid not null references profiles(id) on delete cascade,
  session_index int not null,
  done_at       timestamptz not null default now(),
  primary key (program_id, profile_id, session_index)
);
alter table programs enable row level security;
alter table program_progress enable row level security;
drop policy if exists "programs read" on programs;
drop policy if exists "programs write" on programs;
create policy "programs read"  on programs for select using (is_staff() or (is_member() and (assigned_to is null or auth.uid() = any(assigned_to))));
create policy "programs write" on programs for all using (is_staff()) with check (is_staff());
drop policy if exists "progress own" on program_progress;
drop policy if exists "progress staff" on program_progress;
create policy "progress own"   on program_progress for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "progress staff" on program_progress for select using (is_staff());

-- ============ Objectifs individuels (joueur + staff) ============
create table if not exists player_goals (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  title       text not null,
  detail      text,
  done        boolean not null default false,
  due         date,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table player_goals enable row level security;
drop policy if exists "goals own" on player_goals;
drop policy if exists "goals own done" on player_goals;
drop policy if exists "goals staff" on player_goals;
create policy "goals own"      on player_goals for select using (profile_id = auth.uid());
create policy "goals own done" on player_goals for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "goals staff"    on player_goals for all using (is_staff()) with check (is_staff());

-- ============ Notes d'entretien : staff uniquement ============
create table if not exists staff_notes (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  kind        text not null default 'note' check (kind in ('entretien', 'note', 'blessure')),
  body        text not null,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table staff_notes enable row level security;
drop policy if exists "notes staff" on staff_notes;
create policy "notes staff" on staff_notes for all using (is_staff()) with check (is_staff());

-- ============ Dossiers administratifs ============
create table if not exists player_admin (
  profile_id       uuid primary key references profiles(id) on delete cascade,
  licence          text not null default 'a_faire' check (licence in ('a_faire', 'en_cours', 'validee')),
  certificat_until date,
  mutation         text not null default 'non' check (mutation in ('non', 'en_cours', 'validee')),
  notes            text,
  updated_at       timestamptz not null default now()
);
alter table player_admin enable row level security;
drop policy if exists "admin own" on player_admin;
drop policy if exists "admin staff" on player_admin;
create policy "admin own"   on player_admin for select using (profile_id = auth.uid());
create policy "admin staff" on player_admin for all using (is_staff()) with check (is_staff());

-- ============ Charte d'équipe ============
alter table team_settings add column if not exists charter text;
alter table team_settings add column if not exists charter_version int not null default 1;
update team_settings set charter = coalesce(charter, $charte$Je réponds à chaque convocation et à chaque entraînement dans l'app, au plus tard 48 h avant.
J'arrive à l'heure au rendez-vous : le retard sans prévenir est une amende.
Je respecte l'arbitre, l'adversaire, mes coéquipiers et le staff, sur le terrain comme en dehors.
Je défends le maillot d'Ardziv et l'histoire du club partout où il joue.
Les décisions du coach se discutent en privé, jamais devant le groupe.
Je participe aux tâches de l'équipe (maillots, ballons, collation) quand c'est mon tour.
Je règle ma cotisation et mes amendes dans les délais.
Ce qui se dit dans le vestiaire reste dans le vestiaire.$charte$) where id = 1;

create table if not exists charter_acceptances (
  profile_id   uuid not null references profiles(id) on delete cascade,
  version      int not null,
  accepted_at  timestamptz not null default now(),
  primary key (profile_id, version)
);
alter table charter_acceptances enable row level security;
drop policy if exists "charter read" on charter_acceptances;
drop policy if exists "charter sign" on charter_acceptances;
create policy "charter read" on charter_acceptances for select using (is_member());
create policy "charter sign" on charter_acceptances for insert with check (profile_id = auth.uid());

-- ============ Boîte à idées anonyme ============
-- Aucune colonne d'auteur : l'idée est déposée par une fonction qui ne garde pas qui l'a écrite.
create table if not exists ideas (
  id          uuid primary key default gen_random_uuid(),
  body        text not null check (length(body) between 3 and 1000),
  status      text not null default 'new' check (status in ('new', 'seen', 'done', 'no')),
  reply       text,
  created_at  date not null default current_date
);
alter table ideas enable row level security;
drop policy if exists "ideas read" on ideas;
drop policy if exists "ideas staff" on ideas;
create policy "ideas read"  on ideas for select using (is_member());
create policy "ideas staff" on ideas for update using (is_staff()) with check (is_staff());
drop policy if exists "ideas staff delete" on ideas;
create policy "ideas staff delete" on ideas for delete using (is_staff());

create or replace function submit_idea(p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_member() then raise exception 'not_member'; end if;
  insert into ideas (body) values (trim(p_body));
end $$;
grant execute on function submit_idea(text) to authenticated;

-- ============ Humeur du groupe (anonyme, une réponse par semaine) ============
-- Deux tables séparées, sans lien entre elles : qui a répondu / quelles notes.
create table if not exists mood_voters (
  week_start  date not null,
  profile_id  uuid not null references profiles(id) on delete cascade,
  primary key (week_start, profile_id)
);
create table if not exists mood_scores (
  id          uuid primary key default gen_random_uuid(),  -- aléatoire : pas d'ordre de dépôt
  week_start  date not null,
  score       int not null check (score between 1 and 5)
);
alter table mood_voters enable row level security;
alter table mood_scores enable row level security;
drop policy if exists "mood voters own" on mood_voters;
create policy "mood voters own" on mood_voters for select using (profile_id = auth.uid());
-- mood_scores : aucune lecture directe, uniquement via mood_summary()

create or replace function submit_mood(p_score int) returns void
language plpgsql security definer set search_path = public as $$
declare w date := date_trunc('week', now())::date;
begin
  if not is_member() then raise exception 'not_member'; end if;
  if p_score < 1 or p_score > 5 then raise exception 'bad_score'; end if;
  insert into mood_voters (week_start, profile_id) values (w, auth.uid());
  insert into mood_scores (week_start, score) values (w, p_score);
exception when unique_violation then
  raise exception 'already_voted';
end $$;
grant execute on function submit_mood(int) to authenticated;

-- Moyenne par semaine, affichée seulement à partir de 3 réponses pour préserver l'anonymat
create or replace function mood_summary() returns table (week_start date, answers int, average numeric)
language sql stable security definer set search_path = public as $$
  select s.week_start, count(*)::int, round(avg(s.score)::numeric, 1)
  from mood_scores s
  where is_member() and s.week_start >= (current_date - interval '10 weeks')
  group by s.week_start
  having count(*) >= 3
  order by s.week_start;
$$;
grant execute on function mood_summary() to authenticated;

-- ============ Exercices de départ (modifiables par le staff) ============
insert into exercises (title, category, duration_min, players_count, material, description, coaching, diagram)
select * from (values
  ('Rondo 5 contre 2', 'echauffement', 12, '7 joueurs par carré', '4 plots, 1 ballon, chasubles',
   'Carré de 10 × 10 m. 5 joueurs autour conservent, 2 au centre récupèrent. Deux touches maximum. Le joueur qui perd le ballon passe au centre avec celui qui jouait avant lui.',
   array['Orientation du corps avant de recevoir', 'Jouer à la jambe opposée au défenseur', 'Les deux du centre pressent ensemble'],
   '{"items":[{"t":"c","x":38,"y":20},{"t":"c","x":62,"y":20},{"t":"c","x":38,"y":44},{"t":"c","x":62,"y":44},{"t":"p","x":38,"y":28},{"t":"p","x":50,"y":20},{"t":"p","x":62,"y":32},{"t":"p","x":56,"y":44},{"t":"p","x":42,"y":44},{"t":"o","x":47,"y":32},{"t":"o","x":54,"y":28},{"t":"b","x":50,"y":22}],"arrows":[{"x1":50,"y1":21,"x2":61,"y2":31,"k":"pass"},{"x1":62,"y1":33,"x2":57,"y2":43,"k":"pass"}]}'::jsonb),
  ('Conservation 4 contre 4 + 3 jokers', 'jeu', 18, '11 joueurs', 'Chasubles 3 couleurs, plots',
   'Zone de 30 × 25 m. Deux équipes de 4 et 3 jokers qui jouent toujours avec l''équipe en possession (un au centre, deux sur les côtés). 10 passes d''affilée = 1 point. 3 × 4 min.',
   array['Créer des triangles autour du porteur', 'Jouer vers l''avant dès que possible', 'Réaction immédiate à la perte : 5 secondes de pressing'],
   '{"items":[{"t":"c","x":30,"y":14},{"t":"c","x":70,"y":14},{"t":"c","x":30,"y":50},{"t":"c","x":70,"y":50},{"t":"p","x":38,"y":22},{"t":"p","x":60,"y":24},{"t":"p","x":42,"y":42},{"t":"p","x":62,"y":40},{"t":"o","x":46,"y":28},{"t":"o","x":54,"y":34},{"t":"o","x":40,"y":32},{"t":"o","x":58,"y":46},{"t":"p","x":50,"y":32},{"t":"p","x":30,"y":32},{"t":"p","x":70,"y":32},{"t":"b","x":39,"y":23}],"arrows":[{"x1":39,"y1":23,"x2":49,"y2":31,"k":"pass"},{"x1":50,"y1":32,"x2":61,"y2":39,"k":"pass"}]}'::jsonb),
  ('Centre et finition', 'finition', 15, '10 joueurs + 1 GB', 'Ballons, 4 plots, 1 grand but',
   'Le latéral lance l''ailier dans le couloir. L''ailier déborde et centre. Deux attaquants attaquent le premier et le second poteau, le milieu arrive en retrait. Alterner côté droit et côté gauche.',
   array['Le centre se fait sur un appel, pas au hasard', 'Premier poteau : attaquer le ballon', 'Le joueur en retrait reste à 12 m'],
   '{"items":[{"t":"g","x":97,"y":32},{"t":"p","x":60,"y":56},{"t":"p","x":72,"y":52},{"t":"p","x":76,"y":30},{"t":"p","x":72,"y":38},{"t":"p","x":70,"y":24},{"t":"c","x":66,"y":56},{"t":"c","x":82,"y":56},{"t":"b","x":61,"y":55}],"arrows":[{"x1":61,"y1":55,"x2":72,"y2":51,"k":"pass"},{"x1":73,"y1":52,"x2":88,"y2":54,"k":"run"},{"x1":88,"y1":54,"x2":88,"y2":28,"k":"pass"},{"x1":76,"y1":30,"x2":88,"y2":28,"k":"run"},{"x1":72,"y1":38,"x2":88,"y2":38,"k":"run"},{"x1":70,"y1":24,"x2":80,"y2":24,"k":"run"}]}'::jsonb),
  ('Sortie de balle 6 contre 4', 'tactique', 20, '10 joueurs + 1 GB', 'Chasubles, 2 mini-buts',
   'Moitié de terrain. Le gardien et 5 joueurs (4 défenseurs + 1 milieu) sortent le ballon face à 4 attaquants qui pressent. Point marqué en franchissant la ligne médiane balle au pied ou en marquant dans un des deux mini-buts.',
   array['Les centraux s''écartent, le milieu se montre entre les lignes', 'Le gardien est une solution, pas une sécurité', 'Jouer long si le pressing est bien organisé'],
   '{"items":[{"t":"g","x":4,"y":32},{"t":"p","x":8,"y":32},{"t":"p","x":20,"y":20},{"t":"p","x":20,"y":44},{"t":"p","x":30,"y":8},{"t":"p","x":30,"y":56},{"t":"p","x":34,"y":32},{"t":"o","x":28,"y":26},{"t":"o","x":28,"y":40},{"t":"o","x":40,"y":20},{"t":"o","x":40,"y":46},{"t":"g","x":50,"y":16},{"t":"g","x":50,"y":48},{"t":"b","x":9,"y":32}],"arrows":[{"x1":9,"y1":32,"x2":19,"y2":21,"k":"pass"},{"x1":20,"y1":20,"x2":29,"y2":9,"k":"pass"},{"x1":34,"y1":32,"x2":38,"y2":32,"k":"run"}]}'::jsonb),
  ('1 contre 1 en duel', 'technique', 12, '8 joueurs + 1 GB', 'Plots, ballons, 1 grand but',
   'Deux colonnes face à face à 25 m du but. L''entraîneur passe à l''attaquant, le défenseur part au même moment. L''attaquant doit éliminer et frapper en moins de 6 secondes.',
   array['Attaquer le pied d''appui du défenseur', 'Changement de rythme après la feinte', 'Le défenseur oriente vers l''extérieur'],
   '{"items":[{"t":"g","x":97,"y":32},{"t":"p","x":62,"y":32},{"t":"o","x":84,"y":32},{"t":"c","x":60,"y":24},{"t":"c","x":60,"y":40},{"t":"b","x":64,"y":32}],"arrows":[{"x1":64,"y1":32,"x2":78,"y2":26,"k":"run"},{"x1":78,"y1":26,"x2":90,"y2":30,"k":"pass"}]}'::jsonb),
  ('Fractionné 15-15', 'physique', 16, 'Tout le groupe', 'Plots tous les 5 m',
   '15 secondes de course à 100 % de la VMA, 15 secondes de récupération en marchant. 2 séries de 8 minutes, 3 minutes de récupération entre les séries. Distance par répétition = VMA × 4,2 m (ex. VMA 16 km/h → 67 m).',
   array['Partir à la bonne allure, pas trop vite', 'Récupération active, on ne s''assoit pas', 'Par groupes de VMA proche'],
   '{"items":[{"t":"c","x":15,"y":20},{"t":"c","x":85,"y":20},{"t":"c","x":15,"y":44},{"t":"c","x":85,"y":44},{"t":"p","x":17,"y":20},{"t":"p","x":17,"y":44}],"arrows":[{"x1":18,"y1":20,"x2":83,"y2":20,"k":"run"},{"x1":18,"y1":44,"x2":83,"y2":44,"k":"run"}]}'::jsonb)
) as v(title, category, duration_min, players_count, material, description, coaching, diagram)
where not exists (select 1 from exercises);
