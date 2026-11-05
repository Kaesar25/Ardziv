export type MemberRole = 'player' | 'captain' | 'coach' | 'staff'
export type SquadLine = 'GB' | 'DEF' | 'MIL' | 'ATT'
export type EventType = 'training' | 'match' | 'other'
export type Availability = 'yes' | 'maybe' | 'no'
export type SquadSlot = 'starter' | 'bench'

export interface Profile {
  id: string
  first_name: string
  last_name: string | null
  role: MemberRole
  line: SquadLine | null
  position: string | null
  number: number | null
  phone: string | null
  is_admin: boolean
}

export interface Standing {
  team: string
  is_us: boolean
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  points: number
  updated_at: string
}

export interface TeamEvent {
  id: string
  type: EventType
  title: string
  starts_at: string
  meeting_at: string | null
  location: string | null
  is_home: boolean | null
  opponent: string | null
  competition: string | null
  matchday: string | null
  notes: string | null
  response_deadline: string | null
  status?: 'scheduled' | 'postponed' | 'cancelled'
  status_note?: string | null
}

export interface AvailabilityRow {
  event_id: string
  profile_id: string
  status: Availability
  comment: string | null
  updated_at: string
}

export interface Squad {
  event_id: string
  published_at: string | null
  published_by: string | null
  message: string | null
}

export interface SquadPlayer {
  event_id: string
  profile_id: string
  slot: SquadSlot
}

export interface MatchResult {
  event_id: string
  goals_for: number
  goals_against: number
  summary: string | null
}

export interface MatchStat {
  event_id: string
  profile_id: string
  played: boolean
  minutes: number | null
  goals: number
  assists: number
  yellow: number
  red: number
}

export interface Announcement {
  id: string
  author_id: string
  body: string
  created_at: string
}

export const LINE_LABELS: Record<SquadLine, string> = {
  GB: 'Gardiens',
  DEF: 'Défenseurs',
  MIL: 'Milieux',
  ATT: 'Attaquants',
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  player: 'Joueur',
  captain: 'Capitaine',
  coach: 'Entraîneur',
  staff: 'Staff',
}

/** Droits du staff : entraîneurs, dirigeants, et l'administrateur. */
export const isStaff = (p: Profile | null) => !!p && (p.role === 'coach' || p.role === 'staff' || p.is_admin)
export const isCaptainOrStaff = (p: Profile | null) => !!p && (p.role === 'captain' || isStaff(p))
/** Joue dans l'équipe : donne ses dispos, apparaît dans les convocations. */
export const isPlayer = (p: Profile | null) => !!p && (p.role === 'player' || p.role === 'captain')
export const roleLabel = (p: Profile) => (p.is_admin ? `${ROLE_LABELS[p.role]} · Admin` : ROLE_LABELS[p.role])

/** Seuil d'avertissements à surveiller (à ajuster selon le règlement du District). */
export const YELLOW_ALERT = 2

// ======================= V2 =======================
export type EventStatus = 'scheduled' | 'postponed' | 'cancelled'

export interface Carpool {
  id: string
  event_id: string
  driver_id: string
  seats: number
  meeting_point: string | null
  meeting_time: string | null
}
export interface CarpoolPassenger { carpool_id: string; profile_id: string }

export interface TimelineItem { time: string; label: string; sub?: string }
export interface ChecklistItem { label: string; done: boolean }
export interface MatchdayPlan { event_id: string; timeline: TimelineItem[]; checklist: ChecklistItem[] }

export type LivePhase = 'pre' | 'first_half' | 'half_time' | 'second_half' | 'finished'
export interface LiveMatch { event_id: string; phase: LivePhase; goals_for: number; goals_against: number; started_at: string | null; updated_at: string }
export type LiveKind = 'goal_for' | 'goal_against' | 'yellow' | 'red' | 'sub' | 'note'
export interface LiveEvent { id: string; event_id: string; minute: number | null; kind: LiveKind; profile_id: string | null; text: string | null; created_at: string }

export interface Fine { id: string; profile_id: string; kind: 'fine' | 'dues' | 'other'; label: string; amount: number; paid: boolean; paid_at: string | null; created_at: string }
export interface FinePreset { id: string; label: string; amount: number }

export interface Duty { id: string; label: string; profile_id: string; week_start: string; done: boolean }

export interface Poll { id: string; question: string; options: string[]; multiple: boolean; anonymous: boolean; closes_at: string | null; created_by: string | null; created_at: string }
export interface PollVote { poll_id: string; profile_id: string; option_idx: number }

export interface LineupSpot { profile_id: string; x: number; y: number }
export interface Lineup { event_id: string; formation: string; positions: LineupSpot[]; collective: string[]; individual: Record<string, string[]>; published: boolean }

export type SetPieceKind = 'corner_off' | 'corner_def' | 'free_kick' | 'penalty' | 'throw_in' | 'kick_off'
export interface SetPiece { id: string; kind: SetPieceKind; name: string; taker: string | null; description: string; sort: number }
export const SET_PIECE_LABELS: Record<SetPieceKind, string> = {
  corner_off: 'Corner offensif',
  corner_def: 'Corner défensif',
  free_kick: 'Coup franc',
  penalty: 'Penalty',
  throw_in: 'Touche',
  kick_off: "Coup d'envoi",
}

export interface Scouting { opponent: string; system: string | null; strengths: string[]; weaknesses: string[]; key_players: string | null; notes: string | null; updated_at: string }

export const DUTY_LABELS = ['Lavage des maillots', 'Sac de ballons', 'Chasubles et plots', "Collation d'après-match", 'Gourdes']
