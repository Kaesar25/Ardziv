import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'
import { fetchAvailabilities, fetchEvents, fetchProfiles, fetchStats } from '../lib/data'
import { fetchMotmSeason } from '../lib/data2'
import { addMove, deleteMove, fetchMoves } from '../lib/data4'
import { canViewStaffData, isPlayer, isStaff, type Profile } from '../lib/types'
import { Avatar, PageTitle, Skeleton } from '../components/ui'

export default function Equipe1() {
  const { profile } = useAuth()
  const q = useAsync(async () => {
    const since = new Date(Date.now() - 42 * 86_400_000).toISOString()
    const [profiles, moves, stats, motm, recent] = await Promise.all([fetchProfiles(), fetchMoves(), fetchStats(), fetchMotmSeason(), fetchEvents(since, new Date().toISOString())])
    const tr = recent.filter((e) => e.type === 'training' && (e.status ?? 'scheduled') === 'scheduled')
    const avail = await fetchAvailabilities(tr.map((e) => e.id))
    return { profiles, moves, stats, motm, nTr: tr.length, avail }
  }, [])
  const [sort, setSort] = useState<'forme' | 'buts' | 'presence'>('forme')
  if (profile && !canViewStaffData(profile)) return <Navigate to="/" replace />
  if (!profile || q.loading || !q.data) return <><Skeleton h={60} /><Skeleton h={240} /></>
  const { profiles, moves, stats, motm, nTr, avail } = q.data
  const players = profiles.filter(isPlayer)
  const rows = players.map((p) => {
    const st = stats.filter((s) => s.profile_id === p.id)
    const goals = st.reduce((a, s) => a + s.goals, 0)
    const assists = st.reduce((a, s) => a + s.assists, 0)
    const pres = nTr ? Math.round((avail.filter((a) => a.profile_id === p.id && a.status === 'yes').length / nTr) * 100) : 0
    const m = motm.find((x) => x.profile_id === p.id)?.wins ?? 0
    const lastMove = moves.find((x) => x.profile_id === p.id)
    return { p, goals, assists, pres, motm: m, score: goals * 3 + assists * 2 + m * 3 + pres / 10, lastMove }
  }).sort((a, b) => sort === 'buts' ? b.goals + b.assists - (a.goals + a.assists) : sort === 'presence' ? b.pres - a.pres : b.score - a.score)
  return (
    <>
      <PageTitle kicker={isStaff(profile) ? 'Lien avec la Régional 1' : 'Accès coach équipe 1 · lecture seule'} title="Équipe 1" />
      <section className="stack stack--md">
        <span className="eyebrow">Forme des joueurs de l'équipe 2</span>
        <div className="segmented">{([['forme', 'Forme'], ['buts', 'Buts + passes'], ['presence', 'Présence']] as const).map(([k, l]) => <button key={k} className={`segmented__btn ${sort === k ? 'is-yes' : ''}`} onClick={() => setSort(k)}>{l}</button>)}</div>
        <div className="card card--list">
          {rows.map((r) => (
            <div key={r.p.id} className="listrow">
              <Avatar p={r.p} />
              <div className="stack" style={{ gap: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{r.p.first_name}{r.p.last_name ? ` ${r.p.last_name}` : ''}</span>
                <span className="small muted">{[r.p.position, r.lastMove ? `${r.lastMove.direction === 'up' ? 'Monté' : 'Redescendu'} le ${new Date(r.lastMove.on_date).toLocaleDateString('fr-FR')}` : null].filter(Boolean).join(' · ')}</span>
              </div>
              <div className="stack" style={{ alignItems: 'flex-end', gap: 1 }}>
                <span className="small" style={{ fontWeight: 700 }}>{r.goals} B · {r.assists} P{r.motm ? ` · ${r.motm}★` : ''}</span>
                <span className="small" style={{ color: r.pres < 60 ? 'var(--red)' : 'var(--muted)' }}>{nTr ? `${r.pres} % présence` : ''}</span>
              </div>
            </div>
          ))}
        </div>
        <span className="small muted">Forme = buts, passes décisives, hommes du match et présence aux entraînements des 6 dernières semaines. B = buts, P = passes, ★ = homme du match.</span>
      </section>
      {isStaff(profile) && <MoveForm me={profile} players={players} onDone={() => void q.reload()} />}
      <section className="stack stack--md">
        <span className="eyebrow">Historique des mouvements</span>
        {moves.length === 0 ? <p className="small muted">Aucun mouvement enregistré cette saison.</p> : (
          <div className="card card--list">
            {moves.map((m) => {
              const p = profiles.find((x) => x.id === m.profile_id)
              if (!p) return null
              return (
                <div key={m.id} className="listrow">
                  <span style={{ fontWeight: 800, fontSize: 18, textAlign: 'center', color: m.direction === 'up' ? 'var(--gold)' : 'var(--text-2)' }}>{m.direction === 'up' ? '↑' : '↓'}</span>
                  <div className="stack" style={{ gap: 1 }}>
                    <span style={{ fontWeight: 600 }}>{p.first_name} · {m.direction === 'up' ? 'en équipe 1' : 'en équipe 2'}</span>
                    {m.note && <span className="small muted">{m.note}</span>}
                  </div>
                  <span className="row" style={{ gap: 8 }}><span className="small muted">{new Date(m.on_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>{isStaff(profile) && <button className="muted small" aria-label="Supprimer" onClick={async () => { await deleteMove(m.id); void q.reload() }}>✕</button>}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}

function MoveForm({ me, players, onDone }: { me: Profile; players: Profile[]; onDone: () => void }) {
  const [pid, setPid] = useState('')
  const [dir, setDir] = useState<'up' | 'down'>('up')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  return (
    <section className="card" style={{ gap: 10 }}>
      <span className="eyebrow">Enregistrer un mouvement</span>
      <select className="input" value={pid} onChange={(e) => setPid(e.target.value)}>
        <option value="">Choisir un joueur…</option>
        {players.map((p) => <option key={p.id} value={p.id}>{p.first_name}{p.last_name ? ` ${p.last_name}` : ''}</option>)}
      </select>
      <div className="segmented" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button className={`segmented__btn ${dir === 'up' ? 'is-yes' : ''}`} onClick={() => setDir('up')}>Monte en équipe 1</button>
        <button className={`segmented__btn ${dir === 'down' ? 'is-yes' : ''}`} onClick={() => setDir('down')}>Redescend en équipe 2</button>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 160 }} />
        <input className="input" placeholder="Pour quel match, raison…" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button className="btn btn--sm" disabled={!pid} onClick={async () => { await addMove(pid, dir, date, note.trim() || null, me.id); setPid(''); setNote(''); onDone() }}>Enregistrer</button>
    </section>
  )
}
