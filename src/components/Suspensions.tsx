import { useState } from 'react'
import { useAsync } from '../lib/useAsync'
import { addSuspension, deleteSuspension, fetchSuspensions, purgeMatches } from '../lib/data4'
import { isPlayer, isStaff, type Profile, type TeamEvent } from '../lib/types'

/** Suspensions officielles et dates de purge, calculées sur le calendrier (reports exclus). */
export default function Suspensions({ me, profiles, matches }: { me: Profile; profiles: Profile[]; matches: TeamEvent[] }) {
  const staff = isStaff(me)
  const q = useAsync(fetchSuspensions, [])
  const [adding, setAdding] = useState(false)
  const [pid, setPid] = useState('')
  const [n, setN] = useState(1)
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')
  if (!q.data) return null
  const active = q.data.map((s) => ({ s, ...purgeMatches(s, matches) })).filter((x) => !x.done)
  if (!active.length && !staff) return null
  const day = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }).format(new Date(iso))
  return (
    <section className="card" style={{ gap: 10, background: active.length ? '#24140F' : undefined, borderColor: active.length ? '#5C2A22' : undefined }}>
      <span className="eyebrow" style={{ color: active.length ? '#FF9C8A' : undefined }}>Suspensions en cours</span>
      {active.length === 0 && <span className="small muted">Aucun joueur suspendu.</span>}
      {active.map(({ s, list, remaining }) => {
        const p = profiles.find((x) => x.id === s.profile_id)
        return (
          <div key={s.id} className="stack" style={{ gap: 3 }}>
            <div className="row row--between"><span style={{ fontWeight: 700 }}>{p?.first_name ?? '—'}</span><span className="small" style={{ color: '#E0B9B1' }}>{remaining} match{remaining > 1 ? 's' : ''} à purger</span></div>
            <span className="small" style={{ color: '#E0B9B1' }}>{list.length ? `Purge : ${list.map((m) => `${m.matchday ?? ''} ${day(m.starts_at)}`.trim()).join(', ')}` : 'Dates de purge à venir (calendrier incomplet).'}{list.length < s.matches ? ` + ${s.matches - list.length} match${s.matches - list.length > 1 ? 's' : ''} non programmé${s.matches - list.length > 1 ? 's' : ''}` : ''}</span>
            {s.reason && <span className="small muted">{s.reason}</span>}
            {staff && <button className="small muted" style={{ textAlign: 'left' }} onClick={async () => { if (confirm('Retirer cette suspension ?')) { await deleteSuspension(s.id); void q.reload() } }}>Retirer</button>}
          </div>
        )
      })}
      {staff && (adding ? (
        <div className="stack" style={{ gap: 8 }}>
          <select className="input" value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">Joueur suspendu…</option>
            {profiles.filter(isPlayer).map((p) => <option key={p.id} value={p.id}>{p.first_name}{p.last_name ? ` ${p.last_name}` : ''}</option>)}
          </select>
          <div className="row" style={{ gap: 8 }}>
            <input className="input" inputMode="numeric" value={n} onChange={(e) => setN(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} style={{ maxWidth: 90 }} aria-label="Nombre de matchs" />
            <span className="small muted">match(s) à partir du</span>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <input className="input" placeholder="Motif (ex. 3 avertissements, décision du District du…)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <span className="small muted">Les matchs comptés sont les prochains matchs officiels après cette date, reports et annulations exclus. Vérifie avec la notification officielle du District.</span>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn--secondary btn--sm" onClick={() => setAdding(false)}>Annuler</button>
            <button className="btn btn--sm" disabled={!pid} onClick={async () => { await addSuspension(pid, n, from, reason.trim() || null); setAdding(false); setPid(''); setReason(''); void q.reload() }}>Enregistrer</button>
          </div>
        </div>
      ) : <button className="btn btn--secondary btn--sm" onClick={() => setAdding(true)}>Saisir une suspension</button>)}
    </section>
  )
}
