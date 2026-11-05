import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'
import { fetchProfiles } from '../lib/data'
import { euros } from '../lib/data2'
import {
  addSponsorItem, createPot, deletePot, deleteSponsor, deleteSponsorItem, fetchPots, fetchSponsors, pledge, saveSponsor, setReceived, setSponsorItem, unpledge,
  type Contribution, type Pot, type Sponsor, type SponsorItem,
} from '../lib/data4'
import { isCaptainOrStaff, isStaff, type Profile } from '../lib/types'
import { PageTitle, Skeleton } from '../components/ui'

export default function Funding() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  if (!profile) return null
  const staff = isStaff(profile)
  const tab = staff && params.get('onglet') === 'sponsors' ? 'sponsors' : 'cagnottes'
  return (
    <>
      <PageTitle kicker="Financer la vie du groupe" title={tab === 'sponsors' ? 'Sponsors' : 'Cagnottes'} />
      {staff && (
        <div className="segmented" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <button className={`segmented__btn ${tab === 'cagnottes' ? 'is-yes' : ''}`} onClick={() => setParams({}, { replace: true })}>Cagnottes</button>
          <button className={`segmented__btn ${tab === 'sponsors' ? 'is-yes' : ''}`} onClick={() => setParams({ onglet: 'sponsors' }, { replace: true })}>Sponsors</button>
        </div>
      )}
      {tab === 'cagnottes' ? <Pots me={profile} /> : <Sponsors />}
    </>
  )
}

// ====================== Cagnottes ======================
function Pots({ me }: { me: Profile }) {
  const q = useAsync(async () => ({ ...(await fetchPots()), profiles: await fetchProfiles() }), [])
  const [creating, setCreating] = useState(false)
  const manage = isCaptainOrStaff(me)
  if (q.loading || !q.data) return <Skeleton h={200} />
  const { pots, contributions, profiles } = q.data
  return (
    <div className="stack stack--lg">
      <p className="small text-2">Une cagnotte pour un cadeau, un repas d'équipe, un déplacement. Chacun indique sa participation, le trésorier coche quand l'argent est reçu (en main propre, virement ou Lydia). L'app ne gère aucun paiement.</p>
      {manage && (creating ? <PotForm me={me} onDone={() => { setCreating(false); void q.reload() }} /> : <button className="btn btn--sm" onClick={() => setCreating(true)}>Nouvelle cagnotte</button>)}
      {pots.length === 0 && !creating && <section className="card card--sm center small muted">Aucune cagnotte en cours.</section>}
      {pots.map((p) => <PotCard key={p.id} pot={p} contributions={contributions.filter((c) => c.pot_id === p.id)} me={me} profiles={profiles} manage={manage} onChange={() => void q.reload()} />)}
    </div>
  )
}

function PotForm({ me, onDone }: { me: Profile; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [goal, setGoal] = useState('')
  const [closes, setCloses] = useState('')
  return (
    <section className="card" style={{ gap: 10 }}>
      <input className="input" placeholder="Pour quoi ? (ex. Repas de fin de saison)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="input" rows={2} style={{ padding: 12, minHeight: 64 }} placeholder="Détails, à qui donner l'argent…" value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="row" style={{ gap: 8 }}>
        <input className="input" inputMode="decimal" placeholder="Objectif (€)" value={goal} onChange={(e) => setGoal(e.target.value)} />
        <input className="input" type="date" value={closes} onChange={(e) => setCloses(e.target.value)} />
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn--secondary btn--sm" onClick={onDone}>Annuler</button>
        <button className="btn btn--sm" disabled={!title.trim()} onClick={async () => { await createPot({ title: title.trim(), description: description.trim() || null, goal: Number(goal.replace(',', '.')) || null, closes_on: closes || null }, me.id); onDone() }}>Créer</button>
      </div>
    </section>
  )
}

function PotCard({ pot, contributions, me, profiles, manage, onChange }: { pot: Pot; contributions: Contribution[]; me: Profile; profiles: Profile[]; manage: boolean; onChange: () => void }) {
  const mine = contributions.find((c) => c.profile_id === me.id)
  const [amount, setAmount] = useState(mine ? String(mine.amount) : '')
  const pledged = contributions.reduce((a, c) => a + c.amount, 0)
  const received = contributions.filter((c) => c.received).reduce((a, c) => a + c.amount, 0)
  const goal = pot.goal ? Number(pot.goal) : null
  const closed = pot.closes_on ? new Date(`${pot.closes_on}T23:59:59`) < new Date() : false
  const pct = (v: number) => `${goal ? Math.min(100, (v / goal) * 100) : 100}%`
  return (
    <section className="card" style={{ gap: 10 }}>
      <div className="row row--between"><span className="eyebrow">{closed ? 'Clôturée' : pot.closes_on ? `Jusqu'au ${new Date(pot.closes_on).toLocaleDateString('fr-FR')}` : 'En cours'}</span><span className="small muted">{contributions.length} participant{contributions.length > 1 ? 's' : ''}</span></div>
      <span style={{ fontWeight: 700, fontSize: 17 }}>{pot.title}</span>
      {pot.description && <p className="small text-2" style={{ whiteSpace: 'pre-line' }}>{pot.description}</p>}
      <div className="row row--between"><span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 24 }}>{euros(received)}</span><span className="small muted">{euros(pledged)} promis{goal ? ` · objectif ${euros(goal)}` : ''}</span></div>
      <div className="bar" style={{ position: 'relative' }}>
        <span style={{ width: pct(received), background: 'var(--gold)' }} />
        <span style={{ width: `calc(${pct(pledged)} - ${pct(received)})`, background: 'rgba(233,192,74,.35)' }} />
      </div>
      {!closed && (
        <div className="row" style={{ gap: 8 }}>
          <input className="input" inputMode="decimal" placeholder="Ma participation (€)" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={mine?.received} />
          {mine && !mine.received && <button className="btn btn--secondary btn--sm" style={{ width: 'auto' }} onClick={async () => { await unpledge(pot.id, me.id); setAmount(''); onChange() }}>Retirer</button>}
          <button className="btn btn--sm" style={{ width: 'auto' }} disabled={mine?.received || !(Number(amount.replace(',', '.')) > 0)} onClick={async () => { await pledge(pot.id, me.id, Number(amount.replace(',', '.'))); onChange() }}>{mine ? 'Modifier' : 'Participer'}</button>
        </div>
      )}
      {mine?.received && <span className="small gold" style={{ fontWeight: 700 }}>Ta participation de {euros(mine.amount)} est reçue. Merci !</span>}
      {manage && contributions.length > 0 && (
        <>
          <div className="hr" />
          {contributions.map((c) => {
            const p = profiles.find((x) => x.id === c.profile_id)
            return (
              <div key={c.profile_id} className="row row--between">
                <span className="small" style={{ fontWeight: 600 }}>{p?.first_name ?? '—'} · {euros(c.amount)}</span>
                <button className={`chip chip--ghost ${c.received ? 'is-active' : ''}`} onClick={async () => { await setReceived(pot.id, c.profile_id, !c.received); onChange() }}>{c.received ? 'Reçu' : 'Marquer reçu'}</button>
              </div>
            )
          })}
          <button className="small muted" style={{ textAlign: 'left' }} onClick={async () => { if (confirm('Supprimer cette cagnotte ?')) { await deletePot(pot.id); onChange() } }}>Supprimer la cagnotte</button>
        </>
      )}
    </section>
  )
}

// ====================== Sponsors ======================
function Sponsors() {
  const q = useAsync(fetchSponsors, [])
  const [editing, setEditing] = useState<(Omit<Sponsor, 'id'> & { id?: string }) | null>(null)
  if (q.loading || !q.data) return <Skeleton h={200} />
  const { sponsors, items } = q.data
  const total = sponsors.reduce((a, s) => a + Number(s.amount ?? 0), 0)
  const late = items.filter((i) => !i.done && i.due && new Date(i.due) < new Date()).length
  if (editing) return <SponsorForm value={editing} onDone={() => { setEditing(null); void q.reload() }} />
  return (
    <div className="stack stack--lg">
      <section className="card" style={{ gap: 6 }}>
        <span className="eyebrow">Saison en cours · visible du staff uniquement</span>
        <div className="row row--between"><span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 26 }}>{euros(total)}</span><span className="small muted">{sponsors.length} partenaire{sponsors.length > 1 ? 's' : ''}</span></div>
        {late > 0 && <span className="small red" style={{ fontWeight: 700 }}>{late} contrepartie{late > 1 ? 's' : ''} en retard</span>}
      </section>
      <button className="btn btn--sm" onClick={() => setEditing({ name: '', contact: '', amount: null, season: '2026-2027', notes: '' })}>Ajouter un sponsor</button>
      {sponsors.map((s) => <SponsorCard key={s.id} s={s} items={items.filter((i) => i.sponsor_id === s.id)} onEdit={() => setEditing({ ...s })} onChange={() => void q.reload()} />)}
    </div>
  )
}

function SponsorCard({ s, items, onEdit, onChange }: { s: Sponsor; items: SponsorItem[]; onEdit: () => void; onChange: () => void }) {
  const [label, setLabel] = useState('')
  const [due, setDue] = useState('')
  const done = items.filter((i) => i.done).length
  return (
    <section className="card" style={{ gap: 10 }}>
      <div className="row row--between"><span style={{ fontWeight: 700, fontSize: 17 }}>{s.name}</span>{s.amount != null && <span className="gold" style={{ fontWeight: 700 }}>{euros(Number(s.amount))}</span>}</div>
      {s.contact && <span className="small muted">{s.contact}</span>}
      {s.notes && <span className="small text-2">{s.notes}</span>}
      <span className="small muted">Contreparties · {done}/{items.length} faites</span>
      {items.map((i) => {
        const lateItem = !i.done && i.due && new Date(i.due) < new Date()
        return (
          <div key={i.id} className="row" style={{ gap: 10 }}>
            <button aria-label={i.done ? 'Rouvrir' : 'Fait'} onClick={async () => { await setSponsorItem(i.id, !i.done); onChange() }} style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, border: i.done ? 0 : '2px solid var(--line-strong)', background: i.done ? 'var(--gold)' : 'transparent', color: 'var(--ink)', fontWeight: 800, fontSize: 13 }}>{i.done ? '✓' : ''}</button>
            <span className="stack" style={{ gap: 0, flex: 1 }}><span style={{ fontWeight: 600, textDecoration: i.done ? 'line-through' : 'none' }}>{i.label}</span>{i.due && <span className="small" style={{ color: lateItem ? 'var(--red)' : 'var(--muted)' }}>{lateItem ? 'En retard · ' : ''}{new Date(i.due).toLocaleDateString('fr-FR')}</span>}</span>
            <button className="muted" aria-label="Supprimer" onClick={async () => { await deleteSponsorItem(i.id); onChange() }}>✕</button>
          </div>
        )
      })}
      <div className="row" style={{ gap: 6 }}>
        <input className="input" style={{ flex: 1, minHeight: 42 }} placeholder="Ex. Logo sur les maillots, post Instagram" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className="input" type="date" style={{ maxWidth: 145, minHeight: 42 }} value={due} onChange={(e) => setDue(e.target.value)} />
      </div>
      <button className="btn btn--secondary btn--sm" disabled={!label.trim()} onClick={async () => { await addSponsorItem(s.id, label.trim(), due || null); setLabel(''); setDue(''); onChange() }}>Ajouter la contrepartie</button>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn--secondary btn--sm" onClick={onEdit}>Modifier</button>
        <button className="btn btn--secondary btn--sm" style={{ color: 'var(--red)' }} onClick={async () => { if (confirm(`Supprimer ${s.name} ?`)) { await deleteSponsor(s.id); onChange() } }}>Supprimer</button>
      </div>
    </section>
  )
}

function SponsorForm({ value, onDone }: { value: Omit<Sponsor, 'id'> & { id?: string }; onDone: () => void }) {
  const [s, setS] = useState(value)
  return (
    <section className="card" style={{ gap: 10 }}>
      <span className="eyebrow">{s.id ? 'Modifier le sponsor' : 'Nouveau sponsor'}</span>
      <input className="input" placeholder="Nom de l'entreprise" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
      <input className="input" placeholder="Contact (nom du gérant…)" value={s.contact ?? ''} onChange={(e) => setS({ ...s, contact: e.target.value })} />
      <div className="row" style={{ gap: 8 }}>
        <input className="input" inputMode="decimal" placeholder="Montant (€)" value={s.amount ?? ''} onChange={(e) => setS({ ...s, amount: Number(e.target.value.replace(',', '.')) || null })} />
        <input className="input" placeholder="Saison" value={s.season} onChange={(e) => setS({ ...s, season: e.target.value })} />
      </div>
      <textarea className="input" rows={2} style={{ padding: 12, minHeight: 64 }} placeholder="Notes (matériel offert, renouvellement…)" value={s.notes ?? ''} onChange={(e) => setS({ ...s, notes: e.target.value })} />
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn--secondary btn--sm" onClick={onDone}>Annuler</button>
        <button className="btn btn--sm" disabled={!s.name.trim()} onClick={async () => { await saveSponsor({ ...s, name: s.name.trim(), contact: s.contact || null, notes: s.notes || null }); onDone() }}>Enregistrer</button>
      </div>
    </section>
  )
}
