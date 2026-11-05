import { useState } from 'react'
import { useAsync } from '../lib/useAsync'
import { addFine, deleteFine, euros, fetchFinePresets, fetchFines, setFinePaid } from '../lib/data2'
import { notify } from '../lib/push'
import { timeAgo } from '../lib/format'
import { isStaff, type Fine, type Profile } from '../lib/types'
import { Avatar, Chip, Skeleton } from './ui'

/** Caisse de l'équipe : amendes et cotisations, tableau public, encaissements par le staff. */
export default function Treasury({ me, profiles }: { me: Profile; profiles: Profile[] }) {
  const staff = isStaff(me)
  const q = useAsync(async () => {
    const [fines, presets] = await Promise.all([fetchFines(), fetchFinePresets()])
    return { fines, presets }
  }, [])
  const [adding, setAdding] = useState(false)
  const [who, setWho] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState<Fine['kind']>('fine')
  const [filter, setFilter] = useState<'unpaid' | 'all'>('unpaid')
  const [busy, setBusy] = useState(false)

  if (q.loading || !q.data) return <Skeleton h={240} />
  const { fines, presets } = q.data
  const name = (id: string) => profiles.find((p) => p.id === id)
  const collected = fines.filter((f) => f.paid).reduce((a, f) => a + f.amount, 0)
  const pending = fines.filter((f) => !f.paid).reduce((a, f) => a + f.amount, 0)
  const mine = fines.filter((f) => f.profile_id === me.id && !f.paid)
  const myDue = mine.reduce((a, f) => a + f.amount, 0)

  // Tableau d'honneur des amendes (non sérieux, mais ça fait parler)
  const byPlayer: Record<string, number> = {}
  fines.filter((f) => f.kind === 'fine').forEach((f) => { byPlayer[f.profile_id] = (byPlayer[f.profile_id] ?? 0) + f.amount })
  const top = Object.entries(byPlayer).sort((a, b) => b[1] - a[1]).slice(0, 3)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try { await fn(); await q.reload() } finally { setBusy(false) }
  }

  const list = fines.filter((f) => filter === 'all' || !f.paid)

  return (
    <div className="stack stack--lg">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="card card--sm" style={{ alignItems: 'center', gap: 2 }}>
          <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 32, color: 'var(--gold)', lineHeight: 1 }}>{euros(collected)}</span>
          <span className="small muted">en caisse</span>
        </div>
        <div className="card card--sm" style={{ alignItems: 'center', gap: 2 }}>
          <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 32, lineHeight: 1 }}>{euros(pending)}</span>
          <span className="small muted">à encaisser</span>
        </div>
      </div>

      <section className="card card--sm" style={{ gap: 6, borderColor: myDue ? 'rgba(229,100,78,.4)' : undefined }}>
        <span className="eyebrow">Ton solde</span>
        {myDue ? (
          <>
            <span style={{ fontWeight: 700 }}>{euros(myDue)} à régler</span>
            {mine.map((f) => <span key={f.id} className="small text-2">{f.label} · {euros(f.amount)}</span>)}
          </>
        ) : <span className="small text-2">Tout est réglé. Rien en attente.</span>}
      </section>

      {top.length > 0 && (
        <section className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Podium des amendes</span>
          {top.map(([pid, total], i) => { const p = name(pid); return p ? (
            <div key={pid} className="row row--between">
              <div className="row"><span className="gold" style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 20, width: 18 }}>{i + 1}</span><Avatar p={p} me={p.id === me.id} /><span style={{ fontWeight: 600 }}>{p.first_name}</span></div>
              <span style={{ fontWeight: 700 }}>{euros(total)}</span>
            </div>
          ) : null })}
        </section>
      )}

      {staff && !adding && <button className="btn btn--sm" onClick={() => setAdding(true)}>+ Ajouter une amende ou une cotisation</button>}
      {staff && adding && (
        <section className="card" style={{ gap: 10 }}>
          <div className="segmented">
            {([['fine', 'Amende'], ['dues', 'Cotisation'], ['other', 'Autre']] as const).map(([k, l]) => <button key={k} className={`segmented__btn ${kind === k ? 'is-yes' : ''}`} onClick={() => setKind(k)}>{l}</button>)}
          </div>
          <span className="label">Joueur</span>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {profiles.map((p) => <button key={p.id} className={`chip chip--ghost ${who === p.id ? 'is-active' : ''}`} style={{ minHeight: 34 }} onClick={() => setWho(p.id)}>{p.first_name}</button>)}
          </div>
          <span className="label">Motif</span>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {presets.map((p) => <button key={p.id} className={`chip chip--ghost ${label === p.label ? 'is-active' : ''}`} style={{ minHeight: 34 }} onClick={() => { setLabel(p.label); setAmount(String(p.amount)); if (p.label === 'Cotisation') setKind('dues') }}>{p.label} · {euros(p.amount)}</button>)}
          </div>
          <div className="row">
            <input className="input" placeholder="Motif" value={label} onChange={(e) => setLabel(e.target.value)} />
            <input className="input" placeholder="€" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(',', '.'))} style={{ maxWidth: 90 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button className="btn btn--sm btn--secondary" onClick={() => setAdding(false)}>Annuler</button>
            <button className="btn btn--sm" disabled={busy || !who || !label || !Number(amount)} onClick={() => run(async () => {
              await addFine(who!, label, Number(amount), kind, me.id)
              void notify('fine_added', undefined, { profile_id: who, label, amount: Number(amount) })
              setAdding(false); setWho(null); setLabel(''); setAmount('')
            })}>Ajouter</button>
          </div>
        </section>
      )}

      <section className="stack stack--md">
        <div className="row row--between">
          <h2 className="h2">Mouvements</h2>
          <div className="row" style={{ gap: 6 }}>
            <button className={`chip chip--ghost ${filter === 'unpaid' ? 'is-active' : ''}`} onClick={() => setFilter('unpaid')}>À régler</button>
            <button className={`chip chip--ghost ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>Tout</button>
          </div>
        </div>
        {list.length === 0 && <p className="small muted">{filter === 'unpaid' ? 'Rien à encaisser.' : 'Aucun mouvement pour l’instant.'}</p>}
        <div className="card card--list">
          {list.map((f) => { const p = name(f.profile_id); return (
            <div key={f.id} className="listrow">
              {p ? <Avatar p={p} me={p.id === me.id} /> : <span />}
              <div className="stack" style={{ gap: 1 }}>
                <span style={{ fontWeight: 600 }}>{p?.first_name ?? '?'} · {euros(f.amount)}</span>
                <span className="small muted">{f.label} · {timeAgo(f.created_at)}</span>
              </div>
              {staff ? (
                <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                  <button className={`chip ${f.paid ? 'chip--gold' : 'chip--ghost'}`} disabled={busy} onClick={() => run(() => setFinePaid(f.id, !f.paid))}>{f.paid ? 'Réglé' : 'Encaisser'}</button>
                  {!f.paid && <button className="link" style={{ minHeight: 24, fontSize: 12, color: 'var(--muted)' }} disabled={busy} onClick={() => run(() => deleteFine(f.id))}>Annuler</button>}
                </div>
              ) : <Chip tone={f.paid ? 'gold' : 'default'}>{f.paid ? 'Réglé' : 'À régler'}</Chip>}
            </div>
          ) })}
        </div>
      </section>
    </div>
  )
}
