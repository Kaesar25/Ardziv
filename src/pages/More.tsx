import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { postAnnouncement, updateProfile } from '../lib/data'
import { isCaptainOrStaff, isStaff, LINE_LABELS, ROLE_LABELS, type SquadLine } from '../lib/types'
import { Avatar, Chip, PageTitle } from '../components/ui'

const ROADMAP = [
  { title: 'Tactique et plan de match', sub: 'Compo, coups de pied arrêtés, adversaire', tag: 'V2' },
  { title: 'Mode Jour J', sub: 'Déroulé, checklist, score en direct', tag: 'V2' },
  { title: 'Caisse et sondages', sub: 'Amendes, cotisations, votes', tag: 'V2' },
  { title: 'Homme du match', sub: 'Vote après chaque rencontre', tag: 'V2' },
  { title: 'Espace staff', sub: 'Entretiens, objectifs, ressentis', tag: 'V3' },
  { title: 'Histoire du club', sub: 'Depuis 1924', tag: 'V3' },
]

export default function More() {
  const { profile, session, signOut, refreshProfile } = useAuth()
  const [first, setFirst] = useState(profile?.first_name ?? '')
  const [position, setPosition] = useState(profile?.position ?? '')
  const [line, setLine] = useState<SquadLine | ''>(profile?.line ?? '')
  const [number, setNumber] = useState(profile?.number?.toString() ?? '')
  const [saved, setSaved] = useState(false)
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState(false)
  if (!profile) return null

  async function save() {
    await updateProfile(profile!.id, { first_name: first.trim(), position: position.trim() || null, line: line || null, number: number ? Number(number) : null })
    await refreshProfile()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      <PageTitle title="Plus" />

      <section className="card" style={{ gap: 12 }}>
        <div className="row">
          <Avatar p={profile} me lg />
          <div className="stack" style={{ gap: 1 }}>
            <span style={{ fontWeight: 600 }}>{profile.first_name} {profile.last_name ?? ''}</span>
            <span className="small muted">{ROLE_LABELS[profile.role]} · {session?.user.email}</span>
          </div>
        </div>
        <div className="hr" />
        <span className="eyebrow">Mon profil</span>
        <input className="input" placeholder="Prénom" value={first} onChange={(e) => setFirst(e.target.value)} />
        <div className="scroll-x">
          {(Object.keys(LINE_LABELS) as SquadLine[]).map((l) => (
            <button key={l} className={`chip chip--ghost ${line === l ? 'is-active' : ''}`} style={{ minHeight: 36, padding: '0 12px' }} onClick={() => setLine(l)}>{LINE_LABELS[l]}</button>
          ))}
        </div>
        <div className="row">
          <input className="input" placeholder="Poste (ex. Attaquant · ailier)" value={position} onChange={(e) => setPosition(e.target.value)} />
          <input className="input" placeholder="N°" inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} style={{ maxWidth: 80 }} />
        </div>
        <button className="btn btn--sm" onClick={save}>{saved ? 'Enregistré' : 'Enregistrer'}</button>
      </section>

      {isCaptainOrStaff(profile) && (
        <section className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Message au groupe</span>
          <textarea className="input" rows={3} style={{ padding: 12, minHeight: 90, resize: 'vertical' }} placeholder="Affiché sur l'accueil de tout le monde" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <button className="btn btn--sm" disabled={!msg.trim()} onClick={async () => { await postAnnouncement(profile.id, msg.trim()); setMsg(''); setSent(true); setTimeout(() => setSent(false), 2000) }}>{sent ? 'Envoyé' : 'Publier'}</button>
        </section>
      )}

      <section className="stack stack--md">
        <span className="eyebrow">À venir dans l'app</span>
        <div className="card card--list">
          {ROADMAP.map((m) => (
            <div key={m.title} className="listrow" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
              <div className="stack" style={{ gap: 1 }}><span style={{ fontWeight: 600, color: 'var(--text-2)' }}>{m.title}</span><span className="small muted">{m.sub}</span></div>
              <Chip>{m.tag}</Chip>
            </div>
          ))}
        </div>
      </section>

      {isStaff(profile) && (
        <Link to="/membres" className="btn btn--secondary btn--sm">Gérer les membres et les rôles</Link>
      )}
      <button className="btn btn--secondary btn--sm" onClick={signOut}>Se déconnecter</button>
      <p className="small muted center">Ardziv 2 · V1 · fait par et pour l'équipe</p>
    </>
  )
}
