-- Migration 005 : statut administrateur (César uniquement) + classement de la poule
-- À coller dans Supabase → SQL Editor → Run.

-- ---------- Administrateur ----------
alter table profiles add column if not exists is_admin boolean not null default false;

-- L'admin a tous les droits du staff
create or replace function is_staff() returns boolean
language sql stable security definer as $$
  select exists (select 1 from profiles where id = auth.uid() and (role in ('coach', 'staff') or is_admin));
$$;

create or replace function is_captain_or_staff() returns boolean
language sql stable security definer as $$
  select exists (select 1 from profiles where id = auth.uid() and (role in ('captain', 'coach', 'staff') or is_admin));
$$;

-- Seul un admin peut donner ou retirer le statut admin, et personne ne peut modifier le rôle d'un admin à sa place.
-- (Les requêtes lancées depuis l'éditeur SQL de Supabase ne sont pas concernées.)
create or replace function protect_admin() returns trigger
language plpgsql security definer as $$
declare
  caller_is_admin boolean;
begin
  if auth.uid() is null then
    return new;
  end if;
  select coalesce(is_admin, false) into caller_is_admin from profiles where id = auth.uid();
  if new.is_admin is distinct from old.is_admin and not coalesce(caller_is_admin, false) then
    raise exception 'admin_only';
  end if;
  if old.is_admin and old.id <> auth.uid() and new.role is distinct from old.role then
    raise exception 'admin_protected';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_admin on profiles;
create trigger protect_admin before update on profiles for each row execute function protect_admin();

-- Personne ne peut supprimer un profil admin
create or replace function protect_admin_delete() returns trigger
language plpgsql security definer as $$
begin
  if old.is_admin and auth.uid() is not null and auth.uid() <> old.id then
    raise exception 'admin_protected';
  end if;
  return old;
end;
$$;
drop trigger if exists protect_admin_delete on profiles;
create trigger protect_admin_delete before delete on profiles for each row execute function protect_admin_delete();

-- César : joueur + administrateur
update profiles set role = 'player', is_admin = true where first_name = 'César';

-- ---------- Classement de la poule ----------
create table if not exists standings (
  team        text primary key,
  is_us       boolean not null default false,
  played      int not null default 0,
  won         int not null default 0,
  drawn       int not null default 0,
  lost        int not null default 0,
  goals_for   int not null default 0,
  goals_against int not null default 0,
  points      int not null default 0,
  updated_at  timestamptz not null default now()
);
alter table standings enable row level security;
drop policy if exists "standings read" on standings;
drop policy if exists "standings write" on standings;
create policy "standings read"  on standings for select using (is_member());
create policy "standings write" on standings for all    using (is_staff()) with check (is_staff());

-- Classement D2 poule B au 5 novembre 2026 (source : Score'n'co)
insert into standings (team, is_us, played, won, drawn, lost, goals_for, goals_against, points) values
  ('EUGA Ardziv 2',            true,  7, 6, 0, 1, 18,  7, 18),
  ('CA Plan de Cuques',        false, 7, 6, 0, 1, 22, 12, 18),
  ('US Farenque 2',            false, 7, 4, 0, 3, 15, 19, 12),
  ('Saint-Henri FC',           false, 7, 4, 0, 3, 17,  9, 12),
  ('FC Algérien',              false, 6, 3, 1, 2, 20, 17, 10),
  ('JO St Gabriel',            false, 7, 3, 1, 3, 11, 11, 10),
  ('SC Vitrolles',             false, 7, 3, 1, 3, 13, 12, 10),
  ('SC Allauch',               false, 7, 3, 1, 3, 15, 20, 10),
  ('Burel FC',                 false, 7, 3, 0, 4, 13, 14,  9),
  ('SMUC 2',                   false, 7, 2, 1, 4, 11,  9,  7),
  ('SO Septèmes',              false, 7, 2, 1, 4, 11, 17,  7),
  ('JS Pennes Mirabeau',       false, 6, 2, 0, 4,  7, 11,  6),
  ('Grand St Barthélemy',      false, 7, 1, 3, 3, 10, 20,  6),
  ('AS Marseillaise St Loup',  false, 7, 1, 1, 5, 12, 17,  4)
on conflict (team) do nothing;
