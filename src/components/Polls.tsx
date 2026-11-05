import { useState } from 'react'
import { useAsync } from '../lib/useAsync'
import { createPoll, deletePoll, fetchPollCounts, fetchPollVotes, fetchPolls, setPollVote } from '../lib/data2'
import { notify } from '../lib/push'
import { timeAgo } from '../lib/format'
import { isCaptainOrStaff, type Poll, type Profile } from '../lib/types'
import { Chip, Skeleton } from './ui'

/** Sondages rapides : un ou plusieurs choix, anonymes ou non, avec date de clôture. */
export default function Polls({ me, profiles }: { me: Profile; profiles: Profile[] }) {
  const canCreate = isCaptainOrStaff(me)
  const q = useAsync(async () => {
    const polls = await fetchPolls()
    const [votes, counts] = await Promise.all([
      fetchPollVotes(polls.map((p) => p.id)),
      Promise.all(polls.map((p) => fetchPollCounts(p.id).then((c) => [p.id, c] as const))),
    ])
    return { polls, votes, counts: Object.fromEntries(counts) }
  }, [])
  const [creating, setCreating] = useState(false)

  if (q.loading || !q.data) return <Skeleton h={220} />
  const { polls, votes, counts } = q.data

  return (
    <div className="stack stack--lg">
      {canCreate && !creating && <button className="btn btn--sm" onClick={() => setCreating(true)}>+ Nouveau sondage</button>}
      {creating && <PollForm me={me} onDone={() => { setCreating(false); void q.reload() }} />}
      {polls.length === 0 && !creating && <p className="small muted">Aucun sondage pour l'instant.</p>}
      {polls.map((p) => (
        <PollCard key={p.id} poll={p} me={me} profiles={profiles} myVotes={votes.filter((v) => v.poll_id === p.id && v.profile_id === me.id).map((v) => v.option_idx)}
          allVotes={votes.filter((v) => v.poll_id === p.id)} counts={counts[p.id] ?? []} canDelete={canCreate} onChange={() => q.reload()} />
      ))}
    </div>
  )
}

function PollCard({ poll, me, profiles, myVotes, allVotes, counts, canDelete, onChange }: {
  poll: Poll; me: Profile; profiles: Profile[]; myVotes: number[]; allVotes: { profile_id: string; option_idx: number }[]
  counts: { option_idx: number; votes: number; voters: number }[]; canDelete: boolean; onChange: () => void
}) {
  const [busy, setBusy] = useState(false)
  const closed = !!poll.closes_at && new Date(poll.closes_at).getTime() < Date.now()
  const voters = counts[0]?.voters ?? 0
  const max = Math.max(1, ...counts.map((c) => c.votes))

  async function pick(i: number) {
    if (closed) return
    setBusy(true)
    const next = poll.multiple ? (myVotes.includes(i) ? myVotes.filter((x) => x !== i) : [...myVotes, i]) : (myVotes.includes(i) ? [] : [i])
    try { await setPollVote(poll.id, me.id, next); onChange() } finally { setBusy(false) }
  }

  return (
    <section className="card" style={{ gap: 10 }}>
      <div className="row row--between" style={{ alignItems: 'flex-start' }}>
        <span style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>{poll.question}</span>
        {closed ? <Chip>Clos</Chip> : poll.anonymous ? <Chip>Anonyme</Chip> : null}
      </div>
      {poll.options.map((o, i) => {
        const c = counts.find((x) => x.option_idx === i)?.votes ?? 0
        const pct = voters ? Math.round((c / voters) * 100) : 0
        const on = myVotes.includes(i)
        const names = poll.anonymous ? [] : allVotes.filter((v) => v.option_idx === i).map((v) => profiles.find((p) => p.id === v.profile_id)?.first_name).filter(Boolean)
        return (
          <button key={i} disabled={busy || closed} onClick={() => pick(i)} style={{ position: 'relative', minHeight: 48, borderRadius: 12, background: 'var(--surface-2)', border: `1px solid ${on ? 'var(--gold)' : 'var(--line-strong)'}`, overflow: 'hidden', padding: '8px 14px', textAlign: 'left' }}>
            <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(c / max) * 100}%`, background: 'rgba(233,192,74,.16)' }} />
            <span style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>{on ? '✓ ' : ''}{o}</span>
              <span className="muted" style={{ fontWeight: 600 }}>{pct} %</span>
            </span>
            {names.length > 0 && <span style={{ position: 'relative', display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{names.join(', ')}</span>}
          </button>
        )
      })}
      <div className="row row--between small muted">
        <span>{voters} réponse{voters > 1 ? 's' : ''} · {poll.multiple ? 'plusieurs choix' : 'un seul choix'} · {timeAgo(poll.created_at)}</span>
        {canDelete && <button className="link" style={{ minHeight: 24, fontSize: 12, color: 'var(--muted)' }} onClick={async () => { await deletePoll(poll.id); onChange() }}>Supprimer</button>}
      </div>
    </section>
  )
}

function PollForm({ me, onDone }: { me: Profile; onDone: () => void }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [multiple, setMultiple] = useState(false)
  const [anonymous, setAnonymous] = useState(false)
  const [days, setDays] = useState<number | null>(3)
  const [busy, setBusy] = useState(false)
  const valid = question.trim() && options.filter((o) => o.trim()).length >= 2

  return (
    <section className="card" style={{ gap: 10 }}>
      <span className="eyebrow">Nouveau sondage</span>
      <input className="input" placeholder="Question (ex. Repas d'équipe : quel soir ?)" value={question} onChange={(e) => setQuestion(e.target.value)} />
      {options.map((o, i) => (
        <input key={i} className="input" placeholder={`Choix ${i + 1}`} value={o} onChange={(e) => setOptions((x) => x.map((y, j) => (j === i ? e.target.value : y)))} />
      ))}
      {options.length < 6 && <button className="link" onClick={() => setOptions((x) => [...x, ''])}>+ Ajouter un choix</button>}
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <button className={`chip chip--ghost ${multiple ? 'is-active' : ''}`} onClick={() => setMultiple(!multiple)}>Plusieurs choix</button>
        <button className={`chip chip--ghost ${anonymous ? 'is-active' : ''}`} onClick={() => setAnonymous(!anonymous)}>Anonyme</button>
      </div>
      <span className="label">Clôture</span>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {[1, 3, 7].map((d) => <button key={d} className={`chip chip--ghost ${days === d ? 'is-active' : ''}`} onClick={() => setDays(d)}>{d} jour{d > 1 ? 's' : ''}</button>)}
        <button className={`chip chip--ghost ${days === null ? 'is-active' : ''}`} onClick={() => setDays(null)}>Jamais</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button className="btn btn--sm btn--secondary" onClick={onDone}>Annuler</button>
        <button className="btn btn--sm" disabled={busy || !valid} onClick={async () => {
          setBusy(true)
          const id = await createPoll(question.trim(), options.map((o) => o.trim()).filter(Boolean), multiple, anonymous, days ? new Date(Date.now() + days * 86_400_000).toISOString() : null, me.id)
          void notify('poll_created', undefined, { poll_id: id })
          setBusy(false); onDone()
        }}>Publier</button>
      </div>
    </section>
  )
}
