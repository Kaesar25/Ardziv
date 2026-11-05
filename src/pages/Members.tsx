import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'
import { fetchProfiles, updateProfile } from '../lib/data'
import { isStaff, ROLE_LABELS, type MemberRole, type Profile } from '../lib/types'
import { Avatar, PageTitle, Skeleton } from '../components/ui'
import { IconBack } from '../components/Icons'

const ROLES: MemberRole[] = ['player', 'captain', 'coach', 'staff']

export default function Members() {
  const { profile } = useAuth()
  const q = useAsync(fetchProfiles, [])
  const [busy, setBusy] = useState<string | null>(null)

  if (!isStaff(profile)) return <p className="muted">Réservé au staff.</p>
  if (q.loading || !q.data) return <><Skeleton h={60} /><Skeleton h={300} /></>

  async function setRole(p: Profile, role: MemberRole) {
    setBusy(p.id)
    try {
      await updateProfile(p.id, { role })
      q.setData(q.data!.map((x) => (x.id === p.id ? { ...x, role } : x)))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Link to="/plus" className="row link" style={{ gap: 6, color: 'var(--text-2)' }}><IconBack />Retour</Link>
      <PageTitle kicker={`${q.data.length} membres`} title="Gérer les membres" />
      <p className="small text-2">Les joueurs rejoignent avec le code <b>ARDZIV2</b>, le staff avec <b>ARDZIV2-STAFF</b>. Tu peux changer le rôle de chacun ici.</p>
      <div className="stack stack--md">
        {q.data.map((p) => (
          <div key={p.id} className="card card--sm" style={{ gap: 10 }}>
            <div className="row">
              <Avatar p={p} me={p.id === profile?.id} />
              <div className="stack" style={{ gap: 1 }}>
                <span style={{ fontWeight: 600 }}>{p.first_name} {p.last_name ?? ''}</span>
                <span className="small muted">{p.position ?? ROLE_LABELS[p.role]}</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 4 }} className="segmented">
              {ROLES.map((r) => (
                <button key={r} className={`segmented__btn ${p.role === r ? 'is-yes' : ''}`} style={{ minHeight: 38, fontSize: 12.5 }} disabled={busy === p.id || p.id === profile?.id} onClick={() => setRole(p, r)}>
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="small muted">Tu ne peux pas changer ton propre rôle, pour éviter de te retirer l'accès par erreur.</p>
    </>
  )
}
