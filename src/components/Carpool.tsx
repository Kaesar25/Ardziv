import { useState } from 'react'
import { useAsync } from '../lib/useAsync'
import { fetchCarpools, joinCar, leaveCar, offerCar, removeCar } from '../lib/data2'
import { isStaff, type Profile } from '../lib/types'
import { Avatar, Chip, Skeleton } from './ui'

/** Covoiturage d'un déplacement : proposer sa voiture, réserver une place, voir qui monte avec qui. */
export default function Carpool({ eventId, me, profiles }: { eventId: string; me: Profile; profiles: Profile[] }) {
  const q = useAsync(() => fetchCarpools(eventId), [eventId])
  const [offering, setOffering] = useState(false)
  const [seats, setSeats] = useState(3)
  const [point, setPoint] = useState('Parking du stade Sévan')
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)

  if (q.loading || !q.data) return <Skeleton h={160} />
  const { cars, passengers } = q.data
  const name = (id: string) => profiles.find((p) => p.id === id)
  const myCar = cars.find((c) => c.driver_id === me.id)
  const myRide = passengers.find((p) => p.profile_id === me.id)
  const totalFree = cars.reduce((n, c) => n + Math.max(0, c.seats - passengers.filter((p) => p.carpool_id === c.id).length), 0)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try { await fn(); await q.reload() } finally { setBusy(false) }
  }

  return (
    <div className="stack stack--lg">
      <div className="row row--between">
        <div className="stack" style={{ gap: 2 }}>
          <h2 className="h2">Covoiturage</h2>
          <span className="small muted">{cars.length} voiture{cars.length > 1 ? 's' : ''} · {totalFree} place{totalFree > 1 ? 's' : ''} libre{totalFree > 1 ? 's' : ''}</span>
        </div>
        {!myCar && !offering && <button className="btn btn--sm" style={{ width: 'auto' }} onClick={() => setOffering(true)}>Je prends ma voiture</button>}
      </div>

      {offering && (
        <section className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Proposer ma voiture</span>
          <label className="label" htmlFor="seats">Places pour les coéquipiers</label>
          <div className="segmented" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
            {[1, 2, 3, 4].map((n) => <button key={n} className={`segmented__btn ${seats === n ? 'is-yes' : ''}`} onClick={() => setSeats(n)}>{n}</button>)}
          </div>
          <label className="label" htmlFor="point">Point de rendez-vous</label>
          <input id="point" className="input" value={point} onChange={(e) => setPoint(e.target.value)} />
          <label className="label" htmlFor="time">Heure de départ</label>
          <input id="time" className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button className="btn btn--sm btn--secondary" onClick={() => setOffering(false)}>Annuler</button>
            <button className="btn btn--sm" disabled={busy} onClick={() => run(async () => { await offerCar(eventId, me.id, seats, point, time); setOffering(false) })}>Proposer</button>
          </div>
        </section>
      )}

      {cars.length === 0 && !offering && <p className="small muted">Personne n'a encore proposé sa voiture. Si tu en as une, propose-la : les autres pourront réserver une place.</p>}

      {cars.map((c) => {
        const driver = name(c.driver_id)
        const inCar = passengers.filter((p) => p.carpool_id === c.id)
        const free = c.seats - inCar.length
        const mine = c.driver_id === me.id
        const iAmIn = inCar.some((p) => p.profile_id === me.id)
        return (
          <section key={c.id} className="card" style={{ gap: 12, borderColor: mine || iAmIn ? 'rgba(233,192,74,.4)' : undefined }}>
            <div className="row row--between">
              <div className="row">
                {driver && <Avatar p={driver} me={mine} lg />}
                <div className="stack" style={{ gap: 1 }}>
                  <span style={{ fontWeight: 600 }}>{driver?.first_name ?? '?'}{mine ? ' · toi' : ''}</span>
                  <span className="small muted">{[c.meeting_point, c.meeting_time].filter(Boolean).join(' · ') || 'Rendez-vous à préciser'}</span>
                </div>
              </div>
              <Chip tone={free > 0 ? 'gold' : 'default'}>{free > 0 ? `${free} place${free > 1 ? 's' : ''}` : 'Complet'}</Chip>
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {inCar.map((p) => { const pp = name(p.profile_id); return pp ? <Chip key={p.profile_id}>{pp.first_name}</Chip> : null })}
              {Array.from({ length: Math.max(0, free) }).map((_, i) => <span key={i} className="chip chip--ghost" style={{ color: 'var(--muted-2)' }}>libre</span>)}
            </div>
            {mine ? (
              <button className="btn btn--sm btn--secondary" disabled={busy} onClick={() => run(() => removeCar(c.id))}>Retirer ma voiture</button>
            ) : iAmIn ? (
              <button className="btn btn--sm btn--secondary" disabled={busy} onClick={() => run(() => leaveCar(c.id, me.id))}>Je ne monte plus</button>
            ) : !myRide && !myCar && free > 0 ? (
              <button className="btn btn--sm" disabled={busy} onClick={() => run(() => joinCar(c.id, me.id))}>Je monte avec {driver?.first_name}</button>
            ) : isStaff(me) && inCar.length > 0 ? null : null}
          </section>
        )
      })}
    </div>
  )
}
