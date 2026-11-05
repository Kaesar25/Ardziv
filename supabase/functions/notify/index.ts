// Edge Function « notify » : envoie les notifications push de l'app Ardziv 2.
// Déploiement : Supabase → Edge Functions → Deploy a new function → Via Editor,
// nom « notify », coller ce fichier, décocher « Verify JWT » (la fonction vérifie elle-même).
// Secrets requis (Edge Functions → Secrets) : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type Kind = 'test' | 'squad_published' | 'remind' | 'event_created' | 'result' | 'announcement' | 'daily_reminders'
type Role = 'player' | 'captain' | 'coach' | 'staff'

interface Profile { id: string; first_name: string; role: Role; is_admin?: boolean }
interface Ev { id: string; type: string; title: string; starts_at: string; opponent: string | null; is_home: boolean | null; matchday: string | null; location: string | null }
interface Sub { endpoint: string; profile_id: string; p256dh: string; auth: string }
interface Msg { title: string; body: string; url: string; tag?: string }

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'https://ardziv.vercel.app',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const STAFF: Role[] = ['coach', 'staff']
const CAPTAIN_OR_STAFF: Role[] = ['captain', 'coach', 'staff']
const PLAYERS: Role[] = ['player', 'captain']

const TZ = 'Europe/Paris'
const when = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso))
const label = (e: Ev) =>
  e.type === 'match' ? `${e.matchday ? e.matchday + ' · ' : ''}${e.is_home ? 'vs' : 'chez'} ${e.opponent ?? e.title}` : e.title

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function sendTo(profileIds: string[], msg: Msg): Promise<number> {
  if (profileIds.length === 0) return 0
  const { data } = await admin.from('push_subscriptions').select('*').in('profile_id', profileIds)
  const subs = (data ?? []) as Sub[]
  let sent = 0
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 60 * 60 * 12 })
        sent++
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      }
    }),
  )
  return sent
}

async function players(): Promise<Profile[]> {
  const { data } = await admin.from('profiles').select('id, first_name, role').in('role', PLAYERS)
  return (data ?? []) as Profile[]
}

async function nonResponders(eventId: string): Promise<string[]> {
  const [ps, { data: av }] = await Promise.all([players(), admin.from('availabilities').select('profile_id').eq('event_id', eventId)])
  const answered = new Set((av ?? []).map((a: { profile_id: string }) => a.profile_id))
  return ps.filter((p) => !answered.has(p.id)).map((p) => p.id)
}

async function getEvent(id: string | undefined): Promise<Ev | null> {
  if (!id) return null
  const { data } = await admin.from('events').select('*').eq('id', id).maybeSingle()
  return (data as Ev | null) ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  let body: { kind?: Kind; event_id?: string } = {}
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  const kind = body.kind

  // ---------- Rappel automatique quotidien (appelé par pg_cron) ----------
  if (kind === 'daily_reminders') {
    if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) return json({ error: 'forbidden' }, 403)
    const now = new Date()
    const in48 = new Date(now.getTime() + 48 * 3600_000)
    const { data } = await admin.from('events').select('*').gte('starts_at', now.toISOString()).lt('starts_at', in48.toISOString())
    let sent = 0
    for (const e of (data ?? []) as Ev[]) {
      const ids = await nonResponders(e.id)
      sent += await sendTo(ids, { title: 'Tu viens ?', body: `${label(e)} — ${when(e.starts_at)}. Donne ta dispo en un clic.`, url: `/evenement/${e.id}`, tag: `dispo-${e.id}` })
    }
    return json({ sent })
  }

  // ---------- Appels depuis l'app : on identifie l'utilisateur ----------
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: userData } = await admin.auth.getUser(token)
  const uid = userData?.user?.id
  if (!uid) return json({ error: 'unauthenticated' }, 401)
  const { data: me } = await admin.from('profiles').select('id, first_name, role, is_admin').eq('id', uid).maybeSingle()
  const sender = me as Profile | null
  if (!sender) return json({ error: 'not_member' }, 403)

  const allow = (roles: Role[]) => !!sender.is_admin || roles.includes(sender.role)

  switch (kind) {
    case 'test': {
      const sent = await sendTo([sender.id], { title: 'Ça marche !', body: `Salut ${sender.first_name}, les notifications Ardziv 2 sont actives sur cet appareil.`, url: '/', tag: 'test' })
      return json({ sent })
    }
    case 'squad_published': {
      if (!allow(STAFF)) return json({ error: 'forbidden' }, 403)
      const e = await getEvent(body.event_id)
      if (!e) return json({ error: 'event' }, 404)
      const [ps, { data: sq }] = await Promise.all([players(), admin.from('squad_players').select('profile_id, slot').eq('event_id', e.id)])
      const inSquad = new Set((sq ?? []).map((s: { profile_id: string }) => s.profile_id))
      const url = `/evenement/${e.id}`
      const a = await sendTo(ps.filter((p) => inSquad.has(p.id)).map((p) => p.id), { title: 'Tu es convoqué', body: `${label(e)} — ${when(e.starts_at)}. Le groupe est publié.`, url, tag: `squad-${e.id}` })
      const b = await sendTo(ps.filter((p) => !inSquad.has(p.id)).map((p) => p.id), { title: 'Groupe publié', body: `Le groupe pour ${label(e)} est en ligne.`, url, tag: `squad-${e.id}` })
      return json({ sent: a + b })
    }
    case 'remind': {
      if (!allow(STAFF)) return json({ error: 'forbidden' }, 403)
      const e = await getEvent(body.event_id)
      if (!e) return json({ error: 'event' }, 404)
      const ids = await nonResponders(e.id)
      const sent = await sendTo(ids, { title: `${sender.first_name} attend ta réponse`, body: `${label(e)} — ${when(e.starts_at)}. Présent, incertain ou absent ?`, url: `/evenement/${e.id}`, tag: `dispo-${e.id}` })
      return json({ sent })
    }
    case 'event_created': {
      if (!allow(STAFF)) return json({ error: 'forbidden' }, 403)
      const e = await getEvent(body.event_id)
      if (!e) return json({ error: 'event' }, 404)
      const ps = await players()
      const sent = await sendTo(ps.map((p) => p.id), { title: e.type === 'match' ? 'Nouveau match au programme' : 'Nouvel événement', body: `${label(e)} — ${when(e.starts_at)}. Donne ta dispo.`, url: `/evenement/${e.id}`, tag: `dispo-${e.id}` })
      return json({ sent })
    }
    case 'result': {
      if (!allow(CAPTAIN_OR_STAFF)) return json({ error: 'forbidden' }, 403)
      const e = await getEvent(body.event_id)
      if (!e) return json({ error: 'event' }, 404)
      const { data: r } = await admin.from('match_results').select('goals_for, goals_against').eq('event_id', e.id).maybeSingle()
      if (!r) return json({ error: 'result' }, 404)
      const res = r as { goals_for: number; goals_against: number }
      const verdict = res.goals_for > res.goals_against ? 'Victoire' : res.goals_for === res.goals_against ? 'Match nul' : 'Défaite'
      const { data: all } = await admin.from('profiles').select('id')
      const ids = ((all ?? []) as { id: string }[]).map((p) => p.id).filter((id) => id !== sender.id)
      const sent = await sendTo(ids, { title: `${verdict} ${res.goals_for}-${res.goals_against}`, body: `${label(e)}. Le résultat est dans l'app.`, url: '/stats', tag: `result-${e.id}` })
      return json({ sent })
    }
    case 'announcement': {
      if (!allow(CAPTAIN_OR_STAFF)) return json({ error: 'forbidden' }, 403)
      const { data: ann } = await admin.from('announcements').select('body').eq('author_id', sender.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!ann) return json({ error: 'announcement' }, 404)
      const text = (ann as { body: string }).body
      const { data: all } = await admin.from('profiles').select('id')
      const ids = ((all ?? []) as { id: string }[]).map((p) => p.id).filter((id) => id !== sender.id)
      const sent = await sendTo(ids, { title: `Message de ${sender.first_name}`, body: text.length > 140 ? text.slice(0, 137) + '…' : text, url: '/', tag: 'announcement' })
      return json({ sent })
    }
    default:
      return json({ error: 'kind' }, 400)
  }
})
