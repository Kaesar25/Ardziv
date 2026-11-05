import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'
import { createEvent, fetchAvailabilities, fetchEvents, fetchProfiles } from '../lib/data'
import { cap, fmtDay, fmtDow, fmtMonth, fmtTime } from '../lib/format'
import { isStaff, type TeamEvent } from '../lib/types'
import { Chip, PageTitle, Skeleton } from '../components/ui'
import { IconPlus } from '../components/Icons'
import { dispoLabel } from './Home'
import { notify } from '../lib/push'

export default function Agenda() {
  const { profile } = useAuth()
  const staff = isStaff(profile)
  const [showForm, setShowForm] = useState(false)

  const q = useAsync(async () => {
    const from = new Date(Date.now() - 3 * 3600_000).toISOString()
    const [events, profiles] = await Promise.all([fetchEvents(from), fetchProfiles()])
    const avail = await fetchAvailabilities(events.slice(0, 30).map((e) => e.id))
    return { events, profiles, avail }
  }, [])

  if (q.loading || !q.data || !profile) return <><Skeleton h={60} /><Skeleton h={200} /></>
  const { events, avail, profiles } = q.data
  const nPlayers = profiles.filter((p) => p.role === 'player' || p.role === 'captain').length

  const in7 = Date.now() + 7 * 86_400_000
  const groups: { label: string; items: TeamEvent[] }[] = [
    { label: 'Cette semaine', items: events.filter((e) => new Date(e.starts_at).getTime() <= in7) },
    { label: 'Plus tard', items: events.filter((e) => new Date(e.starts_at).getTime() > in7) },
  ].filter((g) => g.items.length)

  return (
    <>
      <PageTitle
        kicker={cap(fmtMonth())}
        title="Agenda"
        right={staff ? <button className="btn btn--fab" aria-label="Ajouter un événement" onClick={() => setShowForm((v) => !v)}><IconPlus stroke="var(--ink)" /></button> : undefined}
      />

      {showForm && staff && (
        <NewEventForm onDone={() => { setShowForm(false); void q.reload() }} byId={profile.id} />
      )}

      {groups.length === 0 && <p className="muted">Aucun événement à venir.</p>}
      {groups.map((g) => (
        <section key={g.label} className="stack stack--md">
          <span className="eyebrow">{g.label}</span>
          {g.items.map((e) => {
            const mine = avail.find((a) => a.event_id === e.id && a.profile_id === profile.id)?.status ?? null
            const yes = avail.filter((a) => a.event_id === e.id && a.status === 'yes').length
            const isMatch = e.type === 'match'
            return (
              <Link key={e.id} to={`/evenement/${e.id}`} className="card card--sm" style={{ display: 'grid', gridTemplateColumns: '48px minmax(0,1fr)', gap: 14, color: 'inherit', padding: 12 }}>
                <div className={`datebox ${isMatch ? 'datebox--gold' : ''}`} style={{ height: '100%' }}><span>{fmtDow(e.starts_at)}</span><span>{fmtDay(e.starts_at)}</span></div>
                <div className="stack" style={{ gap: 3, justifyContent: 'center' }}>
                  <div className="row row--between">
                    <span className="eyebrow" style={{ color: isMatch ? 'var(--gold)' : undefined, letterSpacing: '0.08em' }}>{isMatch ? `Match${e.matchday ? ` · ${e.matchday}` : ''}` : e.type === 'training' ? 'Entraînement' : 'Événement'}</span>
                    <span className="small muted" style={{ fontWeight: 600 }}>{fmtTime(e.starts_at)}</span>
                  </div>
                  <span style={{ fontWeight: 600 }}>{e.title}</span>
                  {e.location && <span className="small muted">{e.location}{e.is_home === false ? ' · extérieur' : ''}</span>}
                  <span className="small" style={{ marginTop: 3, fontWeight: 600, color: mine || staff ? 'var(--muted)' : 'var(--gold)' }}>
                    {staff ? `${yes} présent${yes > 1 ? 's' : ''} sur ${nPlayers}` : mine ? `Tu es ${dispoLabel(mine).toLowerCase()}` : 'Répondre'}
                  </span>
                </div>
              </Link>
            )
          })}
        </section>
      ))}
    </>
  )
}

function NewEventForm({ onDone, byId }: { onDone: () => void; byId: string }) {
  const [type, setType] = useState<'training' | 'match' | 'other'>('training')
  const [title, setTitle] = useState('Entraînement')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('19:15')
  const [location, setLocation] = useState('Stade Sévan')
  const [opponent, setOpponent] = useState('')
  const [home, setHome] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!date || !time || !title) return
    setBusy(true)
    setError(null)
    try {
      const starts = new Date(`${date}T${time}:00`).toISOString()
      const id = await createEvent({ type, title: type === 'match' && opponent ? (home ? `Ardziv 2 – ${opponent}` : `${opponent} – Ardziv 2`) : title, starts_at: starts, location, opponent: type === 'match' ? opponent : null, is_home: type === 'match' ? home : null, competition: type === 'match' ? 'Départemental 2' : null }, byId)
      void notify('event_created', id)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ gap: 12 }}>
      <div className="scroll-x">
        {(['training', 'match', 'other'] as const).map((t) => (
          <button key={t} className={`chip chip--ghost ${type === t ? 'is-active' : ''}`} onClick={() => { setType(t); setTitle(t === 'training' ? 'Entraînement' : t === 'match' ? '' : '') }}>
            {t === 'training' ? 'Entraînement' : t === 'match' ? 'Match' : 'Autre'}
          </button>
        ))}
      </div>
      {type !== 'match' && <input className="input" placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />}
      {type === 'match' && (
        <>
          <input className="input" placeholder="Adversaire" value={opponent} onChange={(e) => setOpponent(e.target.value)} />
          <div className="segmented" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <button className={`segmented__btn ${home ? 'is-yes' : ''}`} onClick={() => setHome(true)}>Domicile</button>
            <button className={`segmented__btn ${!home ? 'is-yes' : ''}`} onClick={() => setHome(false)}>Extérieur</button>
          </div>
        </>
      )}
      <div className="row">
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ maxWidth: 120 }} />
      </div>
      <input className="input" placeholder="Lieu" value={location} onChange={(e) => setLocation(e.target.value)} />
      <button className="btn btn--sm" disabled={busy || !date || (type === 'match' ? !opponent : !title)} onClick={submit}>{busy ? 'Enregistrement…' : 'Ajouter à l\'agenda'}</button>
      {error && <p className="error">{error}</p>}
      <Chip>Les joueurs reçoivent une notification pour donner leur dispo.</Chip>
    </div>
  )
}
