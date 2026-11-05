import { useState } from 'react'
import { useAsync } from '../lib/useAsync'
import { assignDuty, fetchAllDuties, setDutyDone, weekStart } from '../lib/data2'
import { notify } from '../lib/push'
import { DUTY_LABELS, isCaptainOrStaff, isPlayer, type Duty, type Profile } from '../lib/types'
import { Avatar, Skeleton } from './ui'
import { IconCheck } from './Icons'

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const weekLabel = (iso: string) => {
  const d = new Date(iso + 'T12:00:00')
  return `Semaine du ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(d)}`
}

/** Tâches tournantes : rotation automatique équitable entre les joueurs. */
export default function Duties({ me, profiles }: { me: Profile; profiles: Profile[] }) {
  const canAssign = isCaptainOrStaff(me)
  const q = useAsync(fetchAllDuties, [])
  const [week, setWeek] = useState(weekStart())
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  if (q.loading || !q.data) return <Skeleton h={220} />
  const all = q.data
  const players = profiles.filter((p) => isPlayer(p))
  const thisWeek = all.filter((d) => d.week_start === week)
  const name = (id: string) => profiles.find((p) => p.id === id)

  // Rotation : pour chaque tâche, le joueur qui l'a faite le moins (puis le plus anciennement) la prend.
  function nextFor(label: string, taken: Set<string>): string | null {
    const history = all.filter((d) => d.label === label && d.week_start < week)
    const score = (pid: string) => {
      const mine = history.filter((d) => d.profile_id === pid)
      const last = mine.reduce((m, d) => (d.week_start > m ? d.week_start : m), '0000')
      return { n: mine.length, last }
    }
    const pool = players.filter((p) => !taken.has(p.id))
    if (!pool.length) return null
    pool.sort((a, b) => { const sa = score(a.id), sb = score(b.id); return sa.n - sb.n || sa.last.localeCompare(sb.last) || a.first_name.localeCompare(b.first_name) })
    return pool[0].id
  }

  async function generate() {
    setBusy(true)
    try {
      const taken = new Set<string>()
      for (const label of DUTY_LABELS) {
        if (thisWeek.some((d) => d.label === label)) { const ex = thisWeek.find((d) => d.label === label)!; taken.add(ex.profile_id); continue }
        const pid = nextFor(label, taken)
        if (!pid) continue
        taken.add(pid)
        await assignDuty(label, pid, week)
      }
      void notify('duties_assigned', undefined, { week })
      await q.reload()
    } finally { setBusy(false) }
  }

  async function reassign(label: string, pid: string) {
    setBusy(true)
    try { await assignDuty(label, pid, week); setEditing(null); await q.reload() } finally { setBusy(false) }
  }

  const row = (label: string, d: Duty | undefined) => {
    const p = d ? name(d.profile_id) : undefined
    const mine = d?.profile_id === me.id
    return (
      <div key={label} className="stack" style={{ gap: 8, padding: '10px 0', borderTop: '1px solid var(--line)' }}>
        <div className="row row--between">
          <div className="stack" style={{ gap: 1 }}>
            <span style={{ fontWeight: 600 }}>{label}</span>
            <span className="small" style={{ color: mine ? 'var(--gold)' : 'var(--muted)', fontWeight: mine ? 700 : 500 }}>{p ? `${p.first_name}${mine ? ' · toi' : ''}` : 'Personne'}</span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {d && (mine || canAssign) && (
              <button aria-label={d.done ? 'Marquer comme non faite' : 'Marquer comme faite'} disabled={busy}
                onClick={async () => { setBusy(true); await setDutyDone(d.id, !d.done); await q.reload(); setBusy(false) }}
                style={{ width: 36, height: 36, borderRadius: 10, border: `2px solid ${d.done ? 'var(--gold)' : '#4A4A50'}`, background: d.done ? 'var(--gold)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {d.done && <IconCheck size={16} stroke="var(--ink)" />}
              </button>
            )}
            {canAssign && <button className="link" onClick={() => setEditing(editing === label ? null : label)}>{p ? 'Changer' : 'Choisir'}</button>}
          </div>
        </div>
        {editing === label && (
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {players.map((pp) => <button key={pp.id} className={`chip chip--ghost ${d?.profile_id === pp.id ? 'is-active' : ''}`} style={{ minHeight: 34 }} onClick={() => reassign(label, pp.id)}>{pp.first_name}</button>)}
          </div>
        )}
      </div>
    )
  }

  const mineThisWeek = thisWeek.filter((d) => d.profile_id === me.id)

  return (
    <div className="stack stack--lg">
      <div className="row row--between">
        <button className="link" onClick={() => setWeek(addDays(week, -7))}>‹ Précédente</button>
        <span style={{ fontWeight: 700 }}>{weekLabel(week)}</span>
        <button className="link" onClick={() => setWeek(addDays(week, 7))}>Suivante ›</button>
      </div>

      {mineThisWeek.length > 0 && (
        <section className="card card--sm" style={{ borderColor: 'rgba(233,192,74,.4)', gap: 4 }}>
          <span className="eyebrow" style={{ color: 'var(--gold)' }}>Ta tâche cette semaine</span>
          {mineThisWeek.map((d) => <span key={d.id} style={{ fontWeight: 600 }}>{d.label}{d.done ? ' · faite' : ''}</span>)}
        </section>
      )}

      <section className="card" style={{ gap: 0, paddingTop: 10 }}>
        {DUTY_LABELS.map((l) => row(l, thisWeek.find((d) => d.label === l)))}
      </section>

      {canAssign && (
        <button className="btn btn--sm" disabled={busy || players.length === 0} onClick={generate}>
          {thisWeek.length === DUTY_LABELS.length ? 'Rotation complète pour cette semaine' : 'Répartir automatiquement'}
        </button>
      )}
      <p className="small muted">La répartition automatique donne chaque tâche au joueur qui l'a faite le moins souvent. Chacun reçoit une notification.</p>

      <section className="card" style={{ gap: 8 }}>
        <span className="eyebrow">Équité de la saison</span>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {players.map((p) => {
            const n = all.filter((d) => d.profile_id === p.id).length
            return <span key={p.id} className="chip" style={{ gap: 6 }}><Avatar p={p} me={p.id === me.id} />{p.first_name} · {n}</span>
          })}
        </div>
      </section>
    </div>
  )
}
