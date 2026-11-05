import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'
import { fetchAvailabilities, fetchEvents, fetchProfiles } from '../lib/data'
import {
  ADMIN_LABELS, adminMissing, addGoal, addNote, deleteGoal, deleteNote, fetchAdmin, fetchFeedback, fetchGoals, fetchNotes, fetchTests,
  NOTE_KINDS, saveAdmin, setGoalDone, TESTS, type AdminState, type Feedback, type PlayerAdmin, type StaffNote,
} from '../lib/data3'
import { fmtDay, fmtDow, timeAgo } from '../lib/format'
import { isPlayer, isStaff, type Profile, type TeamEvent } from '../lib/types'
import { Avatar, PageTitle, Skeleton } from '../components/ui'
import { FeedbackSummary } from '../components/TrainingSession'
import { notify } from '../lib/push'

type Tab = 'joueurs' | 'ressentis' | 'dossiers'
const TABS: [Tab, string][] = [['joueurs', 'Joueurs'], ['ressentis', 'Ressentis'], ['dossiers', 'Dossiers']]

export default function StaffSpace() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.some(([k]) => k === params.get('onglet')) ? params.get('onglet') : 'joueurs') as Tab
  const q = useAsync(async () => {
    const since = new Date(Date.now() - 42 * 86_400_000).toISOString()
    const [profiles, admin, trainings] = await Promise.all([fetchProfiles(), fetchAdmin(), fetchEvents(since, new Date().toISOString())])
    const tr = trainings.filter((e) => e.type === 'training' && (e.status ?? 'scheduled') === 'scheduled')
    const [feedback, avail] = await Promise.all([fetchFeedback(tr.map((e) => e.id)), fetchAvailabilities(tr.map((e) => e.id))])
    return { profiles, admin, trainings: tr, feedback, avail }
  }, [])
  if (profile && !isStaff(profile)) return <Navigate to="/" replace />
  if (!profile || q.loading || !q.data) return <><Skeleton h={60} /><Skeleton h={240} /></>
  const d = q.data
  return (
    <>
      <PageTitle kicker="Visible du staff uniquement" title="Espace staff" />
      <div className="segmented">
        {TABS.map(([k, l]) => <button key={k} className={`segmented__btn ${tab === k ? 'is-yes' : ''}`} onClick={() => setParams(k === 'joueurs' ? {} : { onglet: k }, { replace: true })}>{l}</button>)}
      </div>
      {tab === 'joueurs' && <Players me={profile} {...d} />}
      {tab === 'ressentis' && <Load trainings={d.trainings} feedback={d.feedback} profiles={d.profiles} />}
      {tab === 'dossiers' && <Dossiers profiles={d.profiles} admin={d.admin} onChange={() => void q.reload()} />}
    </>
  )
}

// ====================== Joueurs ======================
function Players({ me, profiles, admin, trainings, feedback, avail }: { me: Profile; profiles: Profile[]; admin: PlayerAdmin[]; trainings: TeamEvent[]; feedback: Feedback[]; avail: { event_id: string; profile_id: string; status: string }[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const players = profiles.filter(isPlayer)
  const recent = trainings.slice(-2).map((t) => t.id)
  const flagsOf = (p: Profile) => {
    const out: { l: string; red?: boolean }[] = []
    const miss = adminMissing(admin.find((a) => a.profile_id === p.id))
    if (miss.length) out.push({ l: `Dossier : ${miss.join(', ')}` })
    const tired = feedback.filter((f) => f.profile_id === p.id && recent.includes(f.event_id) && f.fatigue >= 4)
    if (tired.length) out.push({ l: 'Fatigue élevée', red: true })
    const pres = trainings.length ? avail.filter((a) => a.profile_id === p.id && a.status === 'yes').length / trainings.length : 1
    if (trainings.length >= 3 && pres < 0.5) out.push({ l: `Présence ${Math.round(pres * 100)} %`, red: true })
    return out
  }
  if (open) {
    const p = profiles.find((x) => x.id === open)!
    return <PlayerFile p={p} me={me} admin={admin.find((a) => a.profile_id === p.id)} feedback={feedback.filter((f) => f.profile_id === p.id)} trainings={trainings} avail={avail} onBack={() => setOpen(null)} />
  }
  return (
    <div className="card card--list">
      {players.map((p) => {
        const flags = flagsOf(p)
        return (
          <button key={p.id} className="listrow" style={{ textAlign: 'left', color: 'inherit', width: '100%' }} onClick={() => setOpen(p.id)}>
            <Avatar p={p} />
            <div className="stack" style={{ gap: 3, minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>{p.first_name}{p.last_name ? ` ${p.last_name}` : ''}</span>
              {flags.length > 0 ? <span className="row" style={{ gap: 4, flexWrap: 'wrap' }}>{flags.map((f) => <span key={f.l} className="small" style={{ fontWeight: 600, color: f.red ? 'var(--red)' : 'var(--text-2)' }}>{f.l}</span>)}</span> : <span className="small muted">Rien à signaler</span>}
            </div>
            <span className="muted">›</span>
          </button>
        )
      })}
    </div>
  )
}

function PlayerFile({ p, me, admin, feedback, trainings, avail, onBack }: { p: Profile; me: Profile; admin?: PlayerAdmin; feedback: Feedback[]; trainings: TeamEvent[]; avail: { event_id: string; profile_id: string; status: string }[]; onBack: () => void }) {
  const q = useAsync(async () => {
    const [goals, notes, tests] = await Promise.all([fetchGoals(p.id), fetchNotes(p.id), fetchTests(p.id)])
    return { goals, notes, tests }
  }, [p.id])
  const [goal, setGoal] = useState('')
  const [due, setDue] = useState('')
  const [note, setNote] = useState('')
  const [kind, setKind] = useState<StaffNote['kind']>('entretien')
  const present = avail.filter((a) => a.profile_id === p.id && a.status === 'yes').length
  return (
    <div className="stack stack--lg">
      <button className="row link" style={{ gap: 6, color: 'var(--text-2)' }} onClick={onBack}>‹ Tous les joueurs</button>
      <div className="row">
        <Avatar p={p} lg />
        <div className="stack" style={{ gap: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 18 }}>{p.first_name} {p.last_name ?? ''}</span>
          <span className="small muted">{p.position ?? ''}{trainings.length ? ` · présent à ${present}/${trainings.length} entraînements (6 sem.)` : ''}</span>
        </div>
      </div>
      {!q.data ? <Skeleton h={200} /> : (
        <>
          <section className="card" style={{ gap: 10 }}>
            <span className="eyebrow">Objectifs individuels · visibles par {p.first_name}</span>
            {q.data.goals.length === 0 && <span className="small muted">Aucun objectif fixé.</span>}
            {q.data.goals.map((g) => (
              <div key={g.id} className="row" style={{ gap: 10 }}>
                <button aria-label={g.done ? 'Rouvrir' : 'Atteint'} onClick={async () => { await setGoalDone(g.id, !g.done); void q.reload() }} style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, border: g.done ? 0 : '2px solid var(--line-strong)', background: g.done ? 'var(--gold)' : 'transparent', color: 'var(--ink)', fontWeight: 800, fontSize: 13 }}>{g.done ? '✓' : ''}</button>
                <span className="stack" style={{ gap: 0, flex: 1 }}><span style={{ fontWeight: 600, textDecoration: g.done ? 'line-through' : 'none' }}>{g.title}</span>{g.due && <span className="small muted">Échéance {new Date(g.due).toLocaleDateString('fr-FR')}</span>}</span>
                <button className="muted" aria-label="Supprimer" onClick={async () => { await deleteGoal(g.id); void q.reload() }}>✕</button>
              </div>
            ))}
            <div className="row" style={{ gap: 6 }}>
              <input className="input" style={{ flex: 1 }} placeholder="Ex. Gagner 50 % de ses duels aériens" value={goal} onChange={(e) => setGoal(e.target.value)} />
              <input className="input" type="date" style={{ maxWidth: 150 }} value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            <button className="btn btn--sm" disabled={!goal.trim()} onClick={async () => { await addGoal(p.id, goal.trim(), null, due || null, me.id); setGoal(''); setDue(''); void q.reload() }}>Ajouter l'objectif</button>
          </section>

          <section className="card" style={{ gap: 10, borderColor: 'rgba(229,100,78,.35)' }}>
            <span className="eyebrow">Notes privées du staff · jamais visibles du joueur</span>
            <div className="scroll-x">{(Object.keys(NOTE_KINDS) as StaffNote['kind'][]).map((k) => <button key={k} className={`chip chip--ghost ${kind === k ? 'is-active' : ''}`} style={{ minHeight: 34, padding: '0 12px' }} onClick={() => setKind(k)}>{NOTE_KINDS[k]}</button>)}</div>
            <textarea className="input" rows={3} style={{ padding: 12, minHeight: 80 }} placeholder={kind === 'entretien' ? 'Ce qui s’est dit, ce qui est convenu…' : kind === 'blessure' ? 'Gêne, durée d’indisponibilité prévue…' : 'Observation'} value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn btn--sm" disabled={!note.trim()} onClick={async () => { await addNote(p.id, kind, note.trim(), me.id); setNote(''); void q.reload() }}>Enregistrer la note</button>
            {q.data.notes.map((n) => (
              <div key={n.id} className="stack" style={{ gap: 2, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                <div className="row row--between"><span className="small gold" style={{ fontWeight: 700 }}>{NOTE_KINDS[n.kind]}</span><span className="row" style={{ gap: 10 }}><span className="small muted">{timeAgo(n.created_at)}</span><button className="muted small" onClick={async () => { if (confirm('Supprimer cette note ?')) { await deleteNote(n.id); void q.reload() } }}>✕</button></span></div>
                <span className="small text-2" style={{ whiteSpace: 'pre-line' }}>{n.body}</span>
              </div>
            ))}
          </section>

          <section className="card" style={{ gap: 8 }}>
            <span className="eyebrow">Ressentis récents</span>
            {feedback.length === 0 ? <span className="small muted">Pas de ressenti sur les 6 dernières semaines.</span> : (
              <div className="row" style={{ gap: 6, alignItems: 'flex-end', height: 70 }}>
                {trainings.map((t) => {
                  const f = feedback.find((x) => x.event_id === t.id)
                  return <div key={t.id} title={f ? `Fatigue ${f.fatigue}/5 · RPE ${f.intensity}` : 'Pas de réponse'} style={{ flex: 1, height: f ? `${f.fatigue * 20}%` : 4, borderRadius: 4, background: f ? (f.fatigue >= 4 ? 'var(--red)' : 'var(--gold)') : 'var(--surface-2)' }} />
                })}
              </div>
            )}
            {feedback.filter((f) => f.comment).slice(-3).map((f) => <span key={f.event_id} className="small text-2">« {f.comment} »</span>)}
          </section>

          {q.data.tests.length > 0 && (
            <section className="card" style={{ gap: 6 }}>
              <span className="eyebrow">Derniers tests</span>
              {TESTS.filter((t) => q.data!.tests.some((r) => r.test === t.k)).map((t) => {
                const rs = q.data!.tests.filter((r) => r.test === t.k)
                return <div key={t.k} className="row row--between small"><span className="muted">{t.label}</span><span style={{ fontWeight: 600 }}>{Number(rs[rs.length - 1].value).toLocaleString('fr-FR')} {t.unit}</span></div>
              })}
            </section>
          )}

          <AdminCard p={p} admin={admin} />
        </>
      )}
    </div>
  )
}

// ====================== Charge et ressentis ======================
function Load({ trainings, feedback, profiles }: { trainings: TeamEvent[]; feedback: Feedback[]; profiles: Profile[] }) {
  const [sel, setSel] = useState<string | null>(trainings[trainings.length - 1]?.id ?? null)
  if (!trainings.length) return <p className="small muted">Pas d'entraînement sur les 6 dernières semaines.</p>
  const nPlayers = profiles.filter(isPlayer).length
  return (
    <div className="stack stack--lg">
      <section className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Fatigue et intensité · 6 semaines</span>
        <div className="row" style={{ gap: 6, alignItems: 'flex-end', height: 110 }}>
          {trainings.map((t) => {
            const fs = feedback.filter((f) => f.event_id === t.id)
            const avgI = fs.length ? fs.reduce((a, f) => a + f.intensity, 0) / fs.length : 0
            const avgF = fs.length ? fs.reduce((a, f) => a + f.fatigue, 0) / fs.length : 0
            return (
              <button key={t.id} onClick={() => setSel(t.id)} className="stack" style={{ flex: 1, height: '100%', justifyContent: 'flex-end', gap: 3, alignItems: 'stretch' }} aria-label={`Séance du ${fmtDay(t.starts_at)}`}>
                <div style={{ height: `${avgI * 8}%`, minHeight: 3, borderRadius: 4, background: sel === t.id ? 'var(--gold)' : avgF >= 3.5 ? 'var(--red)' : 'var(--text-2)', opacity: fs.length ? 1 : 0.25 }} />
                <span style={{ fontSize: 9.5, color: 'var(--muted)', textAlign: 'center' }}>{fmtDow(t.starts_at).slice(0, 2)}{fmtDay(t.starts_at)}</span>
              </button>
            )
          })}
        </div>
        <span className="small muted">Hauteur = intensité moyenne déclarée. Rouge = fatigue moyenne élevée. Touche une barre pour le détail.</span>
      </section>
      {sel && (() => {
        const fs = feedback.filter((f) => f.event_id === sel)
        return <>
          <span className="small muted">{fs.length} réponse{fs.length > 1 ? 's' : ''} sur {nPlayers} joueurs</span>
          <FeedbackSummary list={fs} profiles={profiles} />
        </>
      })()}
    </div>
  )
}

// ====================== Dossiers administratifs ======================
function Dossiers({ profiles, admin, onChange }: { profiles: Profile[]; admin: PlayerAdmin[]; onChange: () => void }) {
  const players = profiles.filter(isPlayer)
  const [sent, setSent] = useState(false)
  const incomplete = players.filter((p) => adminMissing(admin.find((a) => a.profile_id === p.id)).length > 0)
  return (
    <div className="stack stack--lg">
      <section className="card" style={{ gap: 8 }}>
        <div className="row row--between"><span className="eyebrow">Dossiers complets</span><span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 22 }}>{players.length - incomplete.length}<span className="muted" style={{ fontSize: 15 }}>/{players.length}</span></span></div>
        <div className="bar"><span style={{ width: `${players.length ? ((players.length - incomplete.length) / players.length) * 100 : 0}%`, background: 'var(--gold)' }} /></div>
        {incomplete.length > 0 && <button className="btn btn--sm" disabled={sent} onClick={async () => { await notify('admin_reminder', undefined, { profile_ids: incomplete.map((p) => p.id) }); setSent(true) }}>{sent ? 'Relance envoyée' : `Relancer les ${incomplete.length} dossiers incomplets`}</button>}
      </section>
      {players.map((p) => <AdminCard key={p.id} p={p} admin={admin.find((a) => a.profile_id === p.id)} compact onSaved={onChange} />)}
    </div>
  )
}

function AdminCard({ p, admin, compact, onSaved }: { p: Profile; admin?: PlayerAdmin; compact?: boolean; onSaved?: () => void }) {
  const [a, setA] = useState<PlayerAdmin>(admin ?? { profile_id: p.id, licence: 'a_faire', certificat_until: null, mutation: 'non', notes: null })
  const [dirty, setDirty] = useState(false)
  const [open, setOpen] = useState(!compact)
  const missing = adminMissing(a)
  const set = (patch: Partial<PlayerAdmin>) => { setA((x) => ({ ...x, ...patch })); setDirty(true) }
  return (
    <section className="card card--sm" style={{ gap: 10 }}>
      <button className="row row--between" style={{ color: 'inherit', textAlign: 'left' }} onClick={() => compact && setOpen((v) => !v)}>
        <span className="row" style={{ gap: 10 }}>{compact && <Avatar p={p} />}<span className="stack" style={{ gap: 1 }}><span style={{ fontWeight: 600 }}>{compact ? p.first_name : 'Dossier administratif'}</span><span className="small" style={{ color: missing.length ? 'var(--red)' : 'var(--gold)', fontWeight: 600 }}>{missing.length ? `Manque : ${missing.join(', ')}` : 'Complet'}</span></span></span>
        {compact && <span className="muted">{open ? '−' : '+'}</span>}
      </button>
      {open && (
        <>
          <span className="label">Licence</span>
          <div className="segmented">{(Object.keys(ADMIN_LABELS) as AdminState[]).map((k) => <button key={k} className={`segmented__btn ${a.licence === k ? 'is-yes' : ''}`} onClick={() => set({ licence: k })}>{ADMIN_LABELS[k]}</button>)}</div>
          <span className="label">Certificat médical valable jusqu'au</span>
          <input className="input" type="date" value={a.certificat_until ?? ''} onChange={(e) => set({ certificat_until: e.target.value || null })} />
          <span className="label">Mutation</span>
          <div className="segmented">{([['non', 'Aucune'], ['en_cours', 'En cours'], ['validee', 'Validée']] as const).map(([k, l]) => <button key={k} className={`segmented__btn ${a.mutation === k ? 'is-yes' : ''}`} onClick={() => set({ mutation: k })}>{l}</button>)}</div>
          <input className="input" placeholder="Remarque (pièce manquante, photo…)" value={a.notes ?? ''} onChange={(e) => set({ notes: e.target.value || null })} />
          {dirty && <button className="btn btn--sm" onClick={async () => { await saveAdmin(a); setDirty(false); onSaved?.() }}>Enregistrer</button>}
          {!compact && missing.length > 0 && <button className="btn btn--secondary btn--sm" onClick={async () => { await notify('admin_reminder', undefined, { profile_ids: [p.id] }) }}>Relancer {p.first_name}</button>}
        </>
      )}
    </section>
  )
}
