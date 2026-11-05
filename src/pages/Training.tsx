import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'
import { fetchEvents, fetchProfiles } from '../lib/data'
import {
  catLabel, deleteExercise, deleteProgram, deleteTest, EX_CATEGORIES, fetchExercises, fetchPrograms, fetchTests, fetchTrainingPlans,
  PROGRAM_KINDS, saveExercise, saveProgram, TESTS, toggleProgress, addTest,
  type Diagram, type Exercise, type Program, type TestDef, type TestResult,
} from '../lib/data3'
import { fmtDay, fmtDow, fmtTime } from '../lib/format'
import { isPlayer, isStaff, type Profile } from '../lib/types'
import { Avatar, PageTitle, Skeleton } from '../components/ui'
import DiagramBoard from '../components/DiagramBoard'
import { ExerciseBody } from '../components/TrainingSession'
import { notify } from '../lib/push'

type Tab = 'semaine' | 'exercices' | 'tests' | 'programmes'
const TABS: [Tab, string][] = [['semaine', 'Semaine'], ['exercices', 'Exercices'], ['tests', 'Tests'], ['programmes', 'Programmes']]

export default function Training() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.some(([k]) => k === params.get('onglet')) ? params.get('onglet') : 'semaine') as Tab
  const q = useAsync(fetchProfiles, [])
  if (!profile || !q.data) return <><Skeleton h={60} /><Skeleton h={240} /></>
  const profiles = q.data
  return (
    <>
      <PageTitle kicker="Préparer, progresser" title="Entraînement" />
      <div className="segmented" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
        {TABS.map(([k, l]) => <button key={k} className={`segmented__btn ${tab === k ? 'is-yes' : ''}`} style={{ fontSize: 13 }} onClick={() => setParams(k === 'semaine' ? {} : { onglet: k }, { replace: true })}>{l}</button>)}
      </div>
      {tab === 'semaine' && <Week />}
      {tab === 'exercices' && <Library me={profile} />}
      {tab === 'tests' && <Tests me={profile} profiles={profiles} />}
      {tab === 'programmes' && <Programs me={profile} profiles={profiles} />}
    </>
  )
}

// ====================== Semaine ======================
function Week() {
  const q = useAsync(async () => {
    const from = new Date(Date.now() - 2 * 86_400_000).toISOString()
    const to = new Date(Date.now() + 14 * 86_400_000).toISOString()
    const events = await fetchEvents(from, to)
    const plans = await fetchTrainingPlans(events.filter((e) => e.type === 'training').map((e) => e.id))
    return { events, plans }
  }, [])
  if (q.loading || !q.data) return <Skeleton h={200} />
  const { events, plans } = q.data
  if (!events.length) return <p className="muted">Rien de prévu sur les deux prochaines semaines.</p>
  return (
    <section className="stack stack--md">
      <span className="eyebrow">Les deux prochaines semaines</span>
      {events.map((e) => {
        const plan = plans.find((p) => p.event_id === e.id)
        const isMatch = e.type === 'match'
        const past = new Date(e.starts_at).getTime() < Date.now()
        const minutes = plan?.blocks.reduce((a, b) => a + (b.minutes || 0), 0) ?? 0
        return (
          <Link key={e.id} to={`/evenement/${e.id}${e.type === 'training' ? (past ? '?onglet=ressenti' : '?onglet=seance') : ''}`} className="card card--sm" style={{ display: 'grid', gridTemplateColumns: '48px minmax(0,1fr)', gap: 14, color: 'inherit', padding: 12, opacity: past ? 0.7 : 1 }}>
            <div className={`datebox ${isMatch ? 'datebox--gold' : ''}`} style={{ height: '100%' }}><span>{fmtDow(e.starts_at)}</span><span>{fmtDay(e.starts_at)}</span></div>
            <div className="stack" style={{ gap: 3, justifyContent: 'center' }}>
              <div className="row row--between">
                <span className="eyebrow" style={{ color: isMatch ? 'var(--gold)' : undefined }}>{isMatch ? 'Match' : e.type === 'training' ? (plan?.theme ?? 'Entraînement') : 'Événement'}</span>
                <span className="small muted" style={{ fontWeight: 600 }}>{fmtTime(e.starts_at)}</span>
              </div>
              <span style={{ fontWeight: 600 }}>{isMatch ? e.title : plan?.objective || e.title}</span>
              {e.type === 'training' && <span className="small muted">{plan && plan.blocks.length ? `${plan.blocks.length} ateliers · ${minutes} min` : past ? 'Donne ton ressenti' : 'Contenu à venir'}</span>}
            </div>
          </Link>
        )
      })}
    </section>
  )
}

// ====================== Bibliothèque d'exercices ======================
const EMPTY: Omit<Exercise, 'id' | 'created_by'> = { title: '', category: 'technique', duration_min: 15, players_count: '', material: '', description: '', coaching: [], diagram: { items: [], arrows: [] } }

function Library({ me }: { me: Profile }) {
  const staff = isStaff(me)
  const q = useAsync(fetchExercises, [])
  const [cat, setCat] = useState('all')
  const [open, setOpen] = useState<string | null>(null)
  const [editing, setEditing] = useState<(Omit<Exercise, 'id' | 'created_by'> & { id?: string }) | null>(null)
  if (q.loading || !q.data) return <Skeleton h={200} />
  if (editing) return <ExerciseEditor value={editing} me={me} onDone={() => { setEditing(null); void q.reload() }} />
  const list = q.data.filter((e) => cat === 'all' || e.category === cat)
  return (
    <div className="stack stack--md">
      {staff && <button className="btn btn--sm" onClick={() => setEditing({ ...EMPTY })}>Nouvel exercice</button>}
      <div className="scroll-x">
        {[['all', 'Tous'] as [string, string], ...EX_CATEGORIES].map(([k, l]) => (
          <button key={k} className={`chip chip--ghost ${cat === k ? 'is-active' : ''}`} style={{ minHeight: 36, padding: '0 12px' }} onClick={() => setCat(k)}>{l}</button>
        ))}
      </div>
      {list.length === 0 && <p className="muted small">Aucun exercice dans cette catégorie.</p>}
      {list.map((ex) => (
        <section key={ex.id} className="card card--sm" style={{ gap: 10 }}>
          <button className="stack" style={{ gap: 2, textAlign: 'left', color: 'inherit' }} onClick={() => setOpen(open === ex.id ? null : ex.id)} aria-expanded={open === ex.id}>
            <div className="row row--between"><span className="eyebrow">{catLabel(ex.category)}</span><span className="small muted">{ex.duration_min ? `${ex.duration_min} min` : ''}</span></div>
            <span style={{ fontWeight: 600 }}>{ex.title}</span>
            {ex.players_count && <span className="small muted">{ex.players_count}</span>}
          </button>
          {open === ex.id && (
            <>
              <ExerciseBody ex={ex} />
              {staff && (
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn--secondary btn--sm" onClick={() => setEditing({ ...ex })}>Modifier</button>
                  <button className="btn btn--secondary btn--sm" style={{ color: 'var(--red)' }} onClick={async () => { if (confirm('Supprimer cet exercice ?')) { await deleteExercise(ex.id); void q.reload() } }}>Supprimer</button>
                </div>
              )}
            </>
          )}
        </section>
      ))}
    </div>
  )
}

function ExerciseEditor({ value, me, onDone }: { value: Omit<Exercise, 'id' | 'created_by'> & { id?: string }; me: Profile; onDone: () => void }) {
  const [ex, setEx] = useState(value)
  const [coaching, setCoaching] = useState(value.coaching.join('\n'))
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<typeof ex>) => setEx((e) => ({ ...e, ...patch }))
  return (
    <section className="card" style={{ gap: 12 }}>
      <span className="eyebrow">{ex.id ? 'Modifier l’exercice' : 'Nouvel exercice'}</span>
      <input className="input" placeholder="Nom (ex. Rondo 5 contre 2)" value={ex.title} onChange={(e) => set({ title: e.target.value })} />
      <div className="scroll-x">
        {EX_CATEGORIES.map(([k, l]) => <button key={k} className={`chip chip--ghost ${ex.category === k ? 'is-active' : ''}`} style={{ minHeight: 36, padding: '0 12px' }} onClick={() => set({ category: k })}>{l}</button>)}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <input className="input" inputMode="numeric" placeholder="Durée (min)" value={ex.duration_min ?? ''} onChange={(e) => set({ duration_min: Number(e.target.value) || null })} />
        <input className="input" placeholder="Joueurs (ex. 7 + 2 GB)" value={ex.players_count ?? ''} onChange={(e) => set({ players_count: e.target.value })} />
      </div>
      <input className="input" placeholder="Matériel (plots, chasubles, mini-buts…)" value={ex.material ?? ''} onChange={(e) => set({ material: e.target.value })} />
      <span className="label">Schéma</span>
      <DiagramBoard value={ex.diagram} onChange={(d: Diagram) => set({ diagram: d })} />
      <textarea className="input" rows={4} style={{ padding: 12, minHeight: 100 }} placeholder="Déroulement et règles" value={ex.description ?? ''} onChange={(e) => set({ description: e.target.value })} />
      <textarea className="input" rows={3} style={{ padding: 12, minHeight: 80 }} placeholder="Points clés, un par ligne" value={coaching} onChange={(e) => setCoaching(e.target.value)} />
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn--secondary btn--sm" onClick={onDone}>Annuler</button>
        <button className="btn btn--sm" disabled={busy || !ex.title.trim()} onClick={async () => { setBusy(true); try { await saveExercise({ ...ex, title: ex.title.trim(), coaching: coaching.split('\n').map((s) => s.trim()).filter(Boolean) }, me.id); onDone() } finally { setBusy(false) } }}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
    </section>
  )
}

// ====================== Tests physiques ======================
function Tests({ me, profiles }: { me: Profile; profiles: Profile[] }) {
  const staff = isStaff(me)
  const players = profiles.filter(isPlayer)
  const [who, setWho] = useState<string>(isPlayer(me) ? me.id : players[0]?.id ?? '')
  const [view, setView] = useState<'joueur' | 'equipe' | 'saisie'>('joueur')
  const q = useAsync(() => fetchTests(staff ? undefined : me.id), [me.id])
  if (q.loading || !q.data) return <Skeleton h={200} />
  const all = q.data
  return (
    <div className="stack stack--lg">
      {staff && (
        <div className="segmented">
          {([['joueur', 'Par joueur'], ['equipe', 'Classement'], ['saisie', 'Saisir']] as const).map(([k, l]) => <button key={k} className={`segmented__btn ${view === k ? 'is-yes' : ''}`} onClick={() => setView(k)}>{l}</button>)}
        </div>
      )}
      {view === 'saisie' && staff && <TestEntry me={me} players={players} onSaved={() => { void q.reload(); setView('equipe') }} />}
      {view === 'equipe' && staff && <TestRanking all={all} players={players} />}
      {view === 'joueur' && (
        <>
          {staff && (
            <select className="input" value={who} onChange={(e) => setWho(e.target.value)}>
              {players.map((p) => <option key={p.id} value={p.id}>{p.first_name}{p.last_name ? ` ${p.last_name}` : ''}</option>)}
            </select>
          )}
          <PlayerTests results={all.filter((r) => r.profile_id === who)} canAdd={who === me.id} me={me} canDelete={staff} onChange={() => void q.reload()} />
        </>
      )}
    </div>
  )
}

function PlayerTests({ results, canAdd, me, canDelete, onChange }: { results: TestResult[]; canAdd: boolean; me: Profile; canDelete: boolean; onChange: () => void }) {
  const [adding, setAdding] = useState(false)
  const done = TESTS.filter((t) => results.some((r) => r.test === t.k))
  return (
    <div className="stack stack--md">
      {done.length === 0 && <section className="card card--sm center small muted">Aucun test enregistré pour l'instant. Les tests de début de saison et de mi-saison apparaîtront ici, avec ta courbe de progression.</section>}
      {done.map((t) => <TestCurve key={t.k} def={t} rows={results.filter((r) => r.test === t.k)} canDelete={canDelete} onDelete={async (id) => { await deleteTest(id); onChange() }} />)}
      {canAdd && (adding ? <AddOwnTest me={me} onDone={() => { setAdding(false); onChange() }} /> : <button className="btn btn--secondary btn--sm" onClick={() => setAdding(true)}>Ajouter un résultat</button>)}
    </div>
  )
}

function TestCurve({ def, rows, canDelete, onDelete }: { def: TestDef; rows: TestResult[]; canDelete: boolean; onDelete: (id: string) => void }) {
  const vals = rows.map((r) => Number(r.value))
  const last = vals[vals.length - 1]
  const first = vals[0]
  const diff = last - first
  const good = def.better === 'up' ? diff > 0 : diff < 0
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const pts = vals.map((v, i) => [vals.length === 1 ? 50 : (i / (vals.length - 1)) * 100, 36 - ((v - min) / span) * 30])
  const [open, setOpen] = useState(false)
  return (
    <section className="card card--sm" style={{ gap: 10 }}>
      <button className="row row--between" style={{ color: 'inherit', textAlign: 'left' }} onClick={() => setOpen((v) => !v)}>
        <div className="stack" style={{ gap: 1 }}>
          <span className="eyebrow">{def.label}</span>
          <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 24 }}>{fmtNum(last)} <span className="small muted" style={{ fontFamily: 'inherit' }}>{def.unit}</span></span>
        </div>
        {vals.length > 1 && <span className="small" style={{ fontWeight: 700, color: diff === 0 ? 'var(--muted)' : good ? 'var(--gold)' : 'var(--red)' }}>{diff > 0 ? '+' : ''}{fmtNum(diff)} {def.unit}</span>}
      </button>
      {vals.length > 1 && (
        <svg viewBox="-4 0 108 40" style={{ width: '100%', height: 64 }} aria-label={`Progression ${def.label}`}>
          <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--gold)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
          {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.8" fill="var(--gold)" />)}
        </svg>
      )}
      {open && (
        <div className="stack" style={{ gap: 4 }}>
          {[...rows].reverse().map((r) => (
            <div key={r.id} className="row row--between small">
              <span className="muted">{new Date(r.tested_on).toLocaleDateString('fr-FR')}</span>
              <span className="row" style={{ gap: 10 }}><span style={{ fontWeight: 600 }}>{fmtNum(Number(r.value))} {def.unit}</span>{canDelete && <button className="muted" aria-label="Supprimer" onClick={() => onDelete(r.id)}>✕</button>}</span>
            </div>
          ))}
          <span className="small muted">{def.hint}</span>
        </div>
      )}
    </section>
  )
}
const fmtNum = (n: number) => (Math.round(n * 100) / 100).toLocaleString('fr-FR')

function AddOwnTest({ me, onDone }: { me: Profile; onDone: () => void }) {
  const [test, setTest] = useState(TESTS[0].k)
  const [value, setValue] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const def = TESTS.find((t) => t.k === test)!
  return (
    <section className="card" style={{ gap: 10 }}>
      <select className="input" value={test} onChange={(e) => setTest(e.target.value)}>{TESTS.map((t) => <option key={t.k} value={t.k}>{t.label} ({t.unit})</option>)}</select>
      <span className="small muted">{def.hint}</span>
      <div className="row" style={{ gap: 8 }}>
        <input className="input" inputMode="decimal" placeholder={`Valeur en ${def.unit}`} value={value} onChange={(e) => setValue(e.target.value)} />
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn--secondary btn--sm" onClick={onDone}>Annuler</button>
        <button className="btn btn--sm" disabled={!parse(value)} onClick={async () => { await addTest(me.id, test, parse(value)!, date, me.id); onDone() }}>Enregistrer</button>
      </div>
    </section>
  )
}
const parse = (s: string) => { const n = Number(s.replace(',', '.')); return s.trim() && Number.isFinite(n) && n > 0 ? n : null }

function TestEntry({ me, players, onSaved }: { me: Profile; players: Profile[]; onSaved: () => void }) {
  const [test, setTest] = useState(TESTS[0].k)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [vals, setVals] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const def = TESTS.find((t) => t.k === test)!
  const filled = Object.entries(vals).filter(([, v]) => parse(v) != null)
  return (
    <section className="card" style={{ gap: 10 }}>
      <span className="eyebrow">Séance de tests</span>
      <select className="input" value={test} onChange={(e) => setTest(e.target.value)}>{TESTS.map((t) => <option key={t.k} value={t.k}>{t.label} ({t.unit})</option>)}</select>
      <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <span className="small muted">{def.hint}. Laisse vide pour les absents.</span>
      {players.map((p) => (
        <div key={p.id} className="row" style={{ gap: 10 }}>
          <Avatar p={p} />
          <span style={{ flex: 1, fontWeight: 600 }}>{p.first_name}</span>
          <input className="input" inputMode="decimal" style={{ maxWidth: 110, minHeight: 42 }} placeholder={def.unit} value={vals[p.id] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [p.id]: e.target.value }))} />
        </div>
      ))}
      <button className="btn btn--sm" disabled={busy || !filled.length} onClick={async () => { setBusy(true); try { for (const [pid, v] of filled) await addTest(pid, test, parse(v)!, date, me.id); onSaved() } finally { setBusy(false) } }}>{busy ? 'Enregistrement…' : `Enregistrer ${filled.length} résultat${filled.length > 1 ? 's' : ''}`}</button>
    </section>
  )
}

function TestRanking({ all, players }: { all: TestResult[]; players: Profile[] }) {
  const [test, setTest] = useState(TESTS[0].k)
  const def = TESTS.find((t) => t.k === test)!
  const rows = players.map((p) => {
    const mine = all.filter((r) => r.profile_id === p.id && r.test === test)
    return { p, v: mine.length ? Number(mine[mine.length - 1].value) : null, prev: mine.length > 1 ? Number(mine[0].value) : null }
  }).filter((r) => r.v != null).sort((a, b) => (def.better === 'up' ? b.v! - a.v! : a.v! - b.v!))
  return (
    <div className="stack stack--md">
      <div className="scroll-x">{TESTS.map((t) => <button key={t.k} className={`chip chip--ghost ${test === t.k ? 'is-active' : ''}`} style={{ minHeight: 36, padding: '0 12px' }} onClick={() => setTest(t.k)}>{t.label}</button>)}</div>
      {rows.length === 0 ? <p className="small muted">Pas encore de résultat pour ce test.</p> : (
        <div className="card card--list">
          {rows.map((r, i) => (
            <div key={r.p.id} className="listrow">
              <span className="gold" style={{ fontWeight: 800, textAlign: 'center' }}>{i + 1}</span>
              <span style={{ fontWeight: 600 }}>{r.p.first_name}</span>
              <span className="row" style={{ gap: 8 }}>
                {r.prev != null && <span className="small muted">depuis {fmtNum(r.prev)}</span>}
                <span style={{ fontWeight: 700 }}>{fmtNum(r.v!)} {def.unit}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ====================== Programmes ======================
function Programs({ me, profiles }: { me: Profile; profiles: Profile[] }) {
  const staff = isStaff(me)
  const q = useAsync(fetchPrograms, [])
  const [editing, setEditing] = useState<(Omit<Program, 'id' | 'created_at'> & { id?: string }) | null>(null)
  if (q.loading || !q.data) return <Skeleton h={200} />
  if (editing) return <ProgramEditor value={editing} me={me} profiles={profiles} onDone={() => { setEditing(null); void q.reload() }} />
  const { programs, progress } = q.data
  const players = profiles.filter(isPlayer)
  return (
    <div className="stack stack--md">
      {staff && <button className="btn btn--sm" onClick={() => setEditing({ title: '', kind: 'extra', description: '', sessions: [], assigned_to: null })}>Nouveau programme</button>}
      {programs.length === 0 && <section className="card card--sm center small muted">{staff ? 'Crée un programme : prépa d’été, reprise après blessure, séance en plus…' : 'Aucun programme pour toi pour l’instant.'}</section>}
      {programs.map((p) => {
        const mine = progress.filter((g) => g.program_id === p.id && g.profile_id === me.id).map((g) => g.session_index)
        const targets = p.assigned_to ? players.filter((pl) => p.assigned_to!.includes(pl.id)) : players
        return (
          <section key={p.id} className="card" style={{ gap: 10 }}>
            <div className="row row--between"><span className="eyebrow">{PROGRAM_KINDS[p.kind]}</span><span className="small muted">{p.assigned_to ? `${p.assigned_to.length} joueur${p.assigned_to.length > 1 ? 's' : ''}` : 'Tout le groupe'}</span></div>
            <span style={{ fontWeight: 700, fontSize: 17 }}>{p.title}</span>
            {p.description && <p className="small text-2" style={{ whiteSpace: 'pre-line' }}>{p.description}</p>}
            {isPlayer(me) && (!p.assigned_to || p.assigned_to.includes(me.id)) && (
              <>
                <div className="bar"><span style={{ width: `${p.sessions.length ? (mine.length / p.sessions.length) * 100 : 0}%`, background: 'var(--gold)' }} /></div>
                {p.sessions.map((s, i) => {
                  const done = mine.includes(i)
                  return (
                    <button key={i} className="row" style={{ gap: 12, textAlign: 'left', color: 'inherit', alignItems: 'flex-start' }} onClick={async () => { await toggleProgress(p.id, me.id, i, !done); void q.reload() }}>
                      <span style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, border: done ? 0 : '2px solid var(--line-strong)', background: done ? 'var(--gold)' : 'transparent', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>{done ? '✓' : ''}</span>
                      <span className="stack" style={{ gap: 1 }}><span style={{ fontWeight: 600, textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--muted)' : 'var(--text)' }}>{s.label}</span>{s.detail && <span className="small muted">{s.detail}</span>}</span>
                    </button>
                  )
                })}
              </>
            )}
            {staff && (
              <>
                <div className="hr" />
                <span className="small muted">Avancement</span>
                {targets.map((pl) => {
                  const n = progress.filter((g) => g.program_id === p.id && g.profile_id === pl.id).length
                  return (
                    <div key={pl.id} className="row" style={{ gap: 10 }}>
                      <span className="small" style={{ width: 90, fontWeight: 600 }}>{pl.first_name}</span>
                      <div className="bar" style={{ flex: 1 }}><span style={{ width: `${p.sessions.length ? (n / p.sessions.length) * 100 : 0}%`, background: 'var(--gold)' }} /></div>
                      <span className="small muted" style={{ width: 36, textAlign: 'right' }}>{n}/{p.sessions.length}</span>
                    </div>
                  )
                })}
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn--secondary btn--sm" onClick={() => setEditing({ ...p })}>Modifier</button>
                  <button className="btn btn--secondary btn--sm" style={{ color: 'var(--red)' }} onClick={async () => { if (confirm('Supprimer ce programme ?')) { await deleteProgram(p.id); void q.reload() } }}>Supprimer</button>
                </div>
              </>
            )}
          </section>
        )
      })}
    </div>
  )
}

function ProgramEditor({ value, me, profiles, onDone }: { value: Omit<Program, 'id' | 'created_at'> & { id?: string }; me: Profile; profiles: Profile[]; onDone: () => void }) {
  const [p, setP] = useState(value)
  const [lines, setLines] = useState(value.sessions.map((s) => (s.detail ? `${s.label} — ${s.detail}` : s.label)).join('\n'))
  const [busy, setBusy] = useState(false)
  const players = profiles.filter(isPlayer)
  const assigned = p.assigned_to ?? []
  return (
    <section className="card" style={{ gap: 12 }}>
      <span className="eyebrow">{p.id ? 'Modifier le programme' : 'Nouveau programme'}</span>
      <input className="input" placeholder="Titre (ex. Prépa été : 4 semaines)" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} />
      <div className="scroll-x">{(Object.keys(PROGRAM_KINDS) as Program['kind'][]).map((k) => <button key={k} className={`chip chip--ghost ${p.kind === k ? 'is-active' : ''}`} style={{ minHeight: 36, padding: '0 12px' }} onClick={() => setP({ ...p, kind: k })}>{PROGRAM_KINDS[k]}</button>)}</div>
      <textarea className="input" rows={2} style={{ padding: 12, minHeight: 70 }} placeholder="Consignes générales" value={p.description ?? ''} onChange={(e) => setP({ ...p, description: e.target.value })} />
      <span className="label">Séances, une par ligne. « Titre — détail »</span>
      <textarea className="input" rows={6} style={{ padding: 12, minHeight: 140 }} placeholder={'Semaine 1 · footing — 30 min à allure facile\nSemaine 1 · renfo — gainage 3 × 45 s, fentes 3 × 12'} value={lines} onChange={(e) => setLines(e.target.value)} />
      <span className="label">Pour qui ?</span>
      <div className="segmented" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button className={`segmented__btn ${p.assigned_to === null ? 'is-yes' : ''}`} onClick={() => setP({ ...p, assigned_to: null })}>Tout le groupe</button>
        <button className={`segmented__btn ${p.assigned_to !== null ? 'is-yes' : ''}`} onClick={() => setP({ ...p, assigned_to: assigned })}>Certains joueurs</button>
      </div>
      {p.assigned_to !== null && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {players.map((pl) => {
            const on = assigned.includes(pl.id)
            return <button key={pl.id} className={`chip chip--ghost ${on ? 'is-active' : ''}`} style={{ minHeight: 36, padding: '0 12px' }} onClick={() => setP({ ...p, assigned_to: on ? assigned.filter((x) => x !== pl.id) : [...assigned, pl.id] })}>{pl.first_name}</button>
          })}
        </div>
      )}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn--secondary btn--sm" onClick={onDone}>Annuler</button>
        <button className="btn btn--sm" disabled={busy || !p.title.trim() || !lines.trim() || (p.assigned_to !== null && !assigned.length)} onClick={async () => {
          setBusy(true)
          try {
            const sessions = lines.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [a, ...b] = l.split(/\s+[—–-]\s+/); return { label: a.trim(), detail: b.join(' — ').trim() } })
            await saveProgram({ ...p, title: p.title.trim(), sessions }, me.id)
            if (!p.id) void notify('program_published', undefined, { title: p.title.trim(), profile_ids: p.assigned_to })
            onDone()
          } finally { setBusy(false) }
        }}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
    </section>
  )
}

