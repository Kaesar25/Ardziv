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

export const isStaff = (p: Profile | null) => !!p && (p.role === 'coach' || p.role === 'staff')
export const isCaptainOrStaff = (p: Profile | null) => !!p && (p.role === 'captain' || isStaff(p))
