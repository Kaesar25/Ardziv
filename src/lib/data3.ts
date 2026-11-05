// Accès aux données de la V3 (1re partie) : entraînement, espace staff, cohésion.
import { supabase } from './supabase'

const must = <T>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

// ---------------- Types ----------------
export type DiagramKind = 'p' | 'o' | 'c' | 'b' | 'g' // joueur, adversaire, plot, ballon, mini-but
export interface DiagramItem { t: DiagramKind; x: number; y: number }
export interface DiagramArrow { x1: number; y1: number; x2: number; y2: number; k: 'run' | 'pass' }
export interface Diagram { items: DiagramItem[]; arrows: DiagramArrow[] }

export interface Exercise {
  id: string
  title: string
  category: string
  duration_min: number | null
  players_count: string | null
  material: string | null
  description: string | null
  coaching: string[]
  diagram: Diagram
  created_by: string | null
}
export const EX_CATEGORIES: [string, string][] = [
  ['echauffement', 'Échauffement'], ['technique', 'Technique'], ['physique', 'Physique'],
  ['tactique', 'Tactique'], ['finition', 'Finition'], ['jeu', 'Jeu réduit'], ['gardien', 'Gardiens'],
]
export const catLabel = (k: string) => EX_CATEGORIES.find(([c]) => c === k)?.[1] ?? k

export interface PlanBlock { exercise_id: string | null; label: string; minutes: number; note: string }
export interface TrainingPlan { event_id: string; objective: string | null; theme: string | null; blocks: PlanBlock[] }
export const THEMES = ['Récupération', 'Technique', 'Physique', 'Tactique', 'Veille de match', 'Mixte']

export interface Feedback { event_id: string; profile_id: string; fatigue: number; intensity: number; comment: string | null; created_at: string }

export interface TestDef { k: string; label: string; unit: string; better: 'up' | 'down'; hint: string }
export const TESTS: TestDef[] = [
  { k: 'vma', label: 'VMA', unit: 'km/h', better: 'up', hint: 'Luc-Léger, VAMEVAL ou demi-Cooper' },
  { k: 'sprint30', label: 'Sprint 30 m', unit: 's', better: 'down', hint: 'Départ arrêté, meilleur de 2 essais' },
  { k: 'sprint10', label: 'Sprint 10 m', unit: 's', better: 'down', hint: 'Accélération, départ arrêté' },
  { k: 'cmj', label: 'Détente verticale', unit: 'cm', better: 'up', hint: 'Saut contre-mouvement, mains aux hanches' },
  { k: 'yoyo', label: 'Yo-Yo IR1', unit: 'm', better: 'up', hint: 'Distance totale parcourue' },
  { k: 'gainage', label: 'Gainage', unit: 's', better: 'up', hint: 'Planche ventrale tenue' },
  { k: 'poids', label: 'Poids', unit: 'kg', better: 'down', hint: 'Le matin, à jeun' },
]
export interface TestResult { id: string; profile_id: string; test: string; value: number; tested_on: string }

export interface ProgramSession { label: string; detail: string }
export interface Program { id: string; title: string; kind: 'ete' | 'reprise' | 'extra' | 'individuel'; description: string | null; sessions: ProgramSession[]; assigned_to: string[] | null; created_at: string }
export const PROGRAM_KINDS: Record<Program['kind'], string> = { ete: 'Prépa été', reprise: 'Reprise', extra: 'Séance en plus', individuel: 'Individuel' }
export interface ProgramProgress { program_id: string; profile_id: string; session_index: number }

export interface Goal { id: string; profile_id: string; title: string; detail: string | null; done: boolean; due: string | null; created_at: string }
export interface StaffNote { id: string; profile_id: string; kind: 'entretien' | 'note' | 'blessure'; body: string; created_by: string | null; created_at: string }
export const NOTE_KINDS: Record<StaffNote['kind'], string> = { entretien: 'Entretien', note: 'Note', blessure: 'Blessure / dispo' }

export type AdminState = 'a_faire' | 'en_cours' | 'validee'
export interface PlayerAdmin { profile_id: string; licence: AdminState; certificat_until: string | null; mutation: 'non' | 'en_cours' | 'validee'; notes: string | null }
export const ADMIN_LABELS: Record<AdminState, string> = { a_faire: 'À faire', en_cours: 'En cours', validee: 'Validée' }

export interface Idea { id: string; body: string; status: 'new' | 'seen' | 'done' | 'no'; reply: string | null; created_at: string }
export const IDEA_STATUS: Record<Idea['status'], string> = { new: 'Nouvelle', seen: 'Vue par le staff', done: 'Mise en place', no: 'Pas retenue' }
export interface MoodWeek { week_start: string; answers: number; average: number }

// ---------------- Exercices ----------------
export async function fetchExercises(): Promise<Exercise[]> {
  return must(await supabase.from('exercises').select('*').order('created_at', { ascending: false })) as Exercise[]
}
export async function saveExercise(ex: Omit<Exercise, 'id' | 'created_by'> & { id?: string }, byId: string) {
  const row = { ...ex, created_by: byId }
  if (ex.id) must(await supabase.from('exercises').update(row).eq('id', ex.id))
  else must(await supabase.from('exercises').insert(row))
}
export async function deleteExercise(id: string) {
  must(await supabase.from('exercises').delete().eq('id', id))
}

// ---------------- Plan de séance ----------------
export async function fetchTrainingPlans(eventIds: string[]): Promise<TrainingPlan[]> {
  if (!eventIds.length) return []
  return must(await supabase.from('training_plans').select('*').in('event_id', eventIds)) as TrainingPlan[]
}
export async function saveTrainingPlan(p: TrainingPlan) {
  must(await supabase.from('training_plans').upsert({ ...p, updated_at: new Date().toISOString() }))
}

// ---------------- Ressenti ----------------
export async function fetchFeedback(eventIds: string[]): Promise<Feedback[]> {
  if (!eventIds.length) return []
  return must(await supabase.from('training_feedback').select('*').in('event_id', eventIds)) as Feedback[]
}
export async function saveFeedback(f: Omit<Feedback, 'created_at'>) {
  must(await supabase.from('training_feedback').upsert(f))
}

// ---------------- Tests physiques ----------------
export async function fetchTests(profileId?: string): Promise<TestResult[]> {
  let q = supabase.from('test_results').select('*').order('tested_on')
  if (profileId) q = q.eq('profile_id', profileId)
  return must(await q) as TestResult[]
}
export async function addTest(profileId: string, test: string, value: number, testedOn: string, byId: string) {
  must(await supabase.from('test_results').insert({ profile_id: profileId, test, value, tested_on: testedOn, created_by: byId }))
}
export async function deleteTest(id: string) {
  must(await supabase.from('test_results').delete().eq('id', id))
}

// ---------------- Programmes ----------------
export async function fetchPrograms(): Promise<{ programs: Program[]; progress: ProgramProgress[] }> {
  const [p, g] = await Promise.all([
    supabase.from('programs').select('*').order('created_at', { ascending: false }),
    supabase.from('program_progress').select('program_id,profile_id,session_index'),
  ])
  return { programs: must(p) as Program[], progress: must(g) as ProgramProgress[] }
}
export async function saveProgram(p: Omit<Program, 'id' | 'created_at'> & { id?: string }, byId: string) {
  const row = { ...p, created_by: byId }
  if (p.id) must(await supabase.from('programs').update(row).eq('id', p.id))
  else must(await supabase.from('programs').insert(row))
}
export async function deleteProgram(id: string) {
  must(await supabase.from('programs').delete().eq('id', id))
}
export async function toggleProgress(programId: string, profileId: string, index: number, done: boolean) {
  if (done) must(await supabase.from('program_progress').upsert({ program_id: programId, profile_id: profileId, session_index: index }))
  else must(await supabase.from('program_progress').delete().eq('program_id', programId).eq('profile_id', profileId).eq('session_index', index))
}

// ---------------- Objectifs, notes, dossiers ----------------
export async function fetchGoals(profileId?: string): Promise<Goal[]> {
  let q = supabase.from('player_goals').select('*').order('created_at')
  if (profileId) q = q.eq('profile_id', profileId)
  return must(await q) as Goal[]
}
export async function addGoal(profileId: string, title: string, detail: string | null, due: string | null, byId: string) {
  must(await supabase.from('player_goals').insert({ profile_id: profileId, title, detail, due, created_by: byId }))
}
export async function setGoalDone(id: string, done: boolean) {
  must(await supabase.from('player_goals').update({ done }).eq('id', id))
}
export async function deleteGoal(id: string) {
  must(await supabase.from('player_goals').delete().eq('id', id))
}
export async function fetchNotes(profileId?: string): Promise<StaffNote[]> {
  let q = supabase.from('staff_notes').select('*').order('created_at', { ascending: false })
  if (profileId) q = q.eq('profile_id', profileId)
  return must(await q) as StaffNote[]
}
export async function addNote(profileId: string, kind: StaffNote['kind'], body: string, byId: string) {
  must(await supabase.from('staff_notes').insert({ profile_id: profileId, kind, body, created_by: byId }))
}
export async function deleteNote(id: string) {
  must(await supabase.from('staff_notes').delete().eq('id', id))
}
export async function fetchAdmin(profileId?: string): Promise<PlayerAdmin[]> {
  let q = supabase.from('player_admin').select('*')
  if (profileId) q = q.eq('profile_id', profileId)
  return must(await q) as PlayerAdmin[]
}
export async function saveAdmin(a: PlayerAdmin) {
  must(await supabase.from('player_admin').upsert({ ...a, updated_at: new Date().toISOString() }))
}
/** Ce qui manque dans un dossier, en clair. */
export function adminMissing(a: PlayerAdmin | undefined): string[] {
  const out: string[] = []
  if (!a || a.licence !== 'validee') out.push('licence')
  if (!a?.certificat_until || new Date(a.certificat_until) < new Date()) out.push('certificat médical')
  if (a?.mutation === 'en_cours') out.push('mutation')
  return out
}

// ---------------- Charte ----------------
export async function fetchCharter(): Promise<{ text: string; version: number; signed: { profile_id: string; version: number; accepted_at: string }[] }> {
  const [s, a] = await Promise.all([
    supabase.from('team_settings').select('charter,charter_version').eq('id', 1).single(),
    supabase.from('charter_acceptances').select('*'),
  ])
  const st = must(s) as { charter: string | null; charter_version: number }
  return { text: st.charter ?? '', version: st.charter_version, signed: must(a) as { profile_id: string; version: number; accepted_at: string }[] }
}
export async function signCharter(profileId: string, version: number) {
  must(await supabase.from('charter_acceptances').insert({ profile_id: profileId, version }))
}
/** Modifier la charte crée une nouvelle version : tout le monde doit la relire. */
export async function updateCharter(text: string, currentVersion: number) {
  must(await supabase.from('team_settings').update({ charter: text, charter_version: currentVersion + 1 }).eq('id', 1))
}

// ---------------- Boîte à idées & humeur ----------------
export async function fetchIdeas(): Promise<Idea[]> {
  return must(await supabase.from('ideas').select('*').order('created_at', { ascending: false })) as Idea[]
}
export async function submitIdea(body: string) {
  must(await supabase.rpc('submit_idea', { p_body: body }))
}
export async function answerIdea(id: string, status: Idea['status'], reply: string | null) {
  must(await supabase.from('ideas').update({ status, reply }).eq('id', id))
}
export async function deleteIdea(id: string) {
  must(await supabase.from('ideas').delete().eq('id', id))
}
export async function fetchMood(): Promise<{ weeks: MoodWeek[]; votedThisWeek: boolean }> {
  const monday = mondayIso()
  const [s, v] = await Promise.all([
    supabase.rpc('mood_summary'),
    supabase.from('mood_voters').select('week_start').eq('week_start', monday),
  ])
  return { weeks: (must(s) as MoodWeek[]) ?? [], votedThisWeek: ((must(v) as unknown[]) ?? []).length > 0 }
}
export async function submitMood(score: number) {
  const r = await supabase.rpc('submit_mood', { p_score: score })
  if (r.error && !r.error.message.includes('already_voted')) throw new Error(r.error.message)
}
export function mondayIso(d = new Date()) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = (x.getUTCDay() + 6) % 7
  x.setUTCDate(x.getUTCDate() - day)
  return x.toISOString().slice(0, 10)
}
