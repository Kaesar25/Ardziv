import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'
import { deleteSetPiece, fetchAllScouting, fetchSetPieces, saveSetPiece } from '../lib/data2'
import { timeAgo } from '../lib/format'
import { isStaff, SET_PIECE_LABELS, type SetPiece, type SetPieceKind } from '../lib/types'
import { PageTitle, Skeleton } from '../components/ui'
import { IconBack } from '../components/Icons'

const KINDS = Object.keys(SET_PIECE_LABELS) as SetPieceKind[]

/** Bibliothèque des coups de pied arrêtés et des fiches adversaires (réutilisées d'un match à l'autre). */
export default function TacticsLibrary() {
  const { profile } = useAuth()
  const staff = isStaff(profile)
  const q = useAsync(async () => {
    const [pieces, scouting] = await Promise.all([fetchSetPieces(), fetchAllScouting()])
    return { pieces, scouting }
  }, [])
  const [editing, setEditing] = useState<Partial<SetPiece> | null>(null)
  const [busy, setBusy] = useState(false)

  if (q.loading || !q.data) return <><Skeleton h={60} /><Skeleton h={300} /></>
  const { pieces, scouting } = q.data

  return (
    <>
      <Link to="/plus" className="row link" style={{ gap: 6, color: 'var(--text-2)' }}><IconBack />Retour</Link>
      <PageTitle kicker={`${pieces.length} combinaisons · ${scouting.length} fiches adversaires`} title="Tactique" />

      <section className="stack stack--md">
        <div className="row row--between">
          <h2 className="h2">Coups de pied arrêtés</h2>
          {staff && !editing && <button className="link" onClick={() => setEditing({ kind: 'corner_off', name: '', taker: '', description: '' })}>+ Ajouter</button>}
        </div>

        {editing && (
          <section className="card" style={{ gap: 10 }}>
            <div className="scroll-x">
              {KINDS.map((k) => <button key={k} className={`chip chip--ghost ${editing.kind === k ? 'is-active' : ''}`} onClick={() => setEditing({ ...editing, kind: k })}>{SET_PIECE_LABELS[k]}</button>)}
            </div>
            <input className="input" placeholder="Nom de code (ex. Ararat)" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <input className="input" placeholder="Tireur" value={editing.taker ?? ''} onChange={(e) => setEditing({ ...editing, taker: e.target.value })} />
            <textarea className="input" rows={4} style={{ padding: 12, minHeight: 110 }} placeholder="Placement et rôle de chacun" value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            <div style={{ display: 'grid', gridTemplateColumns: editing.id ? '1fr 1fr 1fr' : '1fr 1fr', gap: 8 }}>
              <button className="btn btn--sm btn--secondary" onClick={() => setEditing(null)}>Annuler</button>
              {editing.id && <button className="btn btn--sm btn--secondary" style={{ color: 'var(--red)' }} disabled={busy} onClick={async () => { setBusy(true); await deleteSetPiece(editing.id!); setEditing(null); setBusy(false); await q.reload() }}>Supprimer</button>}
              <button className="btn btn--sm" disabled={busy || !editing.name?.trim()} onClick={async () => {
                setBusy(true)
                await saveSetPiece({ ...(editing.id ? { id: editing.id } : {}), kind: editing.kind as SetPieceKind, name: editing.name!.trim(), taker: editing.taker || null, description: editing.description ?? '', sort: editing.sort ?? pieces.length })
                setEditing(null); setBusy(false); await q.reload()
              }}>Enregistrer</button>
            </div>
          </section>
        )}

        {pieces.length === 0 && !editing && <p className="small muted">{staff ? 'Ajoute vos combinaisons : corners, coups francs, penalties. Les joueurs les retrouvent avant chaque match.' : 'Le staff n’a pas encore ajouté de combinaisons.'}</p>}
        {KINDS.map((k) => {
          const list = pieces.filter((p) => p.kind === k)
          if (!list.length) return null
          return (
            <div key={k} className="stack" style={{ gap: 8 }}>
              <span className="eyebrow">{SET_PIECE_LABELS[k]}</span>
              {list.map((s) => (
                <button key={s.id} className="card card--sm" style={{ gap: 6, textAlign: 'left', width: '100%' }} onClick={staff ? () => setEditing(s) : undefined} disabled={!staff}>
                  <div className="row row--between"><span className="display" style={{ fontSize: 20 }}>« {s.name} »</span>{s.taker && <span className="small muted">Tireur : {s.taker}</span>}</div>
                  {s.description && <p className="small text-2" style={{ lineHeight: 1.45, whiteSpace: 'pre-line' }}>{s.description}</p>}
                </button>
              ))}
            </div>
          )
        })}
      </section>

      <section className="stack stack--md">
        <h2 className="h2">Fiches adversaires</h2>
        {scouting.length === 0 && <p className="small muted">Les fiches se remplissent depuis l'onglet Tactique de chaque match. Elles restent disponibles pour le match retour.</p>}
        <div className="card card--list">
          {scouting.map((s) => (
            <div key={s.opponent} className="listrow" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
              <div className="stack" style={{ gap: 1 }}>
                <span style={{ fontWeight: 600 }}>{s.opponent}</span>
                <span className="small muted">{[s.system, `${s.strengths.length} points forts`, `${s.weaknesses.length} points faibles`].filter(Boolean).join(' · ')}</span>
              </div>
              <span className="small muted">{timeAgo(s.updated_at)}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
