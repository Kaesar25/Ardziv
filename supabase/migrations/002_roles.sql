-- Migration 002 : code d'invitation staff + gestion des rôles par le staff
-- À coller dans Supabase → SQL Editor → Run.

alter table team_settings add column if not exists staff_invite_code text not null default 'ARDZIV2-STAFF';

create or replace function join_team(code text, p_first_name text, p_last_name text default null)
returns profiles
language plpgsql security definer as $$
declare
  p profiles;
  r member_role := 'player';
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from team_settings where upper(staff_invite_code) = upper(code)) then
    r := 'coach';
  elsif not exists (select 1 from team_settings where upper(invite_code) = upper(code)) then
    raise exception 'invalid_code';
  end if;
  insert into profiles (id, first_name, last_name, role)
  values (auth.uid(), p_first_name, p_last_name, r)
  on conflict (id) do update set first_name = excluded.first_name, last_name = excluded.last_name
  returning * into p;
  return p;
end;
$$;

-- Le staff peut changer le rôle d'un membre (déjà couvert par la policy "profiles staff all").
-- Un joueur ne peut pas modifier son propre rôle : on retire role du périmètre de "self update".
drop policy if exists "profiles self update" on profiles;
create policy "profiles self update" on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));
