// Accès aux données de la V2 : covoiturage, jour J, direct, homme du match, caisse, tâches, sondages, tactique.
import { supabase } from './supabase'
import type {
  Carpool, CarpoolPassenger, ChecklistItem, Duty, EventStatus, Fine, FinePreset, LineupSpot, Lineup, LiveEvent, LiveKind, LiveMatch, LivePhase,
  MatchdayPlan, Poll, PollVote, Scouting, SetPiece, TimelineItem,
} from './types'

const must = <T>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

// ---------- Événements : report / annulation ----------
export async function setEventStatus(eventId: string, status: EventStatus, note: string | null) {
  must(await supabase.from('events').update({ status, status_note: note }).eq('id', eventId))
}

// ---------- Covoiturage ----------
export async function fetchCarpools(eventId: string): Promise<{ cars: Carpool[]; passengers: CarpoolPassenger[] }> {
  const cars = must(await supabase.from('carpools').select('*').eq('event_id', eventId).order('created_at')) as Carpool[]
  const passengers = cars.length
    ? (must(await supabase.from('carpool_passengers').select('*').in('carpool_id', cars.map((c) => c.id))) as CarpoolPassenger[])
    : []
  return { cars, passengers }
}
export async function offerCar(eventId: string, driverId: string, seats: number, meetingPoint: string, meetingTime: string) {
  must(await supabase.from('carpools').upsert({ event_id: eventId, driver_id: driverId, seats, meeting_point: meetingPoint || null, meeting_time: meetingTime || null }, { onConflict: 'event_id,driver_id' }))
}
export async function removeCar(carId: string) {
  must(await supabase.from('carpools').delete().eq('id', carId))
}
export async function joinCar(carId: string, profileId: string) {
  must(await supabase.from('carpool_passengers').insert({ carpool_id: carId, profile_id: profileId }))
}
export async function leaveCar(carId: string, profileId: string) {
  must(await supabase.from('carpool_passengers').delete().eq('carpool_id', carId).eq('profile_id', profileId))
}

// ---------- Jour J ----------
export async function fetchPlan(eventId: string): Promise<MatchdayPlan | null> {
  return (must(await supabase.from('matchday_plans').select('*').eq('event_id', eventId).maybeSingle()) as MatchdayPlan | null) ?? null
}
export async function savePlan(eventId: string, timeline: TimelineItem[], checklist: ChecklistItem[]) {
  must(await supabase.from('matchday_plans').upsert({ event_id: eventId, timeline, checklist, updated_at: new Date().toISOString() }))
}

// ---------- Score en direct ----------
export async function fetchLive(eventId: string): Promise<{ live: LiveMatch | null; events: LiveEvent[] }> {
  const [live, events] = await Promise.all([
    supabase.from('live_matches').select('*').eq('event_id', eventId).maybeSingle(),
    supabase.from('live_events').select('*').eq('event_id', eventId).order('created_at'),
  ])
  return { live: (live.data as LiveMatch | null) ?? null, events: (events.data as LiveEvent[]) ?? [] }
}
export async function setLive(eventId: string, patch: Partial<Pick<LiveMatch, 'phase' | 'goals_for' | 'goals_against' | 'started_at'>>) {
  must(await supabase.from('live_matches').upsert({ event_id: eventId, ...patch, updated_at: new Date().toISOString() }))
}
export async function addLiveEvent(eventId: string, byId: string, kind: LiveKind, minute: number | null, profileId: string | null, text: string | null) {
  must(await supabase.from('live_events').insert({ event_id: eventId, kind, minute, profile_id: profileId, text, created_by: byId }))
}
export async function deleteLiveEvent(id: string) {
  must(await supabase.from('live_events').delete().eq('id', id))
}
export const PHASE_LABELS: Record<LivePhase, string> = {
  pre: 'Avant-match', first_half: '1re mi-temps', half_time: 'Mi-temps', second_half: '2e mi-temps', finished: 'Terminé',
}

// ---------- Homme du match ----------
export async function fetchMyMotmVote(eventId: string, voterId: string): Promise<string | null> {
  const r = await supabase.from('motm_votes').select('nominee_id').eq('event_id', eventId).eq('voter_id', voterId).maybeSingle()
  return (r.data as { nominee_id: string } | null)?.nominee_id ?? null
}
export async function voteMotm(eventId: string, voterId: string, nomineeId: string) {
  must(await supabase.from('motm_votes').upsert({ event_id: eventId, voter_id: voterId, nominee_id: nomineeId }))
}
export async function fetchMotmResults(eventId: string): Promise<{ nominee_id: string; votes: number; total: number; closed: boolean }[]> {
  const r = await supabase.rpc('motm_results', { p_event: eventId })
  return ((r.data ?? []) as { nominee_id: string; votes: number; total: number; closed: boolean }[]).map((x) => ({ ...x, votes: Number(x.votes), total: Number(x.total) }))
}
export async function fetchMotmSeason(): Promise<{ profile_id: string; wins: number }[]> {
  const r = await supabase.rpc('motm_season')
  return ((r.data ?? []) as { profile_id: string; wins: number }[]).map((x) => ({ ...x, wins: Number(x.wins) }))
}
export const motmOpen = (startsAt: string) => {
  const t = new Date(startsAt).getTime()
  return Date.now() > t + 90 * 60_000 && Date.now() < t + 48 * 3600_000
}

// ---------- Caisse ----------
export async function fetchFines(): Promise<Fine[]> {
  const rows = must(await supabase.from('fines').select('*').order('created_at', { ascending: false })) as Fine[]
  return rows.map((f) => ({ ...f, amount: Number(f.amount) }))
}
export async function fetchFinePresets(): Promise<FinePreset[]> {
  const rows = must(await supabase.from('fine_presets').select('*').order('amount')) as FinePreset[]
  return rows.map((f) => ({ ...f, amount: Number(f.amount) }))
}
export async function addFine(profileId: string, label: string, amount: number, kind: Fine['kind'], byId: string) {
  must(await supabase.from('fines').insert({ profile_id: profileId, label, amount, kind, created_by: byId }))
}
export async function setFinePaid(id: string, paid: boolean) {
  must(await supabase.from('fines').update({ paid, paid_at: paid ? new Date().toISOString() : null }).eq('id', id))
}
export async function deleteFine(id: string) {
  must(await supabase.from('fines').delete().eq('id', id))
}
export const euros = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n)

// ---------- Tâches tournantes ----------
/** Lundi de la semaine (Europe/Paris), au format AAAA-MM-JJ. */
export function weekStart(d = new Date()): string {
  const x = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
export async function fetchDuties(fromWeek: string): Promise<Duty[]> {
  return must(await supabase.from('duties').select('*').gte('week_start', fromWeek).order('week_start')) as Duty[]
}
export async function fetchAllDuties(): Promise<Duty[]> {
  return must(await supabase.from('duties').select('*').order('week_start')) as Duty[]
}
export async function assignDuty(label: string, profileId: string, week: string) {
  must(await supabase.from('duties').upsert({ label, profile_id: profileId, week_start: week, done: false }, { onConflict: 'label,week_start' }))
}
export async function setDutyDone(id: string, done: boolean) {
  must(await supabase.from('duties').update({ done }).eq('id', id))
}

// ---------- Sondages ----------
export async function fetchPolls(): Promise<Poll[]> {
  return must(await supabase.from('polls').select('*').order('created_at', { ascending: false }).limit(20)) as Poll[]
}
export async function createPoll(question: string, options: string[], multiple: boolean, anonymous: boolean, closesAt: string | null, byId: string): Promise<string> {
  const r = must(await supabase.from('polls').insert({ question, options, multiple, anonymous, closes_at: closesAt, created_by: byId }).select('id').single()) as { id: string }
  return r.id
}
export async function deletePoll(id: string) {
  must(await supabase.from('polls').delete().eq('id', id))
}
export async function fetchPollVotes(pollIds: string[]): Promise<PollVote[]> {
  if (!pollIds.length) return []
  return must(await supabase.from('poll_votes').select('*').in('poll_id', pollIds)) as PollVote[]
}
export async function fetchPollCounts(pollId: string): Promise<{ option_idx: number; votes: number; voters: number }[]> {
  const r = await supabase.rpc('poll_counts', { p_poll: pollId })
  return ((r.data ?? []) as { option_idx: number; votes: number; voters: number }[]).map((x) => ({ option_idx: x.option_idx, votes: Number(x.votes), voters: Number(x.voters) }))
}
export async function setPollVote(pollId: string, profileId: string, options: number[]) {
  must(await supabase.from('poll_votes').delete().eq('poll_id', pollId).eq('profile_id', profileId))
  if (options.length) must(await supabase.from('poll_votes').insert(options.map((option_idx) => ({ poll_id: pollId, profile_id: profileId, option_idx }))))
}

// ---------- Tactique ----------
export async function fetchLineup(eventId: string): Promise<Lineup | null> {
  return (must(await supabase.from('lineups').select('*').eq('event_id', eventId).maybeSingle()) as Lineup | null) ?? null
}
export async function saveLineup(eventId: string, l: { formation: string; positions: LineupSpot[]; collective: string[]; individual: Record<string, string[]>; published: boolean }) {
  must(await supabase.from('lineups').upsert({ event_id: eventId, ...l, updated_at: new Date().toISOString() }))
}
export async function fetchSetPieces(): Promise<SetPiece[]> {
  return must(await supabase.from('set_pieces').select('*').order('kind').order('sort')) as SetPiece[]
}
export async function saveSetPiece(sp: Partial<SetPiece> & { kind: SetPiece['kind']; name: string }) {
  must(await supabase.from('set_pieces').upsert(sp))
}
export async function deleteSetPiece(id: string) {
  must(await supabase.from('set_pieces').delete().eq('id', id))
}
export async function fetchScouting(opponent: string): Promise<Scouting | null> {
  return (must(await supabase.from('opponent_scouting').select('*').eq('opponent', opponent).maybeSingle()) as Scouting | null) ?? null
}
export async function fetchAllScouting(): Promise<Scouting[]> {
  return must(await supabase.from('opponent_scouting').select('*').order('opponent')) as Scouting[]
}
export async function saveScouting(s: Omit<Scouting, 'updated_at'>) {
  must(await supabase.from('opponent_scouting').upsert({ ...s, updated_at: new Date().toISOString() }))
}

/** Positions types sur un terrain vertical (attaque vers le haut), x et y en %. */
export const FORMATIONS: Record<string, { x: number; y: number; line: 'GB' | 'DEF' | 'MIL' | 'ATT' }[]> = {
  '4-4-2': [
    { x: 50, y: 90, line: 'GB' },
    { x: 14, y: 72, line: 'DEF' }, { x: 38, y: 76, line: 'DEF' }, { x: 62, y: 76, line: 'DEF' }, { x: 86, y: 72, line: 'DEF' },
    { x: 14, y: 48, line: 'MIL' }, { x: 38, y: 52, line: 'MIL' }, { x: 62, y: 52, line: 'MIL' }, { x: 86, y: 48, line: 'MIL' },
    { x: 36, y: 16, line: 'ATT' }, { x: 64, y: 16, line: 'ATT' },
  ],
  '4-4-2 losange': [
    { x: 50, y: 90, line: 'GB' },
    { x: 14, y: 72, line: 'DEF' }, { x: 38, y: 76, line: 'DEF' }, { x: 62, y: 76, line: 'DEF' }, { x: 86, y: 72, line: 'DEF' },
    { x: 50, y: 58, line: 'MIL' }, { x: 24, y: 46, line: 'MIL' }, { x: 76, y: 46, line: 'MIL' }, { x: 50, y: 32, line: 'MIL' },
    { x: 36, y: 13, line: 'ATT' }, { x: 64, y: 13, line: 'ATT' },
  ],
  '4-3-3': [
    { x: 50, y: 90, line: 'GB' },
    { x: 14, y: 72, line: 'DEF' }, { x: 38, y: 76, line: 'DEF' }, { x: 62, y: 76, line: 'DEF' }, { x: 86, y: 72, line: 'DEF' },
    { x: 50, y: 56, line: 'MIL' }, { x: 28, y: 44, line: 'MIL' }, { x: 72, y: 44, line: 'MIL' },
    { x: 16, y: 20, line: 'ATT' }, { x: 50, y: 13, line: 'ATT' }, { x: 84, y: 20, line: 'ATT' },
  ],
  '4-2-3-1': [
    { x: 50, y: 90, line: 'GB' },
    { x: 14, y: 72, line: 'DEF' }, { x: 38, y: 76, line: 'DEF' }, { x: 62, y: 76, line: 'DEF' }, { x: 86, y: 72, line: 'DEF' },
    { x: 36, y: 56, line: 'MIL' }, { x: 64, y: 56, line: 'MIL' },
    { x: 17, y: 32, line: 'ATT' }, { x: 50, y: 34, line: 'ATT' }, { x: 83, y: 32, line: 'ATT' },
    { x: 50, y: 13, line: 'ATT' },
  ],
  '3-5-2': [
    { x: 50, y: 90, line: 'GB' },
    { x: 26, y: 75, line: 'DEF' }, { x: 50, y: 78, line: 'DEF' }, { x: 74, y: 75, line: 'DEF' },
    { x: 10, y: 48, line: 'MIL' }, { x: 34, y: 54, line: 'MIL' }, { x: 50, y: 40, line: 'MIL' }, { x: 66, y: 54, line: 'MIL' }, { x: 90, y: 48, line: 'MIL' },
    { x: 36, y: 15, line: 'ATT' }, { x: 64, y: 15, line: 'ATT' },
  ],
}
