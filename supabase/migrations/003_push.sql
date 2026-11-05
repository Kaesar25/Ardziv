-- Migration 003 : abonnements aux notifications push
-- À coller dans Supabase → SQL Editor → Run.

create table if not exists push_subscriptions (
  endpoint    text primary key,
  profile_id  uuid not null references profiles(id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_profile_idx on push_subscriptions (profile_id);

alter table push_subscriptions enable row level security;

-- Chacun gère uniquement ses propres appareils. La fonction d'envoi lit tout via la clé serveur.
drop policy if exists "push own" on push_subscriptions;
create policy "push own" on push_subscriptions for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
