import { useEffect, useMemo, useState } from 'react'
import { useAsync } from '../lib/useAsync'
import { addLiveEvent, deleteLiveEvent, fetchLive, fetchPlan, PHASE_LABELS, savePlan, setLive } from '../lib/data2'
import { saveResult } from '../lib/data'
import { notify } from '../lib/push'
import { fmtTime } from '../lib/format'
import { isCaptainOrStaff, isPlayer, isStaff, type ChecklistItem, type LiveKind, type LivePhase, type Profile, type TeamEvent, type TimelineItem } from '../lib/types'
import { Chip, Skeleton } from './ui'
import { IconCheck } from './Icons'

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const minus = (iso: string, min: number) => hhmm(new Date(new Date(iso).getTime() - min * 60_000))

function defaultTimeline(e: TeamEvent): TimelineItem[] {
  const away = e.is_home === false
  return [
    ...(away ? [{ time: minus(e.starts_at, 100), label: 'Départ en covoiturage', sub: 'Parking du stade Sévan' }] : []),
    { time: minus(e.starts_at, 75), label: 'RDV au vestiaire', sub: away ? `Sur place · ${e.location ?? ''}` : 'Stade Sévan' },
    { time: minus(e.starts_at, 50), label: 'Causerie', sub: 'Plan de match et coups de pied arrêtés' },
    { time: minus(e.starts_at, 40), label: 'Échauffement', sub: '25 minutes' },
    { time: minus(e.starts_at, 10), label: 'Retour au vestiaire', sub: 'Derniers mots du capitaine' },
    { time: fmtTime(e.starts_at), label: "Coup d'envoi", sub: e.title },
  ]
}
const DEFAULT_CHECKLIST: ChecklistItem[] = [
  'Licences et tablette de la feuille de match', 'Jeu de maillots', 'Brassard de capitaine', 'Trousse de soins et poche de glace',
  'Gourdes remplies', '10 ballons gonflés', 'Chasubles pour les remplaçants',
].map((label) => ({ label, done: false }))
const BAG = ['Crampons (moulés et vissés)', 'Protège-tibias', 'Survêtement du club', 'Serviette et affaires de douche', 'Gourde']

function useCountdown(iso: string) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t) }, [])
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return null
  const h = Math.floor(ms / 3600_000), m = Math.floor((ms % 3600_000) / 60_000)
  const d = Math.floor(h / 24)
  return d >= 1 ? `J-${d}` : `${h} h ${String(m).padStart(2, '0')}`
}

export default function MatchDay({ event, me, players, squadIds }: { event: TeamEvent; me: Profile; players: Profile[]; squadIds: string[] }) {
  const staff = isStaff(me)
  const canLive = isCaptainOrStaff(me)
  const countdown = useCountdown(event.starts_at)
  const plan = useAsync(() => fetchPlan(event.id), [event.id])
  const live = useAsync(() => fetchLive(event.id), [event.id])
  const [editPlan, setEditPlan] = useState(false)
  const [scorerPick, setScorerPick] = useState<LiveKind | null>(null)
  const [busy, setBusy] = useState(false)
  const [bag, setBag] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(`bag-${event.id}`) ?? '{}') } catch { return {} }
  })

  // Rafraîchit le direct toutes les 15 s pendant le match
  const inWindow = Date.now() > new Date(event.starts_at).getTime() - 3600_000 && Date.now() < new Date(event.starts_at).getTime() + 3 * 3600_000
  useEffect(() => {
    if (!inWindow) return
    const t = setInterval(() => { void live.reload() }, 15_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inWindow])

  const timeline = useMemo(() => plan.data?.timeline?.length ? plan.data.timeline : defaultTimeline(event), [plan.data, event])
  const checklist = plan.data?.checklist?.length ? plan.data.checklist : DEFAULT_CHECKLIST
  const roster = players.filter((p) => squadIds.length === 0 || squadIds.includes(p.id))

  if (plan.loading || live.loading) return <Skeleton h={300} />
  const lm = live.data?.live
  const lev = live.data?.events ?? []
  const phase: LivePhase = lm?.phase ?? 'pre'
  const gf = lm?.goals_for ?? 0, ga = lm?.goals_against ?? 0
  const home = event.is_home !== false
  const name = (id: string | null) => players.find((p) => p.id === id)?.first_name

  function minuteNow(): number | null {
    if (!lm?.started_at) return null
    const m = Math.floor((Date.now() - new Date(lm.started_at).getTime()) / 60_000) + 1
    return phase === 'second_half' ? 45 + m : phase === 'first_half' ? m : null
  }

  async function act(fn: () => Promise<void>) {
    setBusy(true)
    try { await fn(); await live.reload() } finally { setBusy(false) }
  }
  const setPhase = (p: LivePhase) => act(async () => {
    await setLive(event.id, { phase: p, started_at: p === 'first_half' || p === 'second_half' ? new Date().toISOString() : lm?.started_at ?? null, goals_for: gf, goals_against: ga })
    if (p === 'finished') void notify('live_final', event.id)
  })
  const addEvent = (kind: LiveKind, profileId: string | null) => act(async () => {
    const minute = minuteNow()
    await addLiveEvent(event.id, me.id, kind, minute, profileId, null)
    if (kind === 'goal_for' || kind === 'goal_against') {
      const nf = gf + (kind === 'goal_for' ? 1 : 0), na = ga + (kind === 'goal_against' ? 1 : 0)
      await setLive(event.id, { goals_for: nf, goals_against: na, phase: phase === 'pre' ? 'first_half' : phase, started_at: lm?.started_at ?? new Date().toISOString() })
      void notify('live_goal', event.id, { scorer: profileId ? name(profileId) : null, minute })
    }
    setScorerPick(null)
  })
  const undo = (id: string, kind: LiveKind) => act(async () => {
    await deleteLiveEvent(id)
    if (kind === 'goal_for') await setLive(event.id, { goals_for: Math.max(0, gf - 1) })
    if (kind === 'goal_against') await setLive(event.id, { goals_against: Math.max(0, ga - 1) })
  })

  const toggleCheck = async (i: number) => {
    if (!staff) return
    const next = checklist.map((c, j) => (j === i ? { ...c, done: !c.done } : c))
    await savePlan(event.id, timeline, next)
    await plan.reload()
  }
  const toggleBag = (k: string) => {
    const next = { ...bag, [k]: !bag[k] }
    setBag(next)
    try { localStorage.setItem(`bag-${event.id}`, JSON.stringify(next)) } catch { /* stockage indisponible */ }
  }

  const KIND_TXT: Record<LiveKind, string> = { goal_for: 'But Ardziv', goal_against: 'But adverse', yellow: 'Carton jaune', red: 'Carton rouge', sub: 'Changement', note: 'Note' }

  return (
    <div className="stack stack--lg">
      <section className="card" style={{ background: 'var(--gold)', color: 'var(--ink)', borderColor: 'var(--gold)', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Jour de match · {home ? 'Domicile' : 'Extérieur'}</span>
        <span className="display" style={{ fontSize: 34 }}>{event.title}</span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Coup d'envoi {fmtTime(event.starts_at)}{countdown ? ` · dans ${countdown}` : ''}{event.location ? ` · ${event.location}` : ''}</span>
      </section>

      {/* ---------- Score en direct ---------- */}
      <section className="card" style={{ gap: 12 }}>
        <div className="row row--between">
          <span className="eyebrow" style={{ color: phase === 'first_half' || phase === 'second_half' ? '#FF8A7C' : undefined }}>
            {phase === 'first_half' || phase === 'second_half' ? '● ' : ''}Score en direct
          </span>
          <Chip>{PHASE_LABELS[phase]}{minuteNow() ? ` · ${minuteNow()}′` : ''}</Chip>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: 10 }}>
          <span className="display" style={{ fontSize: 18, fontStyle: 'normal' }}>{home ? 'Ardziv 2' : event.opponent}</span>
          <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 48, lineHeight: 1, color: 'var(--gold)' }}>{home ? `${gf} – ${ga}` : `${ga} – ${gf}`}</span>
          <span className="display" style={{ fontSize: 18, fontStyle: 'normal', textAlign: 'right' }}>{home ? event.opponent : 'Ardziv 2'}</span>
        </div>

        {canLive && phase !== 'finished' && (
          <>
            <div className="scroll-x">
              {phase === 'pre' && <button className="chip chip--ghost is-active" onClick={() => setPhase('first_half')} disabled={busy}>Coup d'envoi</button>}
              {phase === 'first_half' && <button className="chip chip--ghost" onClick={() => setPhase('half_time')} disabled={busy}>Mi-temps</button>}
              {phase === 'half_time' && <button className="chip chip--ghost is-active" onClick={() => setPhase('second_half')} disabled={busy}>Reprise</button>}
              {phase === 'second_half' && <button className="chip chip--ghost" onClick={() => setPhase('finished')} disabled={busy}>Fin du match</button>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="btn btn--sm" disabled={busy} onClick={() => setScorerPick('goal_for')}>+ But Ardziv</button>
              <button className="btn btn--sm btn--secondary" disabled={busy} onClick={() => addEvent('goal_against', null)}>+ But adverse</button>
              <button className="btn btn--sm btn--secondary" disabled={busy} onClick={() => setScorerPick('yellow')}>Carton jaune</button>
              <button className="btn btn--sm btn--secondary" disabled={busy} onClick={() => setScorerPick('red')}>Carton rouge</button>
            </div>
            {scorerPick && (
              <div className="stack" style={{ gap: 8 }}>
                <span className="small text-2">{scorerPick === 'goal_for' ? 'Qui a marqué ?' : 'Quel joueur ?'}</span>
                <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                  {roster.map((p) => <button key={p.id} className="chip chip--ghost" style={{ minHeight: 36 }} onClick={() => addEvent(scorerPick, p.id)}>{p.first_name}</button>)}
                  {scorerPick === 'goal_for' && <button className="chip chip--ghost" style={{ minHeight: 36 }} onClick={() => addEvent('goal_for', null)}>Je ne sais pas</button>}
                  <button className="chip" style={{ minHeight: 36 }} onClick={() => setScorerPick(null)}>Annuler</button>
                </div>
              </div>
            )}
          </>
        )}
        {canLive && phase === 'finished' && (
          <button className="btn btn--sm" disabled={busy} onClick={() => act(async () => { await saveResult(event.id, gf, ga); void notify('result', event.id) })}>
            Valider {gf}-{ga} comme résultat officiel
          </button>
        )}

        {lev.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            {lev.map((e) => (
              <div key={e.id} className="row row--between small">
                <span><b className="gold" style={{ display: 'inline-block', width: 34 }}>{e.minute ? `${e.minute}′` : ''}</b>{KIND_TXT[e.kind]}{e.profile_id ? ` · ${name(e.profile_id)}` : ''}</span>
                {canLive && <button className="link" style={{ minHeight: 28, color: 'var(--muted)' }} onClick={() => undo(e.id, e.kind)}>Annuler</button>}
              </div>
            ))}
          </div>
        )}
        <p className="small muted">{canLive ? "Chaque but prévient tout le groupe, même ceux qui ne sont pas au stade." : 'Saisi en direct par le capitaine ou le staff. Mise à jour automatique.'}</p>
      </section>

      {/* ---------- Déroulé ---------- */}
      <section className="card" style={{ gap: 4 }}>
        <div className="row row--between" style={{ marginBottom: 6 }}>
          <span className="eyebrow">Déroulé</span>
          {staff && !editPlan && <button className="link" onClick={() => setEditPlan(true)}>Modifier</button>}
        </div>
        {editPlan ? (
          <TimelineEditor initial={timeline} onCancel={() => setEditPlan(false)} onSave={async (t) => { await savePlan(event.id, t, checklist); setEditPlan(false); await plan.reload() }} />
        ) : timeline.map((t, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '52px 14px minmax(0,1fr)', gap: 10, alignItems: 'start', padding: '6px 0' }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--gold)' }}>{t.time}</span>
            <span style={{ width: 10, height: 10, borderRadius: 99, border: '2px solid var(--gold)', marginTop: 4 }} />
            <div className="stack" style={{ gap: 0 }}><span style={{ fontWeight: 600 }}>{t.label}</span>{t.sub && <span className="small muted">{t.sub}</span>}</div>
          </div>
        ))}
      </section>

      {/* ---------- Checklists ---------- */}
      {staff && (
        <Checklist title="Checklist du staff" items={checklist.map((c) => ({ label: c.label, done: c.done }))} onToggle={toggleCheck} />
      )}
      {isPlayer(me) && (
        <Checklist title="Ton sac" items={BAG.map((b) => ({ label: b, done: !!bag[b] }))} onToggle={(i) => toggleBag(BAG[i])} note="Enregistré seulement sur ton téléphone." />
      )}
    </div>
  )
}

function Checklist({ title, items, onToggle, note }: { title: string; items: { label: string; done: boolean }[]; onToggle: (i: number) => void; note?: string }) {
  const n = items.filter((i) => i.done).length
  return (
    <section className="card" style={{ gap: 4 }}>
      <div className="row row--between" style={{ marginBottom: 4 }}>
        <span className="eyebrow">{title}</span>
        <span className="small gold" style={{ fontWeight: 700 }}>{n} / {items.length}</span>
      </div>
      {items.map((it, i) => (
        <button key={it.label} className="row" style={{ minHeight: 44, gap: 12, color: it.done ? 'var(--muted)' : 'var(--text)' }} onClick={() => onToggle(i)} aria-pressed={it.done}>
          <span style={{ width: 24, height: 24, borderRadius: 8, border: `2px solid ${it.done ? 'var(--gold)' : '#4A4A50'}`, background: it.done ? 'var(--gold)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            {it.done && <IconCheck size={14} stroke="var(--ink)" />}
          </span>
          <span style={{ fontWeight: 500, textDecoration: it.done ? 'line-through' : 'none' }}>{it.label}</span>
        </button>
      ))}
      {note && <span className="small muted" style={{ marginTop: 4 }}>{note}</span>}
    </section>
  )
}

function TimelineEditor({ initial, onSave, onCancel }: { initial: TimelineItem[]; onSave: (t: TimelineItem[]) => Promise<void>; onCancel: () => void }) {
  const [rows, setRows] = useState<TimelineItem[]>(initial.map((r) => ({ ...r })))
  const [busy, setBusy] = useState(false)
  const set = (i: number, patch: Partial<TimelineItem>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  return (
    <div className="stack stack--md">
      {rows.map((r, i) => (
        <div key={i} className="stack" style={{ gap: 6, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
          <div className="row">
            <input className="input" type="time" value={r.time} onChange={(e) => set(i, { time: e.target.value })} style={{ maxWidth: 110 }} aria-label="Heure" />
            <input className="input" value={r.label} onChange={(e) => set(i, { label: e.target.value })} aria-label="Étape" />
            <button className="link" style={{ color: 'var(--red)' }} onClick={() => setRows((x) => x.filter((_, j) => j !== i))} aria-label="Supprimer l'étape">✕</button>
          </div>
          <input className="input" placeholder="Précision (facultatif)" value={r.sub ?? ''} onChange={(e) => set(i, { sub: e.target.value })} />
        </div>
      ))}
      <button className="btn btn--sm btn--secondary" onClick={() => setRows((x) => [...x, { time: '', label: '' }])}>+ Ajouter une étape</button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button className="btn btn--sm btn--secondary" onClick={onCancel}>Annuler</button>
        <button className="btn btn--sm" disabled={busy} onClick={async () => { setBusy(true); await onSave(rows.filter((r) => r.label.trim()).sort((a, b) => a.time.localeCompare(b.time))); setBusy(false) }}>Enregistrer</button>
      </div>
    </div>
  )
}
