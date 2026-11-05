import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { postAnnouncement, updateProfile } from '../lib/data'
import { canViewStaffData, isCaptainOrStaff, isPlayer, isStaff, LINE_LABELS, ROLE_LABELS, type SquadLine } from '../lib/types'
import { Avatar, PageTitle } from '../components/ui'
import PushCard from '../components/PushCard'
import MyFollowUp from '../components/MyFollowUp'
import { notify } from '../lib/push'

const SPACES: { to: string; title: string; sub: string; who?: 'staff' | 'view' }[] = [
  { to: '/actus', title: 'Actus', sub: 'Fil et galerie photo' },
  { to: '/entrainement', title: 'Entraînement', sub: 'Séances, exercices, tests, programmes' },
  { to: '/video', title: 'Vidéo', sub: 'Clips annotés, tes actions' },
  { to: '/tactique', title: 'Tactique', sub: 'Coups de pied arrêtés, adversaires' },
  { to: '/vestiaire', title: 'Vestiaire', sub: 'Charte, boîte à idées, humeur' },
  { to: '/club', title: 'Le club', sub: 'Histoire, quiz, Ardziv Wrapped' },
  { to: '/groupe?onglet=caisse', title: 'Caisse', sub: 'Cotisations et amendes' },
  { to: '/cagnottes', title: 'Cagnottes', sub: 'Cadeaux, repas, déplacements' },
  { to: '/visuels', title: 'Visuels', sub: 'Affiche, score, homme du match' },
  { to: '/equipe1', title: 'Équipe 1', sub: 'Forme, montées, descentes', who: 'view' },
  { to: '/staff', title: 'Espace staff', sub: 'Suivi joueurs, ressentis, dossiers', who: 'staff' },
  { to: '/cagnottes?onglet=sponsors', title: 'Sponsors', sub: 'Partenaires et contreparties', who: 'staff' },
  { to: '/membres', title: 'Membres', sub: 'Rôles et accès', who: 'staff' },
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

      <section className="card" style={{ gap: 12 }}>
        <PushCard compact />
      </section>

      <section className="stack stack--md">
        <span className="eyebrow">Espaces</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {SPACES.filter((s) => !s.who || (s.who === 'staff' ? isStaff(profile) : canViewStaffData(profile))).map((s) => (
            <Link key={s.to} to={s.to} className="card card--sm" style={{ gap: 3, color: 'inherit', borderColor: s.who ? 'rgba(233,192,74,.35)' : undefined }}>
              <span style={{ fontWeight: 700 }}>{s.title}</span>
              <span className="small muted">{s.sub}</span>
            </Link>
          ))}
        </div>
      </section>

      {isPlayer(profile) && <MyFollowUp me={profile} />}

      {isCaptainOrStaff(profile) && (
        <section className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Message au groupe</span>
          <textarea className="input" rows={3} style={{ padding: 12, minHeight: 90, resize: 'vertical' }} placeholder="Affiché sur l'accueil de tout le monde" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <button className="btn btn--sm" disabled={!msg.trim()} onClick={async () => { await postAnnouncement(profile.id, msg.trim()); void notify('announcement'); setMsg(''); setSent(true); setTimeout(() => setSent(false), 2000) }}>{sent ? 'Envoyé' : 'Publier'}</button>
        </section>
      )}

      <section className="card card--sm" style={{ gap: 6 }}>
        <span className="eyebrow">Page publique de l'équipe</span>
        <span className="small text-2">Classement, calendrier et résultats, visibles sans compte : à partager aux familles, aux amis du club et aux sponsors.</span>
        <a className="small gold" style={{ fontWeight: 600 }} href="/public/equipe" target="_blank" rel="noreferrer">Ouvrir la page publique</a>
      </section>

      <button className="btn btn--secondary btn--sm" onClick={signOut}>Se déconnecter</button>
      <p className="small muted center">Ardziv 2 · V3 · fait par et pour l'équipe</p>
    </>
  )
}
