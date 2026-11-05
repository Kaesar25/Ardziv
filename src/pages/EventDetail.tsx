import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'
import { fetchAvailabilities, fetchEvent, fetchProfiles, fetchResults, fetchSquad, publishSquad, saveResult, saveSquad, setAvailability } from '../lib/data'
import { fmtDate, fmtLong, fmtTime, cap } from '../lib/format'
import { isCaptainOrStaff, isPlayer, isStaff, LINE_LABELS, type Availability, type Profile, type SquadLine } from '../lib/types'
import MatchSheet from '../components/MatchSheet'
import { Avatar, Chip, Segmented, Skeleton, Status } from '../components/ui'
import { IconBack } from '../components/Icons'
import { MatchHeader, ResponseBar, dispoHint } from './Home'
import { notify } from '../lib/push'

const LINES: SquadLine[] = ['GB', 'DEF', 'MIL', 'ATT']

export default function EventDetail() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
  const staff = isStaff(profile)
  const capOrStaff = isCaptainOrStaff(profile)
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bench, setBench] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [reminded, setReminded] = useState<string | null>(null)

  const q = useAsync(async () => {
    const [event, profiles, avail, { squad, players }, results] = await Promise.all([fetchEvent(id), fetchProfiles(), fetchAvailabilities([id]), fetchSquad(id), fetchResults()])
    return { event, profiles, avail, squad, squadPlayers: players, result: results.find((r) => r.event_id === id) ?? null }
  }, [id])

  if (q.loading || !q.data || !profile) return <><Skeleton h={40} /><Skeleton h={240} /></>
  const { event, profiles, avail, squad, squadPlayers, result } = q.data
  if (!event) return <p className="muted">Événement introuvable.</p>

  const isMatch = event.type === 'match'
  const players = profiles.filter((p) => p.role === 'player' || p.role === 'captain')
  const statusOf = (pid: string): Availability | null => avail.find((a) => a.profile_id === pid)?.status ?? null
  const mine = statusOf(profile.id)
  const published = !!squad?.published_at
  const inSquad = (pid: string) => squadPlayers.find((s) => s.profile_id === pid)
  const past = new Date(event.starts_at).getTime() < Date.now() - 3 * 3600_000

  const c = (() => {
    const r = { yes: 0, maybe: 0, no: 0, none: 0, total: players.length }
    players.forEach((p) => { const s = statusOf(p.id); if (s) r[s]++; else r.none++ })
    return r
  })()

  async function answer(s: Availability) {
    await setAvailability(id, profile!.id, s)
    await q.reload()
  }

  function startEditing() {
    const st = new Set(squadPlayers.filter((s) => s.slot === 'starter').map((s) => s.profile_id))
    const be = new Set(squadPlayers.filter((s) => s.slot === 'bench').map((s) => s.profile_id))
    if (st.size === 0 && be.size === 0) players.forEach((p) => { if (statusOf(p.id) === 'yes') st.add(p.id) })
    setSelected(st); setBench(be); setEditing(true)
  }
  function cycle(pid: string) {
    const st = new Set(selected), be = new Set(bench)
    if (st.has(pid)) { st.delete(pid); be.add(pid) }
    else if (be.has(pid)) { be.delete(pid) }
    else st.add(pid)
    setSelected(st); setBench(be)
  }
  async function save(andPublish: boolean) {
    setBusy(true)
    try {
      await saveSquad(id, [...selected], [...bench])
      if (andPublish) {
        await publishSquad(id, profile!.id)
        void notify('squad_published', id)
      }
      setEditing(false)
      await q.reload()
    } finally { setBusy(false) }
  }

  const who = event.opponent ?? event.title

  return (
    <>
      <Link to={isMatch ? '/' : '/agenda'} className="row link" style={{ gap: 6, color: 'var(--text-2)' }}><IconBack />Retour</Link>

      <div className="stack">
        <span className="kicker">{cap(fmtLong(event.starts_at))} · {fmtTime(event.starts_at)}{event.location ? ` · ${event.location}` : ''}</span>
        <h1 className="display display--xl">{isMatch ? (past ? `${who}` : `Groupe vs ${who}`) : event.title}</h1>
        {isMatch && <p className="text-2" style={{ fontSize: 14 }}>{published ? `Groupe publié · ${squadPlayers.length} joueurs` : staff ? 'Brouillon · non visible par les joueurs' : 'Le groupe sera publié par le staff.'}</p>}
        {event.notes && <p className="text-2" style={{ fontSize: 14 }}>{event.notes}</p>}
      </div>

      {isMatch && <section className="card"><MatchHeader home={!!event.is_home} opponent={who} time={fmtTime(event.starts_at)} date={fmtDate(event.starts_at)} />
        {result && <div className="center" style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 44, lineHeight: 1 }}>{event.is_home ? `${result.goals_for} – ${result.goals_against}` : `${result.goals_against} – ${result.goals_for}`}</div>}
        {past && capOrStaff && <ResultForm eventId={id} initial={result} onSaved={() => q.reload()} />}
      </section>}

      {isMatch && past && <MatchSheet eventId={id} players={players} canEdit={capOrStaff} />}

      {!past && isPlayer(profile) && (
        <section className="card" style={{ gap: 12 }}>
          <div className="row">
            <Avatar p={profile} me lg />
            <div className="stack" style={{ gap: 1 }}><span style={{ fontWeight: 600 }}>{profile.first_name} · toi</span><span className="small muted">{profile.position ?? 'Joueur'}</span></div>
          </div>
          <Segmented value={mine} onChange={answer} />
          <span className="small muted center">{dispoHint(mine)}</span>
        </section>
      )}

      {!past && staff && (
        <section className="card" style={{ gap: 14 }}>
          <ResponseBar c={c} />
          {c.none > 0 && (
            <button
              className="btn btn--sm btn--secondary"
              disabled={!!reminded}
              onClick={async () => {
                setReminded('…')
                const r = await notify('remind', id)
                setReminded(r ? `Relance envoyée à ${r.sent} appareil${r.sent > 1 ? 's' : ''}` : 'Relance impossible pour le moment')
              }}
            >
              {reminded ?? `Relancer ${c.none === 1 ? 'le joueur' : `les ${c.none} joueurs`} sans réponse`}
            </button>
          )}
          {isMatch && !editing && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="btn btn--sm btn--secondary" onClick={startEditing}>{squadPlayers.length ? 'Modifier le groupe' : 'Composer le groupe'}</button>
              <button className="btn btn--sm" disabled={published || squadPlayers.length === 0 || busy} onClick={() => save(true)}>{published ? 'Publié' : 'Publier le groupe'}</button>
            </div>
          )}
          {isMatch && editing && (
            <>
              <p className="small text-2">Touche un joueur : titulaire → remplaçant → non retenu. {selected.size} titulaires, {bench.size} remplaçants.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button className="btn btn--sm btn--secondary" disabled={busy} onClick={() => save(false)}>Enregistrer le brouillon</button>
                <button className="btn btn--sm" disabled={busy || selected.size === 0} onClick={() => save(true)}>Publier</button>
              </div>
            </>
          )}
        </section>
      )}

      <section className="stack" style={{ gap: 6 }}>
        {LINES.map((line) => {
          const list = players.filter((p) => (p.line ?? 'MIL') === line)
          if (!list.length) return null
          return (
            <div key={line} className="stack" style={{ gap: 0 }}>
              <span className="eyebrow" style={{ padding: '10px 0 4px' }}>{LINE_LABELS[line]}</span>
              {list.map((p) => <PlayerRow key={p.id} p={p} me={p.id === profile.id} status={statusOf(p.id)} showStatus={!past} slot={editing ? (selected.has(p.id) ? 'starter' : bench.has(p.id) ? 'bench' : null) : (published || staff) ? (inSquad(p.id)?.slot ?? null) : undefined} onTap={editing ? () => cycle(p.id) : undefined} />)}
            </div>
          )
        })}
        {players.some((p) => !p.line) && <p className="small muted">Les joueurs sans poste apparaissent dans « Milieux ». Ils peuvent le régler dans « Plus → Mon profil ».</p>}
      </section>
    </>
  )
}

function PlayerRow({ p, me, status, showStatus, slot, onTap }: { p: Profile; me: boolean; status: Availability | null; showStatus: boolean; slot?: 'starter' | 'bench' | null; onTap?: () => void }) {
  const inner = (
    <>
      <Avatar p={p} me={me} />
      <div className="stack" style={{ gap: 1 }}>
        <span style={{ fontWeight: 600 }}>{p.first_name}{me ? ' · toi' : ''}</span>
        <span className="small muted">{p.position ?? (p.number ? `n°${p.number}` : '')}</span>
      </div>
      <div className="stack" style={{ alignItems: 'flex-end', gap: 3 }}>
        {slot === 'starter' && <Chip tone="gold">Titulaire</Chip>}
        {slot === 'bench' && <Chip>Remplaçant</Chip>}
        {slot === null && onTap && <Chip tone="ghost">Non retenu</Chip>}
        {showStatus && <Status s={status} />}
      </div>
    </>
  )
  const style = { padding: '8px 0', borderTop: 0 }
  return onTap ? <button className="listrow" style={{ ...style, width: '100%' }} onClick={onTap}>{inner}</button> : <div className="listrow" style={style}>{inner}</div>
}

function ResultForm({ eventId, initial, onSaved }: { eventId: string; initial: { goals_for: number; goals_against: number } | null; onSaved: () => void }) {
  const [gf, setGf] = useState(initial?.goals_for ?? 0)
  const [ga, setGa] = useState(initial?.goals_against ?? 0)
  const [busy, setBusy] = useState(false)
  return (
    <div className="stack stack--md">
      <span className="eyebrow">Score (buts Ardziv – buts adverses)</span>
      <div className="row">
        <input className="input" type="number" min={0} value={gf} onChange={(e) => setGf(Number(e.target.value))} />
        <span className="muted">–</span>
        <input className="input" type="number" min={0} value={ga} onChange={(e) => setGa(Number(e.target.value))} />
      </div>
      <button className="btn btn--sm" disabled={busy} onClick={async () => { setBusy(true); await saveResult(eventId, gf, ga); if (!initial) void notify('result', eventId); setBusy(false); onSaved() }}>{initial ? 'Mettre à jour le score' : 'Enregistrer le score'}</button>
    </div>
  )
}
