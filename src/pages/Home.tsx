import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'
import { fetchAnnouncements, fetchAvailabilities, fetchEvents, fetchNextMatch, fetchProfiles, fetchResults, setAvailability } from '../lib/data'
import { countdownLabel, fmtDate, fmtDay, fmtDow, fmtLong, fmtTime, timeAgo, cap } from '../lib/format'
import { isStaff, type Availability, type AvailabilityRow } from '../lib/types'
import { Avatar, Chip, Segmented, Skeleton } from '../components/ui'
import { IconArrow } from '../components/Icons'

export default function Home() {
  const { profile } = useAuth()
  const staff = isStaff(profile)

  const q = useAsync(async () => {
    const now = new Date()
    const in7 = new Date(now.getTime() + 7 * 86_400_000)
    const [next, week, profiles, results, anns] = await Promise.all([
      fetchNextMatch(),
      fetchEvents(new Date(now.getTime() - 3 * 3600_000).toISOString(), in7.toISOString()),
      fetchProfiles(),
      fetchResults(),
      fetchAnnouncements(1),
    ])
    const ids = [...new Set([...(next ? [next.id] : []), ...week.map((e) => e.id)])]
    const avail = await fetchAvailabilities(ids)
    return { next, week, profiles, results, avail, ann: anns[0] ?? null }
  }, [])

  if (q.loading || !q.data || !profile) return <><Skeleton h={80} /><Skeleton h={300} /><Skeleton h={160} /></>
  const { next, week, profiles, results, avail, ann } = q.data

  const players = profiles.filter((p) => p.role === 'player' || p.role === 'captain')
  const myStatus = (eventId: string): Availability | null => avail.find((a) => a.event_id === eventId && a.profile_id === profile.id)?.status ?? null

  async function answer(eventId: string, s: Availability) {
    await setAvailability(eventId, profile!.id, s)
    const rest = avail.filter((a) => !(a.event_id === eventId && a.profile_id === profile!.id))
    const row: AvailabilityRow = { event_id: eventId, profile_id: profile!.id, status: s, comment: null, updated_at: new Date().toISOString() }
    q.setData({ ...q.data!, avail: [...rest, row] })
  }

  const counts = (eventId: string) => {
    const rows = avail.filter((a) => a.event_id === eventId)
    const c = { yes: 0, maybe: 0, no: 0 }
    rows.forEach((r) => { c[r.status]++ })
    return { ...c, none: Math.max(0, players.length - rows.length), total: players.length }
  }

  const played = results.length
  const wins = results.filter((r) => r.goals_for > r.goals_against).length

  const sub = staff && next
    ? `${counts(next.id).none} joueur(s) sans réponse pour ${fmtDate(next.starts_at)}.`
    : next ? `${next.is_home ? 'Réception' : 'Déplacement'} ${next.is_home ? 'de' : 'chez'} ${next.opponent ?? ''} ${fmtDate(next.starts_at)} à ${fmtTime(next.starts_at)}.`
    : 'Pas de match programmé.'

  return (
    <>
      <div className="stack">
        <span className="kicker">{cap(fmtLong(new Date().toISOString()))}</span>
        <h1 className="display display--xl">Salut {profile.first_name}</h1>
        <p className="text-2" style={{ fontSize: 14 }}>{sub}</p>
      </div>

      {next && (
        <section className="card">
          <div className="row row--between">
            <span className="eyebrow">Prochain match{next.matchday ? ` · ${next.matchday}` : ''}</span>
            <Chip tone="gold">{countdownLabel(next.starts_at)}</Chip>
          </div>
          <MatchHeader home={!!next.is_home} opponent={next.opponent ?? next.title} time={fmtTime(next.starts_at)} date={fmtDate(next.starts_at)} />
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Chip>{next.is_home ? 'Domicile' : 'Extérieur'}</Chip>
            {next.location && <Chip>{next.location}</Chip>}
            {next.meeting_at && <Chip>RDV {fmtTime(next.meeting_at)}</Chip>}
          </div>
          {!staff ? (
            <div className="stack" style={{ gap: 10 }}>
              <Segmented value={myStatus(next.id)} onChange={(s) => answer(next.id, s)} />
              <span className="small muted center">{dispoHint(myStatus(next.id))}</span>
            </div>
          ) : (
            <ResponseBar c={counts(next.id)} />
          )}
          <Link to={`/evenement/${next.id}`} className="btn">
            {staff ? 'Préparer le groupe' : 'Voir la convocation'} <IconArrow stroke="var(--ink)" />
          </Link>
        </section>
      )}

      <section className="stack stack--md">
        <div className="row row--between" style={{ alignItems: 'baseline' }}>
          <h2 className="h2">Cette semaine</h2>
          <Link to="/agenda" className="link">Agenda</Link>
        </div>
        {week.length === 0 && <p className="small muted">Rien de prévu dans les 7 jours.</p>}
        {week.map((e) => {
          const s = myStatus(e.id)
          const c = counts(e.id)
          return (
            <Link key={e.id} to={`/evenement/${e.id}`} className="row" style={{ gap: 14, color: 'inherit' }}>
              <div className={`datebox ${e.type === 'match' ? 'datebox--gold' : ''}`}><span>{fmtDow(e.starts_at)}</span><span>{fmtDay(e.starts_at)}</span></div>
              <div className="stack" style={{ gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{e.title}</span>
                <span className="small muted">{fmtTime(e.starts_at)}{e.location ? ` · ${e.location}` : ''}</span>
              </div>
              {staff ? <Chip>{c.yes} présents</Chip> : s ? <Chip tone={s === 'no' ? 'red' : 'gold'}>{dispoLabel(s)}</Chip> : <Chip><span className="gold">Répondre</span></Chip>}
            </Link>
          )
        })}
      </section>

      <section className="card" style={{ padding: '18px 20px' }}>
        <div className="row row--between">
          <h2 className="h2">Saison</h2>
          <Link to="/stats" className="link">Résultats</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
          <Kpi v={String(played)} l="joués" />
          <Kpi v={String(wins)} l="victoires" gold />
          <Kpi v={`${results.reduce((a, r) => a + r.goals_for, 0)}-${results.reduce((a, r) => a + r.goals_against, 0)}`} l="buts" />
        </div>
      </section>

      {ann && (() => {
        const author = profiles.find((p) => p.id === ann.author_id)
        return (
          <section className="row" style={{ alignItems: 'flex-start' }}>
            {author && <Avatar p={author} />}
            <div className="stack" style={{ gap: 6, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '4px 18px 18px 18px', padding: '12px 14px' }}>
              <span className="small muted"><b style={{ color: 'var(--text)' }}>{author?.first_name ?? 'Staff'}</b> · {timeAgo(ann.created_at)}</span>
              <span style={{ fontSize: 14, lineHeight: 1.45 }}>{ann.body}</span>
            </div>
          </section>
        )
      })()}
    </>
  )
}

export function MatchHeader({ home, opponent, time, date }: { home: boolean; opponent: string; time: string; date: string }) {
  const Us = () => (
    <div className="stack" style={{ alignItems: 'center', gap: 8 }}>
      <img src="/icons/icon-192.png" alt="" width={60} height={60} style={{ borderRadius: 999 }} />
      <span style={{ fontSize: 13, fontWeight: 600 }}>Ardziv 2</span>
    </div>
  )
  const Them = () => (
    <div className="stack" style={{ alignItems: 'center', gap: 8 }}>
      <div className="avatar" style={{ width: 60, height: 60, fontFamily: 'var(--display)', fontSize: 18, color: 'var(--text-2)' }}>{opponent.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase()}</div>
      <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{opponent}</span>
    </div>
  )
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: 8 }}>
      {home ? <Us /> : <Them />}
      <div className="stack" style={{ alignItems: 'center', gap: 2, padding: '0 6px' }}>
        <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 38, lineHeight: 1 }}>{time}</span>
        <span className="kicker">{date}</span>
      </div>
      {home ? <Them /> : <Us />}
    </div>
  )
}

export function ResponseBar({ c }: { c: { yes: number; maybe: number; no: number; none: number; total: number } }) {
  const pct = (n: number) => (c.total ? `${Math.round((n / c.total) * 100)}%` : '0%')
  return (
    <div className="stack stack--md">
      <div className="bar">
        <div style={{ width: pct(c.yes), background: 'var(--gold)' }} />
        <div style={{ width: pct(c.maybe), background: 'var(--muted-2)' }} />
        <div style={{ width: pct(c.no), background: 'var(--red)' }} />
      </div>
      <div className="row row--between small text-2">
        <span><b style={{ color: 'var(--text)' }}>{c.yes}</b> présents</span>
        <span><b style={{ color: 'var(--text)' }}>{c.maybe}</b> incertains</span>
        <span><b style={{ color: 'var(--text)' }}>{c.no}</b> absents</span>
        <span><b style={{ color: 'var(--text)' }}>{c.none}</b> sans réponse</span>
      </div>
    </div>
  )
}

function Kpi({ v, l, gold = false }: { v: string; l: string; gold?: boolean }) {
  return (
    <div className="stack" style={{ alignItems: 'center', gap: 2 }}>
      <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 30, lineHeight: 1, color: gold ? 'var(--gold)' : 'var(--text)' }}>{v}</span>
      <span className="small muted">{l}</span>
    </div>
  )
}

export const dispoLabel = (s: Availability) => ({ yes: 'Présent', maybe: 'Incertain', no: 'Absent' }[s])
export const dispoHint = (s: Availability | null) =>
  s === 'yes' ? 'Merci, le staff est prévenu.' : s === 'maybe' ? 'Pense à confirmer dès que possible.' : s === 'no' ? 'Absence notée.' : 'Réponds dès que possible.'
