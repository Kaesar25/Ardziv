// Accès aux données de la V3 (2e partie) : équipe 1, vidéo, fil, quiz, cagnottes, sponsors, suspensions, pages publiques.
import { supabase } from './supabase'
import type { TeamEvent } from './types'

const must = <T>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

// ---------------- Équipe 1 ----------------
export interface SquadMove { id: string; profile_id: string; direction: 'up' | 'down'; on_date: string; note: string | null; created_at: string }
export async function fetchMoves(): Promise<SquadMove[]> {
  return must(await supabase.from('squad_moves').select('*').order('on_date', { ascending: false })) as SquadMove[]
}
export async function addMove(profileId: string, direction: SquadMove['direction'], onDate: string, note: string | null, byId: string) {
  must(await supabase.from('squad_moves').insert({ profile_id: profileId, direction, on_date: onDate, note, created_by: byId }))
}
export async function deleteMove(id: string) {
  must(await supabase.from('squad_moves').delete().eq('id', id))
}

// ---------------- Suspensions ----------------
export interface Suspension { id: string; profile_id: string; matches: number; starts_after: string; reason: string | null }
export async function fetchSuspensions(): Promise<Suspension[]> {
  return must(await supabase.from('suspensions').select('*').order('starts_after', { ascending: false })) as Suspension[]
}
export async function addSuspension(profileId: string, matches: number, startsAfter: string, reason: string | null) {
  must(await supabase.from('suspensions').insert({ profile_id: profileId, matches, starts_after: startsAfter, reason }))
}
export async function deleteSuspension(id: string) {
  must(await supabase.from('suspensions').delete().eq('id', id))
}
/**
 * Dates de purge : les N prochains matchs officiels joués après la date de départ
 * (les matchs reportés ou annulés ne comptent pas).
 */
export function purgeMatches(s: Suspension, matches: TeamEvent[]): { list: TeamEvent[]; remaining: number; done: boolean } {
  const start = new Date(`${s.starts_after}T23:59:59`).getTime()
  const list = matches
    .filter((m) => m.type === 'match' && (m.status ?? 'scheduled') === 'scheduled' && new Date(m.starts_at).getTime() > start)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, s.matches)
  const played = list.filter((m) => new Date(m.starts_at).getTime() < Date.now()).length
  return { list, remaining: s.matches - played, done: played >= s.matches }
}

// ---------------- Vidéo ----------------
export interface Clip { id: string; event_id: string | null; url: string; title: string; start_sec: number | null; kind: 'match' | 'causerie' | 'exemple'; note: string | null; tagged: string[]; created_at: string }
export const CLIP_KINDS: Record<Clip['kind'], string> = { match: 'Action de match', causerie: 'Causerie', exemple: 'Exemple à suivre' }
export async function fetchClips(): Promise<Clip[]> {
  return must(await supabase.from('video_clips').select('*').order('created_at', { ascending: false })) as Clip[]
}
export async function saveClip(c: Omit<Clip, 'id' | 'created_at'> & { id?: string }, byId: string) {
  const row = { ...c, created_by: byId }
  if (c.id) must(await supabase.from('video_clips').update(row).eq('id', c.id))
  else must(await supabase.from('video_clips').insert(row))
}
export async function deleteClip(id: string) {
  must(await supabase.from('video_clips').delete().eq('id', id))
}
/** Lien YouTube intégrable, en démarrant au bon moment. */
export function youtubeEmbed(url: string, start: number | null): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/)
  if (!m) return null
  return `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&playsinline=1${start ? `&start=${start}` : ''}`
}
export const parseTime = (s: string): number | null => {
  const t = s.trim()
  if (!t) return null
  const parts = t.split(':').map(Number)
  if (parts.some((n) => !Number.isFinite(n))) return null
  return parts.reduce((a, n) => a * 60 + n, 0)
}
export const fmtClock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

// ---------------- Fil d'actualité et photos ----------------
export interface Post { id: string; author_id: string; body: string | null; photos: string[]; event_id: string | null; created_at: string }
export interface Like { post_id: string; profile_id: string }
export async function fetchPosts(limit = 40): Promise<{ posts: Post[]; likes: Like[]; urls: Record<string, string> }> {
  const posts = must(await supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(limit)) as Post[]
  const ids = posts.map((p) => p.id)
  const likes = ids.length ? (must(await supabase.from('post_likes').select('*').in('post_id', ids)) as Like[]) : []
  const paths = posts.flatMap((p) => p.photos)
  const urls: Record<string, string> = {}
  if (paths.length) {
    const { data } = await supabase.storage.from('photos').createSignedUrls(paths, 3600)
    for (const d of data ?? []) if (d.path && d.signedUrl) urls[d.path] = d.signedUrl
  }
  return { posts, likes, urls }
}
/** Réduit la photo (1600 px max, JPEG) avant l'envoi : rapide sur mobile et léger pour l'offre gratuite. */
export async function compressImage(file: File, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('image'))), 'image/jpeg', 0.82))
}
export async function createPost(authorId: string, body: string, files: File[], eventId: string | null) {
  const photos: string[] = []
  for (const f of files) {
    const blob = await compressImage(f)
    const path = `${authorId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
    const { error } = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' })
    if (error) throw new Error(error.message)
    photos.push(path)
  }
  must(await supabase.from('posts').insert({ author_id: authorId, body: body || null, photos, event_id: eventId }))
}
export async function deletePost(p: Post) {
  if (p.photos.length) await supabase.storage.from('photos').remove(p.photos)
  must(await supabase.from('posts').delete().eq('id', p.id))
}
export async function toggleLike(postId: string, profileId: string, on: boolean) {
  if (on) must(await supabase.from('post_likes').upsert({ post_id: postId, profile_id: profileId }))
  else must(await supabase.from('post_likes').delete().eq('post_id', postId).eq('profile_id', profileId))
}

// ---------------- Quiz ----------------
export interface QuizScore { profile_id: string; best: number; total: number }
export async function fetchQuizScores(): Promise<QuizScore[]> {
  return must(await supabase.from('quiz_scores').select('*').order('best', { ascending: false })) as QuizScore[]
}
export async function saveQuizScore(profileId: string, score: number, total: number, previous: number | null) {
  if (previous != null && previous >= score) return
  must(await supabase.from('quiz_scores').upsert({ profile_id: profileId, best: score, total, updated_at: new Date().toISOString() }))
}

// ---------------- Cagnottes ----------------
export interface Pot { id: string; title: string; description: string | null; goal: number | null; closes_on: string | null; created_at: string }
export interface Contribution { pot_id: string; profile_id: string; amount: number; received: boolean }
export async function fetchPots(): Promise<{ pots: Pot[]; contributions: Contribution[] }> {
  const [p, c] = await Promise.all([
    supabase.from('pots').select('*').order('created_at', { ascending: false }),
    supabase.from('pot_contributions').select('*'),
  ])
  return { pots: must(p) as Pot[], contributions: ((must(c) as Contribution[]) ?? []).map((x) => ({ ...x, amount: Number(x.amount) })) }
}
export async function createPot(p: Omit<Pot, 'id' | 'created_at'>, byId: string) {
  must(await supabase.from('pots').insert({ ...p, created_by: byId }))
}
export async function deletePot(id: string) {
  must(await supabase.from('pots').delete().eq('id', id))
}
export async function pledge(potId: string, profileId: string, amount: number) {
  must(await supabase.from('pot_contributions').upsert({ pot_id: potId, profile_id: profileId, amount }))
}
export async function unpledge(potId: string, profileId: string) {
  must(await supabase.from('pot_contributions').delete().eq('pot_id', potId).eq('profile_id', profileId))
}
export async function setReceived(potId: string, profileId: string, received: boolean) {
  must(await supabase.from('pot_contributions').update({ received }).eq('pot_id', potId).eq('profile_id', profileId))
}

// ---------------- Sponsors ----------------
export interface Sponsor { id: string; name: string; contact: string | null; amount: number | null; season: string; notes: string | null }
export interface SponsorItem { id: string; sponsor_id: string; label: string; due: string | null; done: boolean }
export async function fetchSponsors(): Promise<{ sponsors: Sponsor[]; items: SponsorItem[] }> {
  const [s, i] = await Promise.all([supabase.from('sponsors').select('*').order('name'), supabase.from('sponsor_items').select('*').order('due')])
  return { sponsors: must(s) as Sponsor[], items: must(i) as SponsorItem[] }
}
export async function saveSponsor(s: Omit<Sponsor, 'id'> & { id?: string }) {
  if (s.id) must(await supabase.from('sponsors').update(s).eq('id', s.id))
  else must(await supabase.from('sponsors').insert(s))
}
export async function deleteSponsor(id: string) {
  must(await supabase.from('sponsors').delete().eq('id', id))
}
export async function addSponsorItem(sponsorId: string, label: string, due: string | null) {
  must(await supabase.from('sponsor_items').insert({ sponsor_id: sponsorId, label, due }))
}
export async function setSponsorItem(id: string, done: boolean) {
  must(await supabase.from('sponsor_items').update({ done }).eq('id', id))
}
export async function deleteSponsorItem(id: string) {
  must(await supabase.from('sponsor_items').delete().eq('id', id))
}

// ---------------- Pages publiques ----------------
export interface PublicMatch {
  title: string; starts_at: string; location: string | null; is_home: boolean | null; opponent: string | null; competition: string | null; matchday: string | null; status: string | null
  result: { for: number; against: number } | null
  live: { phase: string; for: number; against: number } | null
  scorers: { name: string; goals: number }[]
}
export async function fetchPublicMatch(id: string): Promise<PublicMatch | null> {
  return (must(await supabase.rpc('public_match', { p_id: id })) as PublicMatch | null) ?? null
}
export interface PublicTeam {
  name: string; season: string
  standings: { team: string; is_us: boolean; played: number; won: number; drawn: number; lost: number; goals_for: number; goals_against: number; points: number }[]
  matches: { id: string; title: string; starts_at: string; is_home: boolean | null; opponent: string | null; matchday: string | null; status: string | null; for: number | null; against: number | null }[]
}
export async function fetchPublicTeam(): Promise<PublicTeam> {
  return must(await supabase.rpc('public_team')) as PublicTeam
}
export const publicUrl = (path: string) => `${window.location.origin}${path}`

/** Partage natif (téléphone) ou copie du lien. */
export async function shareLink(title: string, url: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) { await navigator.share({ title, url }); return 'shared' }
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch { return 'failed' }
}
