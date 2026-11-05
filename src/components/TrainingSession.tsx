import { useState } from 'react'
import { useAsync } from '../lib/useAsync'
import {
  catLabel, fetchExercises, fetchFeedback, fetchTrainingPlans, saveFeedback, saveTrainingPlan, THEMES,
  type Exercise, type Feedback, type PlanBlock, type TrainingPlan,
} from '../lib/data3'
import { isPlayer, isStaff, type Profile, type TeamEvent } from '../lib/types'
import { Avatar, Chip, Skeleton } from './ui'
import DiagramBoard from './DiagramBoard'

// ====================== Plan de séance ======================
export function SessionPlan({ event, me }: { event: TeamEvent; me: Profile }) {
  const staff = isStaff(me)
  const q = useAsync(async () => {
    const [plans, exercises] = await Promise.all([fetchTrainingPlans([event.id]), fetchExercises()])
    return { plan: plans[0] ?? null, exercises }
  }, [event.id])
  const [editing, setEditing] = useState(false)

  if (q.loading || !q.data) return <Skeleton h={160} />
  const { plan, exercises } = q.data
  if (editing && staff) return <PlanEditor event={event} plan={plan} exercises={exercises} onDone={() => { setEditing(false); void q.reload() }} />

  const total = plan?.blocks.reduce((a, b) => a + (b.minutes || 0), 0) ?? 0
  return (
    <div className="stack stack--lg">
      {!plan || (!plan.objective && plan.blocks.length === 0) ? (
        <section className="card card--sm center" style={{ gap: 8 }}>
          <span className="small muted">{staff ? "Pas encore de plan pour cette séance." : "Le staff n'a pas encore partagé le contenu de la séance."}</span>
          {staff && <button className="btn btn--sm" onClick={() => setEditing(true)}>Préparer la séance</button>}
        </section>
      ) : (
        <>
          <section className="card" style={{ gap: 8, borderColor: 'rgba(233,192,74,.45)' }}>
            <div className="row row--between">
              <span className="eyebrow" style={{ color: 'var(--gold)' }}>Objectif du jour</span>
              {plan.theme && <Chip>{plan.theme}</Chip>}
            </div>
            <span style={{ fontWeight: 700, fontSize: 17 }}>{plan.objective || 'Séance'}</span>
            {total > 0 && <span className="small muted">{plan.blocks.length} ateliers · {total} min</span>}
          </section>
          {plan.blocks.map((b, i) => {
            const ex = exercises.find((e) => e.id === b.exercise_id)
            return <BlockCard key={i} index={i} block={b} ex={ex} />
          })}
          {staff && <button className="btn btn--secondary btn--sm" onClick={() => setEditing(true)}>Modifier la séance</button>}
        </>
      )}
    </div>
  )
}

function BlockCard({ index, block, ex }: { index: number; block: PlanBlock; ex?: Exercise }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="card card--sm" style={{ gap: 10 }}>
      <button className="row" style={{ gap: 12, textAlign: 'left', color: 'inherit' }} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="gold" style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 20, width: 22 }}>{index + 1}</span>
        <div className="stack" style={{ gap: 1, flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600 }}>{ex?.title ?? block.label}</span>
          <span className="small muted">{[block.minutes ? `${block.minutes} min` : null, ex ? catLabel(ex.category) : null, ex?.players_count].filter(Boolean).join(' · ')}</span>
        </div>
        {ex && <span className="small muted">{open ? 'Masquer' : 'Voir'}</span>}
      </button>
      {block.note && <p className="small text-2">{block.note}</p>}
      {open && ex && <ExerciseBody ex={ex} />}
    </section>
  )
}

export function ExerciseBody({ ex }: { ex: Exercise }) {
  return (
    <div className="stack stack--md">
      {(ex.diagram.items.length > 0 || ex.diagram.arrows.length > 0) && <DiagramBoard value={ex.diagram} />}
      {ex.description && <p className="small text-2" style={{ whiteSpace: 'pre-line' }}>{ex.description}</p>}
      {ex.material && <span className="small muted">Matériel : {ex.material}</span>}
      {ex.coaching.length > 0 && (
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Points clés</span>
          {ex.coaching.map((c, i) => <span key={i} className="small text-2">· {c}</span>)}
        </div>
      )}
    </div>
  )
}

function PlanEditor({ event, plan, exercises, onDone }: { event: TeamEvent; plan: TrainingPlan | null; exercises: Exercise[]; onDone: () => void }) {
  const [objective, setObjective] = useState(plan?.objective ?? '')
  const [theme, setTheme] = useState(plan?.theme ?? '')
  const [blocks, setBlocks] = useState<PlanBlock[]>(plan?.blocks ?? [])
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (i: number, patch: Partial<PlanBlock>) => setBlocks((bs) => bs.map((b, k) => (k === i ? { ...b, ...patch } : b)))
  const move = (i: number, d: number) => setBlocks((bs) => { const c = [...bs]; const j = i + d; if (j < 0 || j >= c.length) return c; [c[i], c[j]] = [c[j], c[i]]; return c })

  return (
    <section className="card" style={{ gap: 12 }}>
      <span className="eyebrow">Préparer la séance</span>
      <input className="input" placeholder="Objectif du jour (ex. Sortir proprement de derrière)" value={objective} onChange={(e) => setObjective(e.target.value)} />
      <div className="scroll-x">
        {THEMES.map((t) => <button key={t} className={`chip chip--ghost ${theme === t ? 'is-active' : ''}`} style={{ minHeight: 36, padding: '0 12px' }} onClick={() => setTheme(theme === t ? '' : t)}>{t}</button>)}
      </div>
      <div className="hr" />
      {blocks.map((b, i) => {
        const ex = exercises.find((e) => e.id === b.exercise_id)
        return (
          <div key={i} className="stack" style={{ gap: 6 }}>
            <div className="row" style={{ gap: 8 }}>
              <span className="gold" style={{ fontWeight: 800, width: 18 }}>{i + 1}</span>
              {ex ? <span style={{ fontWeight: 600, flex: 1 }}>{ex.title}</span> : <input className="input" style={{ flex: 1 }} value={b.label} placeholder="Atelier" onChange={(e) => set(i, { label: e.target.value })} />}
              <input className="input" style={{ maxWidth: 70 }} inputMode="numeric" value={b.minutes || ''} placeholder="min" onChange={(e) => set(i, { minutes: Number(e.target.value) || 0 })} />
            </div>
            <div className="row" style={{ gap: 6 }}>
              <input className="input" style={{ flex: 1, minHeight: 42 }} value={b.note} placeholder="Consigne (facultatif)" onChange={(e) => set(i, { note: e.target.value })} />
              <button className="chip chip--ghost" aria-label="Monter" onClick={() => move(i, -1)}>↑</button>
              <button className="chip chip--ghost" aria-label="Descendre" onClick={() => move(i, 1)}>↓</button>
              <button className="chip chip--ghost" aria-label="Retirer" onClick={() => setBlocks((bs) => bs.filter((_, k) => k !== i))}>✕</button>
            </div>
          </div>
        )
      })}
      <div className="row" style={{ gap: 8 }}>
        <select className="input" value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 1 }}>
          <option value="">Ajouter depuis la bibliothèque…</option>
          {exercises.map((e) => <option key={e.id} value={e.id}>{catLabel(e.category)} · {e.title}</option>)}
        </select>
        <button className="btn btn--sm" style={{ width: 'auto' }} disabled={!pick} onClick={() => { const ex = exercises.find((e) => e.id === pick)!; setBlocks((bs) => [...bs, { exercise_id: ex.id, label: ex.title, minutes: ex.duration_min ?? 15, note: '' }]); setPick('') }}>Ajouter</button>
      </div>
      <button className="btn btn--secondary btn--sm" onClick={() => setBlocks((bs) => [...bs, { exercise_id: null, label: '', minutes: 10, note: '' }])}>Ajouter un atelier libre</button>
      <p className="small muted">Durée totale : {blocks.reduce((a, b) => a + (b.minutes || 0), 0)} min</p>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn--secondary btn--sm" onClick={onDone}>Annuler</button>
        <button className="btn btn--sm" disabled={busy} onClick={async () => { setBusy(true); try { await saveTrainingPlan({ event_id: event.id, objective: objective.trim() || null, theme: theme || null, blocks: blocks.filter((b) => b.exercise_id || b.label.trim()) }); onDone() } finally { setBusy(false) } }}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
    </section>
  )
}

// ====================== Ressenti après l'entraînement ======================
const FATIGUE = ['Très frais', 'Frais', 'Correct', 'Fatigué', 'Épuisé']
const RPE = ['', 'Très facile', 'Facile', 'Modéré', 'Assez dur', 'Dur', 'Dur', 'Très dur', 'Très dur', 'Extrême', 'Maximal']

export function SessionFeedback({ event, me, profiles }: { event: TeamEvent; me: Profile; profiles: Profile[] }) {
  const staff = isStaff(me)
  const started = Date.now() > new Date(event.starts_at).getTime()
  const q = useAsync(() => fetchFeedback([event.id]), [event.id])
  if (!started) return <section className="card card--sm center small muted">Le ressenti s'ouvre à la fin de la séance.</section>
  if (q.loading || !q.data) return <Skeleton h={160} />
  const all = q.data
  const mine = all.find((f) => f.profile_id === me.id) ?? null
  return (
    <div className="stack stack--lg">
      {isPlayer(me) && <FeedbackForm eventId={event.id} me={me} initial={mine} onSaved={() => void q.reload()} />}
      {staff && <FeedbackSummary list={all} profiles={profiles} />}
    </div>
  )
}

function FeedbackForm({ eventId, me, initial, onSaved }: { eventId: string; me: Profile; initial: Feedback | null; onSaved: () => void }) {
  const [fatigue, setFatigue] = useState(initial?.fatigue ?? 0)
  const [intensity, setIntensity] = useState(initial?.intensity ?? 0)
  const [comment, setComment] = useState(initial?.comment ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(!!initial)
  return (
    <section className="card" style={{ gap: 12 }}>
      <div className="row row--between">
        <span className="eyebrow">Ton ressenti</span>
        {saved && <Chip tone="gold">Envoyé</Chip>}
      </div>
      <span className="small text-2">Comment tu te sens après la séance ?</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 4 }}>
        {FATIGUE.map((l, i) => (
          <button key={l} onClick={() => { setFatigue(i + 1); setSaved(false) }} className={`segmented__btn ${fatigue === i + 1 ? (i >= 3 ? 'is-no' : 'is-yes') : ''}`} style={{ fontSize: 11.5, minHeight: 52, background: fatigue === i + 1 ? undefined : 'var(--ink)', lineHeight: 1.15, padding: '0 2px' }}>{l}</button>
        ))}
      </div>
      <span className="small text-2">Intensité de la séance (1 = très facile, 10 = maximal)</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0,1fr))', gap: 3 }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} onClick={() => { setIntensity(n); setSaved(false) }} className={`segmented__btn ${intensity === n ? 'is-yes' : ''}`} style={{ minHeight: 42, fontSize: 14, background: intensity === n ? undefined : 'var(--ink)', padding: 0 }}>{n}</button>
        ))}
      </div>
      {intensity > 0 && <span className="small gold" style={{ fontWeight: 600 }}>{RPE[intensity]}</span>}
      <textarea className="input" rows={2} style={{ padding: 12, minHeight: 70 }} placeholder="Une gêne, une douleur, un mot pour le staff ? (visible du staff seulement)" value={comment} onChange={(e) => { setComment(e.target.value); setSaved(false) }} />
      <button className="btn btn--sm" disabled={busy || !fatigue || !intensity || saved} onClick={async () => { setBusy(true); try { await saveFeedback({ event_id: eventId, profile_id: me.id, fatigue, intensity, comment: comment.trim() || null }); setSaved(true); onSaved() } finally { setBusy(false) } }}>{saved ? 'Merci, c’est noté' : busy ? 'Envoi…' : 'Envoyer mon ressenti'}</button>
    </section>
  )
}

export function FeedbackSummary({ list, profiles }: { list: Feedback[]; profiles: Profile[] }) {
  if (!list.length) return <section className="card card--sm center small muted">Aucun ressenti reçu pour l'instant.</section>
  const avgF = list.reduce((a, f) => a + f.fatigue, 0) / list.length
  const avgI = list.reduce((a, f) => a + f.intensity, 0) / list.length
  const who = (id: string) => profiles.find((p) => p.id === id)
  const sorted = [...list].sort((a, b) => b.fatigue - a.fatigue || b.intensity - a.intensity)
  return (
    <section className="card" style={{ gap: 12 }}>
      <span className="eyebrow">Ressentis du groupe · {list.length} réponse{list.length > 1 ? 's' : ''}</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Stat label="Fatigue moyenne" value={`${avgF.toFixed(1)} / 5`} hot={avgF >= 3.5} />
        <Stat label="Intensité moyenne" value={`${avgI.toFixed(1)} / 10`} hot={avgI >= 8} />
      </div>
      <div className="card--list" style={{ padding: 0 }}>
        {sorted.map((f) => {
          const p = who(f.profile_id)
          if (!p) return null
          return (
            <div key={f.profile_id} className="listrow">
              <Avatar p={p} />
              <div className="stack" style={{ gap: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{p.first_name}</span>
                {f.comment && <span className="small text-2">{f.comment}</span>}
              </div>
              <div className="stack" style={{ alignItems: 'flex-end', gap: 1 }}>
                <span className="small" style={{ fontWeight: 700, color: f.fatigue >= 4 ? 'var(--red)' : 'var(--text-2)' }}>{FATIGUE[f.fatigue - 1]}</span>
                <span className="small muted">RPE {f.intensity}</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Stat({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className="card card--sm" style={{ gap: 2, background: 'var(--ink)' }}>
      <span className="small muted">{label}</span>
      <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 22, color: hot ? 'var(--red)' : 'var(--text)' }}>{value}</span>
    </div>
  )
}
