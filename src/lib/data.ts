import { supabase } from './supabase'
import type { Availability, AvailabilityRow, MatchResult, MatchStat, Profile, Squad, SquadPlayer, Standing, TeamEvent, Announcement } from './types'

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('number', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as Profile[]
}

export async function fetchEvents(from?: string, to?: string): Promise<TeamEvent[]> {
  let q = supabase.from('events').select('*').order('starts_at', { ascending: true })
  if (from) q = q.gte('starts_at', from)
  if (to) q = q.lt('starts_at', to)
  const { data, error } = await q
  if (error) throw error
  return data as TeamEvent[]
}

export async function fetchEvent(id: string): Promise<TeamEvent | null> {
  const { data, error } = await supabase.from('events').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as TeamEvent | null
}

export async function fetchNextMatch(): Promise<TeamEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('type', 'match')
    .gte('starts_at', new Date(Date.now() - 3 * 3600_000).toISOString())
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as TeamEvent | null
}

export async function fetchAvailabilities(eventIds: string[]): Promise<AvailabilityRow[]> {
  if (eventIds.length === 0) return []
  const { data, error } = await supabase.from('availabilities').select('*').in('event_id', eventIds)
  if (error) throw error
  return data as AvailabilityRow[]
}

export async function setAvailability(eventId: string, profileId: string, status: Availability): Promise<void> {
  const { error } = await supabase
    .from('availabilities')
    .upsert({ event_id: eventId, profile_id: profileId, status, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function fetchSquad(eventId: string): Promise<{ squad: Squad | null; players: SquadPlayer[] }> {
  const [{ data: squad }, { data: players }] = await Promise.all([
    supabase.from('squads').select('*').eq('event_id', eventId).maybeSingle(),
    supabase.from('squad_players').select('*').eq('event_id', eventId),
  ])
  return { squad: (squad as Squad | null) ?? null, players: (players as SquadPlayer[]) ?? [] }
}

export async function saveSquad(eventId: string, profileIds: string[], benchIds: string[]): Promise<void> {
  await supabase.from('squads').upsert({ event_id: eventId })
  await supabase.from('squad_players').delete().eq('event_id', eventId)
  const rows = [
    ...profileIds.map((profile_id) => ({ event_id: eventId, profile_id, slot: 'starter' as const })),
    ...benchIds.map((profile_id) => ({ event_id: eventId, profile_id, slot: 'bench' as const })),
  ]
  if (rows.length) {
    const { error } = await supabase.from('squad_players').insert(rows)
    if (error) throw error
  }
}

export async function publishSquad(eventId: string, byId: string, message?: string): Promise<void> {
  const { error } = await supabase
    .from('squads')
    .upsert({ event_id: eventId, published_at: new Date().toISOString(), published_by: byId, message: message ?? null })
  if (error) throw error
}

export async function fetchResults(): Promise<MatchResult[]> {
  const { data, error } = await supabase.from('match_results').select('*')
  if (error) throw error
  return data as MatchResult[]
}

export async function saveResult(eventId: string, goalsFor: number, goalsAgainst: number, summary?: string): Promise<void> {
  const { error } = await supabase
    .from('match_results')
    .upsert({ event_id: eventId, goals_for: goalsFor, goals_against: goalsAgainst, summary: summary ?? null, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function fetchStats(): Promise<MatchStat[]> {
  const { data, error } = await supabase.from('match_stats').select('*')
  if (error) throw error
  return data as MatchStat[]
}

export async function fetchAnnouncements(limit = 3): Promise<Announcement[]> {
  const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data as Announcement[]
}

export async function postAnnouncement(authorId: string, body: string): Promise<void> {
  const { error } = await supabase.from('announcements').insert({ author_id: authorId, body })
  if (error) throw error
}

export async function createEvent(e: Partial<TeamEvent> & { type: TeamEvent['type']; title: string; starts_at: string }, byId: string): Promise<string> {
  const { data, error } = await supabase.from('events').insert({ ...e, created_by: byId }).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}

export async function fetchStandings(): Promise<Standing[]> {
  const { data, error } = await supabase.from('standings').select('*')
  if (error) return []
  return sortStandings(data as Standing[])
}

/** Tri officiel simplifié : points, puis différence de buts, puis buts marqués. */
export function sortStandings(rows: Standing[]): Standing[] {
  return [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against) ||
      b.goals_for - a.goals_for ||
      a.team.localeCompare(b.team),
  )
}

export async function saveStandings(rows: Standing[]): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase.from('standings').upsert(rows.map((r) => ({ ...r, updated_at: now })))
  if (error) throw error
}

export async function fetchMatchStats(eventId: string): Promise<MatchStat[]> {
  const { data, error } = await supabase.from('match_stats').select('*').eq('event_id', eventId)
  if (error) throw error
  return data as MatchStat[]
}

/** Remplace la feuille de match d'un événement (on ne garde que les lignes non vides). */
export async function saveMatchStats(eventId: string, rows: Omit<MatchStat, 'event_id'>[]): Promise<void> {
  const { error: delErr } = await supabase.from('match_stats').delete().eq('event_id', eventId)
  if (delErr) throw delErr
  const keep = rows.filter((r) => r.played || r.goals || r.assists || r.yellow || r.red)
  if (keep.length === 0) return
  const { error } = await supabase.from('match_stats').insert(keep.map((r) => ({ ...r, event_id: eventId })))
  if (error) throw error
}

export async function updateProfile(id: string, patch: Partial<Profile>): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', id)
  if (error) throw error
}
