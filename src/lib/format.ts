const TZ = 'Europe/Paris'

export const fmtDow = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: TZ }).format(new Date(iso)).replace('.', '')

export const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: TZ }).format(new Date(iso))

export const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso)).replace(':', ':')

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ }).format(new Date(iso))

export const fmtLong = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }).format(new Date(iso))

export const fmtMonth = (d = new Date()) =>
  new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: TZ }).format(d)

export function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now()
  return Math.ceil(ms / 86_400_000)
}

export function countdownLabel(iso: string): string {
  const d = daysUntil(iso)
  if (d < 0) return 'Terminé'
  if (d === 0) return "Aujourd'hui"
  if (d === 1) return 'Demain'
  return `Dans ${d} jours`
}

export function initials(first: string, last?: string | null): string {
  const a = first.trim()[0] ?? ''
  const b = (last ?? '').trim()[0] ?? first.trim()[1] ?? ''
  return (a + b).toUpperCase()
}

export function timeAgo(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.round(h / 24)
  return `il y a ${d} j`
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
