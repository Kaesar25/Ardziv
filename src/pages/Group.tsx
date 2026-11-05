import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'
import { fetchAvailabilities, fetchEvents, fetchProfiles } from '../lib/data'
import { isStaff, LINE_LABELS, ROLE_LABELS, type SquadLine } from '../lib/types'
import { Avatar, PageTitle, Skeleton } from '../components/ui'
import Treasury from '../components/Treasury'
import Duties from '../components/Duties'
import Polls from '../components/Polls'
import { useSearchParams } from 'react-router-dom'

type Tab = 'effectif' | 'caisse' | 'taches' | 'sondages'
const TABS: [Tab, string][] = [['effectif', 'Effectif'], ['caisse', 'Caisse'], ['taches', 'Tâches'], ['sondages', 'Sondages']]

const LINES: SquadLine[] = ['GB', 'DEF', 'MIL', 'ATT']

export default function Group() {
  const { profile } = useAuth()
  const staff = isStaff(profile)
  const [line, setLine] = useState<SquadLine | 'all'>('all')
  const [params, setParams] = useSearchParams()
  const tab = (params.get('onglet') as Tab) || 'effectif'

  const q = useAsync(async () => {
    const profiles = await fetchProfiles()
    // Taux de présence : entraînements des 60 derniers jours
    const since = new Date(Date.now() - 60 * 86_400_000).toISOString()
    const past = (await fetchEvents(since, new Date().toISOString())).filter((e) => e.type === 'training')
    const avail = await fetchAvailabilities(past.map((e) => e.id))
    const presence: Record<string, number> = {}
    if (past.length) profiles.forEach((p) => { presence[p.id] = Math.round((avail.filter((a) => a.profile_id === p.id && a.status === 'yes').length / past.length) * 100) })
    return { profiles, presence, nTrainings: past.length }
  }, [])

  if (q.loading || !q.data || !profile) return <><Skeleton h={60} /><Skeleton h={300} /></>
  const { profiles, presence, nTrainings } = q.data
  const staffList = profiles.filter((p) => p.role === 'coach' || p.role === 'staff' || p.role === 'captain')
  const players = profiles.filter((p) => (p.role === 'player' || p.role === 'captain') && (line === 'all' || (p.line ?? 'MIL') === line))

  return (
    <>
      <PageTitle kicker={`${profiles.filter((p) => p.role === 'player' || p.role === 'captain').length} joueurs · ${profiles.filter((p) => p.role === 'coach').length} entraîneurs`} title="Le groupe" />

      <div className="segmented" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
        {TABS.map(([k, l]) => <button key={k} className={`segmented__btn ${tab === k ? 'is-yes' : ''}`} style={{ fontSize: 13 }} onClick={() => setParams(k === 'effectif' ? {} : { onglet: k }, { replace: true })}>{l}</button>)}
      </div>

      {tab === 'caisse' && <Treasury me={profile} profiles={profiles} />}
      {tab === 'taches' && <Duties me={profile} profiles={profiles} />}
      {tab === 'sondages' && <Polls me={profile} profiles={profiles} />}
      {tab === 'effectif' && <>

      {staffList.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, staffList.length)}, minmax(0,1fr))`, gap: 8 }}>
          {staffList.map((p) => (
            <div key={p.id} className="card card--sm" style={{ alignItems: 'center', gap: 6, padding: '12px 6px' }}>
              <Avatar p={p} lg staff />
              <span style={{ fontWeight: 600, fontSize: 14 }}>{p.first_name}</span>
              <span className="gold" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{ROLE_LABELS[p.role]}</span>
            </div>
          ))}
        </div>
      )}

      <div className="scroll-x">
        {([['all', 'Tous'], ...LINES.map((l) => [l, LINE_LABELS[l]])] as [SquadLine | 'all', string][]).map(([k, l]) => (
          <button key={k} className={`chip chip--ghost ${line === k ? 'is-active' : ''}`} style={{ minHeight: 36, padding: '0 14px', fontSize: 13 }} onClick={() => setLine(k)}>{l}</button>
        ))}
      </div>

      <div className="card card--list">
        {players.map((p) => (
          <div key={p.id} className="listrow">
            <Avatar p={p} me={p.id === profile.id} />
            <div className="stack" style={{ gap: 1 }}>
              <span style={{ fontWeight: 600 }}>{p.first_name}{p.last_name ? ` ${p.last_name}` : ''}{p.role === 'captain' ? ' · capitaine' : ''}</span>
              <span className="small muted">{p.position ?? LINE_LABELS[p.line ?? 'MIL'].slice(0, -1)}</span>
            </div>
            <div className="stack" style={{ alignItems: 'flex-end', gap: 2 }}>
              {p.number != null && <span className="gold" style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18 }}>{p.number}</span>}
              {staff && nTrainings > 0 && <span className="small" style={{ fontSize: 11, fontWeight: 600, color: (presence[p.id] ?? 0) < 70 ? 'var(--red)' : 'var(--muted)' }}>{presence[p.id] ?? 0} %</span>}
            </div>
          </div>
        ))}
        {players.length === 0 && <p className="muted small" style={{ padding: '12px 0' }}>Personne dans cette ligne pour l'instant.</p>}
      </div>
      {staff && nTrainings > 0 && <p className="small muted">Taux de présence calculé sur les {nTrainings} derniers entraînements (réponses « présent »).</p>}
      </>}
    </>
  )
}
