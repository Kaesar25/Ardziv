import { useState } from 'react'
import { useAsync } from '../lib/useAsync'
import { fetchMatchStats } from '../lib/data'
import { fetchMotmResults, fetchMyMotmVote, motmOpen, voteMotm } from '../lib/data2'
import { isPlayer, isStaff, type Profile, type TeamEvent } from '../lib/types'
import { Avatar, Skeleton } from './ui'

/** Vote secret de l'homme du match, ouvert 48 h après le coup d'envoi. */
export default function MotmVote({ event, me, players }: { event: TeamEvent; me: Profile; players: Profile[] }) {
  const open = motmOpen(event.starts_at)
  const closed = Date.now() > new Date(event.starts_at).getTime() + 48 * 3600_000
  const q = useAsync(async () => {
    const [mine, results, stats] = await Promise.all([fetchMyMotmVote(event.id, me.id), fetchMotmResults(event.id), fetchMatchStats(event.id).catch(() => [])])
    return { mine, results, played: stats.filter((s) => s.played).map((s) => s.profile_id) }
  }, [event.id])
  const [busy, setBusy] = useState(false)

  if (!open && !closed) return null
  if (q.loading || !q.data) return <Skeleton h={140} />
  const { mine, results, played } = q.data
  const candidates = (played.length ? players.filter((p) => played.includes(p.id)) : players).filter((p) => p.id !== me.id)
  const name = (id: string) => players.find((p) => p.id === id)
  const total = results[0]?.total ?? 0
  const max = results[0]?.votes ?? 1
  const showResults = results.length > 0 && (closed || isStaff(me))
  const winner = closed && results[0] ? name(results[0].nominee_id) : null

  return (
    <section className="card" style={{ gap: 12 }}>
      <div className="row row--between">
        <h2 className="h2">Homme du match</h2>
        <span className="small muted">{closed ? 'Vote clos' : 'Vote secret · 48 h'}</span>
      </div>

      {winner && (
        <div className="row" style={{ gap: 12, background: 'var(--gold-soft)', borderRadius: 14, padding: 12 }}>
          <Avatar p={winner} me lg />
          <div className="stack" style={{ gap: 1 }}>
            <span className="display" style={{ fontSize: 22 }}>{winner.first_name}</span>
            <span className="small text-2">{results[0].votes} vote{results[0].votes > 1 ? 's' : ''} sur {total}</span>
          </div>
        </div>
      )}

      {open && isPlayer(me) && (
        <>
          <span className="small text-2">{mine ? `Tu as voté pour ${name(mine)?.first_name}. Tu peux changer jusqu'à la clôture.` : 'Qui a été le meilleur ? Tu ne peux pas voter pour toi.'}</span>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {candidates.map((p) => (
              <button key={p.id} disabled={busy} className={`chip chip--ghost ${mine === p.id ? 'is-active' : ''}`} style={{ minHeight: 40, padding: '0 14px', fontSize: 14 }}
                onClick={async () => { setBusy(true); await voteMotm(event.id, me.id, p.id); await q.reload(); setBusy(false) }}>
                {p.first_name}
              </button>
            ))}
          </div>
        </>
      )}

      {showResults && (
        <div className="stack" style={{ gap: 8 }}>
          {!closed && <span className="eyebrow">Résultats provisoires (visibles par le staff)</span>}
          {results.slice(0, 5).map((r) => (
            <div key={r.nominee_id} className="stack" style={{ gap: 4 }}>
              <div className="row row--between small"><span style={{ fontWeight: 600 }}>{name(r.nominee_id)?.first_name ?? '?'}</span><span className="muted">{r.votes} vote{r.votes > 1 ? 's' : ''}</span></div>
              <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}><div style={{ width: `${Math.round((r.votes / max) * 100)}%`, height: 6, background: 'var(--gold)' }} /></div>
            </div>
          ))}
          <span className="small muted">{total} votant{total > 1 ? 's' : ''}</span>
        </div>
      )}
      {closed && results.length === 0 && <p className="small muted">Personne n'a voté pour ce match.</p>}
    </section>
  )
}
