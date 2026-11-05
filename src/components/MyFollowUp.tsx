import { useAsync } from '../lib/useAsync'
import { adminMissing, fetchAdmin, fetchGoals, setGoalDone, ADMIN_LABELS } from '../lib/data3'
import type { Profile } from '../lib/types'

/** « Mon suivi » : objectifs fixés par le staff et état du dossier administratif. */
export default function MyFollowUp({ me }: { me: Profile }) {
  const q = useAsync(async () => {
    const [goals, admin] = await Promise.all([fetchGoals(me.id), fetchAdmin(me.id)])
    return { goals, admin: admin[0] }
  }, [me.id])
  if (!q.data) return null
  const { goals, admin } = q.data
  const missing = adminMissing(admin)
  return (
    <section className="card" style={{ gap: 12 }}>
      <span className="eyebrow">Mon suivi</span>
      {goals.length > 0 ? (
        <div className="stack" style={{ gap: 8 }}>
          <span className="small muted">Mes objectifs avec le staff</span>
          {goals.map((g) => (
            <button key={g.id} className="row" style={{ gap: 10, textAlign: 'left', color: 'inherit' }} onClick={async () => { await setGoalDone(g.id, !g.done); void q.reload() }}>
              <span style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, border: g.done ? 0 : '2px solid var(--line-strong)', background: g.done ? 'var(--gold)' : 'transparent', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>{g.done ? '✓' : ''}</span>
              <span className="stack" style={{ gap: 0 }}><span style={{ fontWeight: 600, textDecoration: g.done ? 'line-through' : 'none' }}>{g.title}</span>{g.due && <span className="small muted">Avant le {new Date(g.due).toLocaleDateString('fr-FR')}</span>}</span>
            </button>
          ))}
        </div>
      ) : <span className="small muted">Pas encore d'objectif individuel. Ils apparaîtront ici après ton entretien avec le staff.</span>}
      <div className="hr" />
      <div className="row row--between">
        <span className="small muted">Dossier administratif</span>
        <span className="small" style={{ fontWeight: 700, color: missing.length ? 'var(--red)' : 'var(--gold)' }}>{missing.length ? `Manque : ${missing.join(', ')}` : 'Complet'}</span>
      </div>
      {admin && (
        <div className="stack" style={{ gap: 2 }}>
          <span className="small text-2">Licence : {ADMIN_LABELS[admin.licence]}</span>
          <span className="small text-2">Certificat : {admin.certificat_until ? `valable jusqu'au ${new Date(admin.certificat_until).toLocaleDateString('fr-FR')}` : 'non renseigné'}</span>
          {admin.notes && <span className="small text-2">{admin.notes}</span>}
        </div>
      )}
    </section>
  )
}
