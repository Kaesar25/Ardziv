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
