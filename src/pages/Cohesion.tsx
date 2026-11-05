import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'
import { fetchProfiles } from '../lib/data'
import {
  answerIdea, deleteIdea, fetchCharter, fetchIdeas, fetchMood, IDEA_STATUS, signCharter, submitIdea, submitMood, updateCharter,
  type Idea,
} from '../lib/data3'
import { isPlayer, isStaff, type Profile } from '../lib/types'
import { Chip, PageTitle, Skeleton } from '../components/ui'
import { notify } from '../lib/push'

type Tab = 'charte' | 'idees' | 'humeur'
const TABS: [Tab, string][] = [['charte', 'Charte'], ['idees', 'Boîte à idées'], ['humeur', 'Humeur']]

export default function Cohesion() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.some(([k]) => k === params.get('onglet')) ? params.get('onglet') : 'charte') as Tab
  if (!profile) return null
  return (
    <>
      <PageTitle kicker="Ce qui fait un groupe" title="Vestiaire" />
      <div className="segmented">
        {TABS.map(([k, l]) => <button key={k} className={`segmented__btn ${tab === k ? 'is-yes' : ''}`} style={{ fontSize: 13 }} onClick={() => setParams(k === 'charte' ? {} : { onglet: k }, { replace: true })}>{l}</button>)}
      </div>
      {tab === 'charte' && <Charter me={profile} />}
      {tab === 'idees' && <Ideas me={profile} />}
      {tab === 'humeur' && <Mood />}
    </>
  )
}

// ====================== Charte ======================
function Charter({ me }: { me: Profile }) {
  const staff = isStaff(me)
  const q = useAsync(async () => ({ c: await fetchCharter(), profiles: await fetchProfiles() }), [])
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (q.loading || !q.data) return <Skeleton h={300} />
  const { c, profiles } = q.data
  const rules = c.text.split('\n').map((l) => l.trim()).filter(Boolean)
  const signedNow = c.signed.filter((s) => s.version === c.version)
  const iSigned = signedNow.some((s) => s.profile_id === me.id)
  const members = profiles.filter((p) => isPlayer(p) || isStaff(p))
  const missing = members.filter((p) => !signedNow.some((s) => s.profile_id === p.id))

  if (editing !== null) return (
    <section className="card" style={{ gap: 10 }}>
      <span className="eyebrow">Modifier la charte</span>
      <span className="small muted">Une règle par ligne. Enregistrer crée une nouvelle version : tout le monde devra la relire et la valider.</span>
      <textarea className="input" rows={12} style={{ padding: 12, minHeight: 280 }} value={editing} onChange={(e) => setEditing(e.target.value)} />
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn--secondary btn--sm" onClick={() => setEditing(null)}>Annuler</button>
        <button className="btn btn--sm" disabled={busy || !editing.trim()} onClick={async () => { setBusy(true); try { await updateCharter(editing.trim(), c.version); void notify('charter_updated'); setEditing(null); void q.reload() } finally { setBusy(false) } }}>Publier la version {c.version + 1}</button>
      </div>
    </section>
  )

  return (
    <div className="stack stack--lg">
      <section className="card" style={{ gap: 14, borderColor: 'rgba(233,192,74,.45)' }}>
        <div className="row row--between"><span className="eyebrow" style={{ color: 'var(--gold)' }}>Charte de l'équipe 2</span><Chip>Version {c.version}</Chip></div>
        {rules.map((r, i) => (
          <div key={i} className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
            <span className="gold" style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18, width: 20, lineHeight: 1.2 }}>{i + 1}</span>
            <span style={{ lineHeight: 1.45 }}>{r}</span>
          </div>
        ))}
        {iSigned
          ? <span className="small gold" style={{ fontWeight: 700 }}>Tu as validé cette charte.</span>
          : <button className="btn" disabled={busy} onClick={async () => { setBusy(true); try { await signCharter(me.id, c.version); void q.reload() } finally { setBusy(false) } }}>J'ai lu et je m'engage</button>}
      </section>
      <section className="card" style={{ gap: 10 }}>
        <div className="row row--between"><span className="eyebrow">Validée par</span><span className="small muted">{signedNow.length}/{members.length}</span></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {members.filter((p) => !missing.includes(p)).map((p) => <span key={p.id} className="chip">{p.first_name}</span>)}
        </div>
        {staff && missing.length > 0 && <span className="small muted">Pas encore validée : {missing.map((p) => p.first_name).join(', ')}</span>}
      </section>
      {staff && <button className="btn btn--secondary btn--sm" onClick={() => setEditing(c.text)}>Modifier la charte</button>}
    </div>
  )
}

// ====================== Boîte à idées ======================
function Ideas({ me }: { me: Profile }) {
  const staff = isStaff(me)
  const q = useAsync(fetchIdeas, [])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  return (
    <div className="stack stack--lg">
      <section className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Une idée, une remarque ?</span>
        <span className="small text-2">C'est anonyme : l'app ne garde pas qui l'a écrite, même pour le staff ou l'administrateur. Évite juste de te reconnaître dans le texte.</span>
        <textarea className="input" rows={3} style={{ padding: 12, minHeight: 90 }} placeholder="Ex. Faire la causerie la veille plutôt que dans le vestiaire" value={body} onChange={(e) => { setBody(e.target.value); setDone(false) }} />
        <button className="btn btn--sm" disabled={busy || body.trim().length < 3} onClick={async () => { setBusy(true); try { await submitIdea(body.trim()); setBody(''); setDone(true); void q.reload() } finally { setBusy(false) } }}>{done ? 'Déposée, merci' : 'Déposer anonymement'}</button>
      </section>
      {!q.data ? <Skeleton h={120} /> : q.data.length === 0 ? <p className="small muted center">La boîte est vide pour l'instant.</p> : q.data.map((i) => <IdeaCard key={i.id} idea={i} staff={staff} onChange={() => void q.reload()} />)}
    </div>
  )
}

function IdeaCard({ idea, staff, onChange }: { idea: Idea; staff: boolean; onChange: () => void }) {
  const [reply, setReply] = useState(idea.reply ?? '')
  const [open, setOpen] = useState(false)
  const tone = idea.status === 'done' ? 'var(--gold)' : idea.status === 'no' ? 'var(--muted)' : 'var(--text-2)'
  return (
    <section className="card card--sm" style={{ gap: 8 }}>
      <div className="row row--between"><span className="small" style={{ fontWeight: 700, color: tone }}>{IDEA_STATUS[idea.status]}</span><span className="small muted">{new Date(idea.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span></div>
      <span style={{ lineHeight: 1.45 }}>{idea.body}</span>
      {idea.reply && !open && <div className="card card--sm" style={{ background: 'var(--ink)', gap: 2 }}><span className="small gold" style={{ fontWeight: 700 }}>Réponse du staff</span><span className="small text-2">{idea.reply}</span></div>}
      {staff && (open ? (
        <div className="stack" style={{ gap: 8 }}>
          <textarea className="input" rows={2} style={{ padding: 12, minHeight: 70 }} placeholder="Réponse visible par tous" value={reply} onChange={(e) => setReply(e.target.value)} />
          <div className="scroll-x">
            {(['seen', 'done', 'no'] as const).map((s) => <button key={s} className="chip chip--ghost" style={{ minHeight: 36, padding: '0 12px' }} onClick={async () => { await answerIdea(idea.id, s, reply.trim() || null); if (reply.trim()) void notify('idea_answered'); setOpen(false); onChange() }}>{IDEA_STATUS[s]}</button>)}
            <button className="chip chip--ghost" style={{ minHeight: 36, padding: '0 12px', color: 'var(--red)' }} onClick={async () => { if (confirm('Supprimer cette idée ?')) { await deleteIdea(idea.id); onChange() } }}>Supprimer</button>
          </div>
        </div>
      ) : <button className="small gold" style={{ fontWeight: 600, textAlign: 'left' }} onClick={() => setOpen(true)}>Répondre ou changer le statut</button>)}
    </section>
  )
}

// ====================== Humeur ======================
const MOODS = ['Au plus bas', 'Pas terrible', 'Correct', 'Bien', 'Au top']

function Mood() {
  const q = useAsync(fetchMood, [])
  const [busy, setBusy] = useState(false)
  if (q.loading || !q.data) return <Skeleton h={200} />
  const { weeks, votedThisWeek } = q.data
  return (
    <div className="stack stack--lg">
      <section className="card" style={{ gap: 12 }}>
        <span className="eyebrow">Comment tu sens le groupe cette semaine ?</span>
        <span className="small text-2">Une réponse par semaine, anonyme. La moyenne n'apparaît qu'à partir de 3 réponses.</span>
        {votedThisWeek ? <span className="small gold" style={{ fontWeight: 700 }}>Merci, ta réponse de la semaine est enregistrée.</span> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 4 }}>
            {MOODS.map((l, i) => (
              <button key={l} disabled={busy} onClick={async () => { setBusy(true); try { await submitMood(i + 1); void q.reload() } finally { setBusy(false) } }} className="segmented__btn" style={{ background: 'var(--ink)', minHeight: 64, fontSize: 11.5, lineHeight: 1.15, padding: '0 2px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 20, color: i >= 3 ? 'var(--gold)' : i <= 1 ? 'var(--red)' : 'var(--text)' }}>{i + 1}</span>{l}
              </button>
            ))}
          </div>
        )}
      </section>
      <section className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Humeur du groupe · 10 semaines</span>
        {weeks.length === 0 ? <span className="small muted">Pas encore assez de réponses pour afficher une tendance.</span> : (
          <div className="row" style={{ gap: 6, alignItems: 'flex-end', height: 120 }}>
            {weeks.map((w) => (
              <div key={w.week_start} className="stack" style={{ flex: 1, height: '100%', justifyContent: 'flex-end', gap: 3 }}>
                <span className="small" style={{ textAlign: 'center', fontWeight: 700 }}>{Number(w.average).toLocaleString('fr-FR')}</span>
                <div style={{ height: `${(Number(w.average) / 5) * 70}%`, borderRadius: 5, background: Number(w.average) >= 3.5 ? 'var(--gold)' : Number(w.average) < 2.5 ? 'var(--red)' : 'var(--text-2)' }} />
                <span style={{ fontSize: 9.5, color: 'var(--muted)', textAlign: 'center' }}>{new Date(w.week_start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
