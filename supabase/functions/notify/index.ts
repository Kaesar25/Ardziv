// Edge Function « notify » : envoie les notifications push de l'app Ardziv 2.
// Déploiement : Supabase → Edge Functions → Deploy a new function → Via Editor,
// nom « notify », coller ce fichier, décocher « Verify JWT » (la fonction vérifie elle-même).
// Secrets requis (Edge Functions → Secrets) : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type Kind =
  | 'test' | 'squad_published' | 'remind' | 'event_created' | 'result' | 'announcement' | 'daily_reminders'
  | 'event_changed' | 'live_goal' | 'live_final' | 'poll_created' | 'duties_assigned' | 'lineup_published' | 'fine_added'
  | 'program_published' | 'admin_reminder' | 'charter_updated' | 'idea_answered'
type Role = 'player' | 'captain' | 'coach' | 'staff'

interface Profile { id: string; first_name: string; role: Role; is_admin?: boolean }
interface Ev { id: string; type: string; title: string; starts_at: string; opponent: string | null; is_home: boolean | null; matchday: string | null; location: string | null; status?: string; status_note?: string | null }
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

async function everyone(exceptId?: string): Promise<string[]> {
  const { data } = await admin.from('profiles').select('id')
  return ((data ?? []) as { id: string }[]).map((p) => p.id).filter((id) => id !== exceptId)
}

async function getEvent(id: string | undefined): Promise<Ev | null> {
  if (!id) return null
  const { data } = await admin.from('events').select('*').eq('id', id).maybeSingle()
  return (data as Ev | null) ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  let body: { kind?: Kind; event_id?: string; scorer?: string | null; minute?: number | null; poll_id?: string; profile_id?: string; label?: string; amount?: number; week?: string; title?: string; profile_ids?: string[] | null } = {}
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
    // Ressenti : entraînements d'hier, joueurs présents qui n'ont pas encore répondu
    const yesterday = new Date(now.getTime() - 30 * 3600_000)
    const { data: tr } = await admin.from('events').select('*').eq('type', 'training').eq('status', 'scheduled').gte('starts_at', yesterday.toISOString()).lt('starts_at', now.toISOString())
    for (const e of (tr ?? []) as Ev[]) {
      const [{ data: present }, { data: fb }] = await Promise.all([
        admin.from('availabilities').select('profile_id').eq('event_id', e.id).eq('status', 'yes'),
        admin.from('training_feedback').select('profile_id').eq('event_id', e.id),
      ])
      const done = new Set(((fb ?? []) as { profile_id: string }[]).map((f) => f.profile_id))
      const ids = ((present ?? []) as { profile_id: string }[]).map((a) => a.profile_id).filter((id) => !done.has(id))
      sent += await sendTo(ids, { title: 'Ton ressenti d’hier ?', body: 'Fatigue et intensité de la séance, en 10 secondes.', url: `/evenement/${e.id}?onglet=ressenti`, tag: `ressenti-${e.id}` })
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
      const sent = await sendTo(ids, { title: `${verdict} ${res.goals_for}-${res.goals_against}`, body: `${label(e)}. Vote pour l'homme du match dans l'app.`, url: `/evenement/${e.id}?onglet=vote`, tag: `result-${e.id}` })
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
    case 'event_changed': {
      if (!allow(STAFF)) return json({ error: 'forbidden' }, 403)
      const e = await getEvent(body.event_id)
      if (!e) return json({ error: 'event' }, 404)
      const what = e.status === 'cancelled' ? 'Annulé' : e.status === 'postponed' ? 'Reporté' : 'Maintenu'
      const sent = await sendTo(await everyone(sender.id), { title: `${what} : ${label(e)}`, body: e.status_note || `Prévu ${when(e.starts_at)}. Détails dans l'app.`, url: `/evenement/${e.id}`, tag: `status-${e.id}` })
      return json({ sent })
    }
    case 'live_goal': {
      if (!allow(CAPTAIN_OR_STAFF)) return json({ error: 'forbidden' }, 403)
      const e = await getEvent(body.event_id)
      if (!e) return json({ error: 'event' }, 404)
      const { data: lm } = await admin.from('live_matches').select('goals_for, goals_against').eq('event_id', e.id).maybeSingle()
      const l = (lm ?? { goals_for: 0, goals_against: 0 }) as { goals_for: number; goals_against: number }
      const score = e.is_home === false ? `${e.opponent} ${l.goals_against}-${l.goals_for} Ardziv 2` : `Ardziv 2 ${l.goals_for}-${l.goals_against} ${e.opponent}`
      const who = body.scorer ? `But de ${body.scorer}` : 'But'
      const sent = await sendTo(await everyone(sender.id), { title: score, body: `${who}${body.minute ? ` (${body.minute}′)` : ''}. Suis le match en direct.`, url: `/evenement/${e.id}?onglet=jourj`, tag: `live-${e.id}` })
      return json({ sent })
    }
    case 'live_final': {
      if (!allow(CAPTAIN_OR_STAFF)) return json({ error: 'forbidden' }, 403)
      const e = await getEvent(body.event_id)
      if (!e) return json({ error: 'event' }, 404)
      const { data: lm } = await admin.from('live_matches').select('goals_for, goals_against').eq('event_id', e.id).maybeSingle()
      const l = (lm ?? { goals_for: 0, goals_against: 0 }) as { goals_for: number; goals_against: number }
      const verdict = l.goals_for > l.goals_against ? 'Victoire' : l.goals_for === l.goals_against ? 'Match nul' : 'Défaite'
      const sent = await sendTo(await everyone(sender.id), { title: `Coup de sifflet final · ${verdict} ${l.goals_for}-${l.goals_against}`, body: `${label(e)}. Vote pour l'homme du match.`, url: `/evenement/${e.id}?onglet=vote`, tag: `live-${e.id}` })
      return json({ sent })
    }
    case 'poll_created': {
      if (!allow(CAPTAIN_OR_STAFF)) return json({ error: 'forbidden' }, 403)
      const { data: poll } = await admin.from('polls').select('question').eq('id', body.poll_id ?? '').maybeSingle()
      if (!poll) return json({ error: 'poll' }, 404)
      const sent = await sendTo(await everyone(sender.id), { title: `Sondage de ${sender.first_name}`, body: (poll as { question: string }).question, url: '/groupe?onglet=sondages', tag: `poll-${body.poll_id}` })
      return json({ sent })
    }
    case 'duties_assigned': {
      if (!allow(CAPTAIN_OR_STAFF)) return json({ error: 'forbidden' }, 403)
      const { data } = await admin.from('duties').select('profile_id, label').eq('week_start', body.week ?? '')
      let sent = 0
      const byPlayer: Record<string, string[]> = {}
      for (const d of (data ?? []) as { profile_id: string; label: string }[]) (byPlayer[d.profile_id] ??= []).push(d.label)
      for (const [pid, labels] of Object.entries(byPlayer)) {
        sent += await sendTo([pid], { title: 'Ta tâche de la semaine', body: labels.join(', '), url: '/groupe?onglet=taches', tag: `duty-${body.week}` })
      }
      return json({ sent })
    }
    case 'lineup_published': {
      if (!allow(STAFF)) return json({ error: 'forbidden' }, 403)
      const e = await getEvent(body.event_id)
      if (!e) return json({ error: 'event' }, 404)
      const ps = await players()
      const sent = await sendTo(ps.map((p) => p.id), { title: 'Plan de match publié', body: `${label(e)} : composition, consignes et ton rôle.`, url: `/evenement/${e.id}?onglet=tactique`, tag: `lineup-${e.id}` })
      return json({ sent })
    }
    case 'fine_added': {
      if (!allow(STAFF)) return json({ error: 'forbidden' }, 403)
      if (!body.profile_id) return json({ error: 'profile' }, 400)
      const amount = typeof body.amount === 'number' ? `${body.amount.toFixed(body.amount % 1 ? 2 : 0)} €` : ''
      const sent = await sendTo([body.profile_id], { title: 'Caisse de l’équipe', body: `${body.label ?? 'Nouvelle ligne'}${amount ? ` · ${amount}` : ''}`, url: '/groupe?onglet=caisse', tag: 'fine' })
      return json({ sent })
    }
    case 'program_published': {
      if (!allow(STAFF)) return json({ error: 'forbidden' }, 403)
      const ids = Array.isArray(body.profile_ids) && body.profile_ids.length ? body.profile_ids : (await players()).map((p) => p.id)
      const sent = await sendTo(ids, { title: 'Nouveau programme', body: body.title ?? 'Un programme t’attend dans Entraînement.', url: '/entrainement?onglet=programmes', tag: 'program' })
      return json({ sent })
    }
    case 'admin_reminder': {
      if (!allow(STAFF)) return json({ error: 'forbidden' }, 403)
      const ids = Array.isArray(body.profile_ids) ? body.profile_ids : []
      const sent = await sendTo(ids, { title: 'Ton dossier est incomplet', body: 'Licence ou certificat médical à régler. Le détail est dans Plus → Mon suivi.', url: '/plus', tag: 'admin' })
      return json({ sent })
    }
    case 'charter_updated': {
      if (!allow(STAFF)) return json({ error: 'forbidden' }, 403)
      const sent = await sendTo(await everyone(sender.id), { title: 'Nouvelle version de la charte', body: 'Prends une minute pour la relire et la valider.', url: '/vestiaire', tag: 'charter' })
      return json({ sent })
    }
    case 'idea_answered': {
      if (!allow(STAFF)) return json({ error: 'forbidden' }, 403)
      const sent = await sendTo(await everyone(sender.id), { title: 'Boîte à idées', body: 'Le staff a répondu à une idée du groupe.', url: '/vestiaire?onglet=idees', tag: 'idea' })
      return json({ sent })
    }
    default:
      return json({ error: 'kind' }, 400)
  }
})
