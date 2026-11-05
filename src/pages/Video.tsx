import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'
import { fetchEvents, fetchProfiles } from '../lib/data'
import { CLIP_KINDS, deleteClip, fetchClips, fmtClock, parseTime, saveClip, youtubeEmbed, type Clip } from '../lib/data4'
import { isPlayer, isStaff, type Profile, type TeamEvent } from '../lib/types'
import { PageTitle, Skeleton } from '../components/ui'

type Filter = 'mine' | 'all' | Clip['kind']

export default function Video() {
  const { profile } = useAuth()
  const q = useAsync(async () => {
    const [clips, profiles, events] = await Promise.all([fetchClips(), fetchProfiles(), fetchEvents(new Date(Date.now() - 300 * 86_400_000).toISOString(), new Date().toISOString())])
    return { clips, profiles, matches: events.filter((e) => e.type === 'match') }
  }, [])
  const [filter, setFilter] = useState<Filter>(profile && isPlayer(profile) ? 'mine' : 'all')
  const [editing, setEditing] = useState<(Omit<Clip, 'id' | 'created_at'> & { id?: string }) | null>(null)
  if (!profile || q.loading || !q.data) return <><Skeleton h={60} /><Skeleton h={240} /></>
  const staff = isStaff(profile)
  const { clips, profiles, matches } = q.data
  if (editing) return <ClipEditor value={editing} me={profile} profiles={profiles} matches={matches} onDone={() => { setEditing(null); void q.reload() }} />
  const list = clips.filter((c) => filter === 'all' ? true : filter === 'mine' ? c.tagged.includes(profile.id) : c.kind === filter)
  const filters: [Filter, string][] = [...(isPlayer(profile) ? [['mine', 'Tes actions'] as [Filter, string]] : []), ['all', 'Tout'], ['match', 'Matchs'], ['causerie', 'Causerie'], ['exemple', 'Exemples']]
  return (
    <>
      <PageTitle kicker="Revoir, comprendre, progresser" title="Vidéo" />
      {staff && <button className="btn btn--sm" onClick={() => setEditing({ event_id: null, url: '', title: '', start_sec: null, kind: 'match', note: '', tagged: [] })}>Ajouter un clip</button>}
      <div className="scroll-x">{filters.map(([k, l]) => <button key={k} className={`chip chip--ghost ${filter === k ? 'is-active' : ''}`} style={{ minHeight: 36, padding: '0 12px' }} onClick={() => setFilter(k)}>{l}</button>)}</div>
      {list.length === 0 && <section className="card card--sm center small muted">{filter === 'mine' ? 'Aucune action où tu es identifié pour l’instant.' : 'Aucun clip. Le staff ajoute des liens YouTube (non répertoriés), Drive ou Veo, avec le moment exact.'}</section>}
      {list.map((c) => <ClipCard key={c.id} clip={c} profiles={profiles} matches={matches} me={profile} onEdit={() => setEditing({ ...c })} onDelete={async () => { if (confirm('Supprimer ce clip ?')) { await deleteClip(c.id); void q.reload() } }} />)}
    </>
  )
}

function ClipCard({ clip, profiles, matches, me, onEdit, onDelete }: { clip: Clip; profiles: Profile[]; matches: TeamEvent[]; me: Profile; onEdit: () => void; onDelete: () => void }) {
  const [play, setPlay] = useState(false)
  const embed = youtubeEmbed(clip.url, clip.start_sec)
  const match = matches.find((m) => m.id === clip.event_id)
  const tagged = clip.tagged.map((id) => profiles.find((p) => p.id === id)).filter(Boolean) as Profile[]
  return (
    <section className="card card--sm" style={{ gap: 10, borderColor: clip.tagged.includes(me.id) ? 'rgba(233,192,74,.45)' : undefined }}>
      <div className="row row--between"><span className="eyebrow">{CLIP_KINDS[clip.kind]}</span>{clip.start_sec != null && <span className="small muted">à {fmtClock(clip.start_sec)}</span>}</div>
      <span style={{ fontWeight: 700 }}>{clip.title}</span>
      {match && <span className="small muted">{match.title}</span>}
      {embed && play ? (
        <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
          <iframe src={`${embed}&autoplay=1`} title={clip.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
        </div>
      ) : embed ? (
        <button className="btn btn--secondary btn--sm" onClick={() => setPlay(true)}>▶ Lire le clip</button>
      ) : (
        <a className="btn btn--secondary btn--sm" href={clip.url} target="_blank" rel="noreferrer">Ouvrir la vidéo{clip.start_sec != null ? ` (aller à ${fmtClock(clip.start_sec)})` : ''}</a>
      )}
      {clip.note && <p className="small text-2" style={{ whiteSpace: 'pre-line', lineHeight: 1.45 }}>{clip.note}</p>}
      {tagged.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{tagged.map((p) => <span key={p.id} className={`chip ${p.id === me.id ? 'chip--gold' : ''}`}>{p.first_name}</span>)}</div>}
      {isStaff(me) && <div className="row" style={{ gap: 8 }}><button className="btn btn--secondary btn--sm" onClick={onEdit}>Modifier</button><button className="btn btn--secondary btn--sm" style={{ color: 'var(--red)' }} onClick={onDelete}>Supprimer</button></div>}
    </section>
  )
}

function ClipEditor({ value, me, profiles, matches, onDone }: { value: Omit<Clip, 'id' | 'created_at'> & { id?: string }; me: Profile; profiles: Profile[]; matches: TeamEvent[]; onDone: () => void }) {
  const [c, setC] = useState(value)
  const [time, setTime] = useState(value.start_sec != null ? fmtClock(value.start_sec) : '')
  const [busy, setBusy] = useState(false)
  const players = profiles.filter(isPlayer)
  return (
    <section className="card" style={{ gap: 10 }}>
      <span className="eyebrow">{c.id ? 'Modifier le clip' : 'Nouveau clip'}</span>
      <input className="input" placeholder="Lien de la vidéo (YouTube, Drive, Veo…)" value={c.url} onChange={(e) => setC({ ...c, url: e.target.value })} />
      <span className="small muted">Pour YouTube, mets la vidéo en « non répertoriée » : seuls ceux qui ont le lien peuvent la voir.</span>
      <input className="input" placeholder="Titre (ex. Pressing haut qui récupère le ballon)" value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} />
      <div className="row" style={{ gap: 8 }}>
        <input className="input" placeholder="Moment (ex. 23:41)" value={time} onChange={(e) => setTime(e.target.value)} style={{ maxWidth: 150 }} />
        <select className="input" value={c.event_id ?? ''} onChange={(e) => setC({ ...c, event_id: e.target.value || null })}>
          <option value="">Pas lié à un match</option>
          {[...matches].reverse().map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
      </div>
      <div className="segmented">{(Object.keys(CLIP_KINDS) as Clip['kind'][]).map((k) => <button key={k} className={`segmented__btn ${c.kind === k ? 'is-yes' : ''}`} style={{ fontSize: 12.5 }} onClick={() => setC({ ...c, kind: k })}>{CLIP_KINDS[k]}</button>)}</div>
      <textarea className="input" rows={3} style={{ padding: 12, minHeight: 80 }} placeholder="Ce qu'il faut regarder : placement, appel, erreur à corriger…" value={c.note ?? ''} onChange={(e) => setC({ ...c, note: e.target.value })} />
      <span className="label">Joueurs concernés (le clip apparaît dans « Tes actions »)</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {players.map((p) => { const on = c.tagged.includes(p.id); return <button key={p.id} className={`chip chip--ghost ${on ? 'is-active' : ''}`} style={{ minHeight: 34, padding: '0 12px' }} onClick={() => setC({ ...c, tagged: on ? c.tagged.filter((x) => x !== p.id) : [...c.tagged, p.id] })}>{p.first_name}</button> })}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn--secondary btn--sm" onClick={onDone}>Annuler</button>
        <button className="btn btn--sm" disabled={busy || !/^https?:\/\//.test(c.url.trim()) || !c.title.trim()} onClick={async () => { setBusy(true); try { await saveClip({ ...c, url: c.url.trim(), title: c.title.trim(), start_sec: parseTime(time) }, me.id); onDone() } finally { setBusy(false) } }}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
    </section>
  )
}
