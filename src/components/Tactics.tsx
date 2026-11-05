import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '../lib/useAsync'
import { fetchLineup, fetchScouting, fetchSetPieces, FORMATIONS, saveLineup, saveScouting } from '../lib/data2'
import { notify } from '../lib/push'
import { isStaff, SET_PIECE_LABELS, type LineupSpot, type MatchResult, type Profile, type TeamEvent } from '../lib/types'
import { Chip, Skeleton } from './ui'

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

/** Plan de match : composition, consignes collectives et individuelles, fiche adversaire, coups de pied arrêtés. */
export default function Tactics({ event, me, players, previous }: { event: TeamEvent; me: Profile; players: Profile[]; previous: { event: TeamEvent; result: MatchResult } | null }) {
  const staff = isStaff(me)
  const q = useAsync(async () => {
    const [lineup, scouting, setPieces] = await Promise.all([fetchLineup(event.id), event.opponent ? fetchScouting(event.opponent) : Promise.resolve(null), fetchSetPieces()])
    return { lineup, scouting, setPieces }
  }, [event.id])
  const [view, setView] = useState<'compo' | 'adv' | 'cpa'>('compo')

  if (q.loading || !q.data) return <Skeleton h={320} />
  const { lineup, scouting, setPieces } = q.data

  return (
    <div className="stack stack--lg">
      <div className="segmented">
        {([['compo', 'Composition'], ['adv', 'Adversaire'], ['cpa', 'Coups de pied']] as const).map(([k, l]) => (
          <button key={k} className={`segmented__btn ${view === k ? 'is-yes' : ''}`} onClick={() => setView(k)}>{l}</button>
        ))}
      </div>

      {view === 'compo' && (
        staff ? <LineupEditor event={event} me={me} players={players} initial={lineup} onSaved={() => q.reload()} />
          : lineup && lineup.published ? <LineupView lineup={lineup} players={players} me={me} />
          : <p className="small muted">La composition et les consignes seront publiées par le staff avant le match.</p>
      )}

      {view === 'adv' && (
        <ScoutingCard opponent={event.opponent ?? event.title} initial={scouting} canEdit={staff} previous={previous} onSaved={() => q.reload()} />
      )}

      {view === 'cpa' && (
        <section className="stack stack--md">
          {setPieces.length === 0 && <p className="small muted">Aucun coup de pied arrêté enregistré pour l'instant.</p>}
          {setPieces.map((s) => (
            <div key={s.id} className="card card--sm" style={{ gap: 6 }}>
              <div className="row row--between"><span className="eyebrow gold" style={{ color: 'var(--gold)' }}>{SET_PIECE_LABELS[s.kind]}</span>{s.taker && <span className="small muted">Tireur : {s.taker}</span>}</div>
              <span className="display" style={{ fontSize: 20 }}>« {s.name} »</span>
              {s.description && <p className="small text-2" style={{ lineHeight: 1.45, whiteSpace: 'pre-line' }}>{s.description}</p>}
            </div>
          ))}
          <Link to="/tactique" className="btn btn--sm btn--secondary">{staff ? 'Gérer la bibliothèque de coups de pied arrêtés' : 'Voir toute la bibliothèque'}</Link>
        </section>
      )}
    </div>
  )
}

// ---------------- Terrain ----------------
function Pitch({ spots, players, me, selected, onSpot, label }: { spots: { x: number; y: number; pid: string | null }[]; players: Profile[]; me: Profile; selected?: number | null; onSpot?: (i: number) => void; label: string }) {
  const name = (id: string | null) => players.find((p) => p.id === id)
  return (
    <div style={{ position: 'relative', height: 440, borderRadius: 18, background: '#10291B', border: '1px solid #1E4430', overflow: 'hidden' }} aria-label={`Composition ${label}`}>
      <div style={{ position: 'absolute', inset: 14, border: '2px solid rgba(255,255,255,.16)', borderRadius: 6 }} />
      <div style={{ position: 'absolute', left: 14, right: 14, top: '50%', borderTop: '2px solid rgba(255,255,255,.16)' }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 84, height: 84, marginLeft: -42, marginTop: -42, border: '2px solid rgba(255,255,255,.16)', borderRadius: 999 }} />
      <div style={{ position: 'absolute', left: '50%', top: 14, width: 150, height: 56, marginLeft: -75, border: '2px solid rgba(255,255,255,.16)', borderTop: 0 }} />
      <div style={{ position: 'absolute', left: '50%', bottom: 14, width: 150, height: 56, marginLeft: -75, border: '2px solid rgba(255,255,255,.16)', borderBottom: 0 }} />
      <span style={{ position: 'absolute', left: 18, top: 20, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'rgba(255,255,255,.55)' }}>{label}</span>
      {spots.map((s, i) => {
        const p = name(s.pid)
        const mine = s.pid === me.id
        const sel = selected === i
        const Tag = onSpot ? 'button' : 'div'
        return (
          <Tag key={i} onClick={onSpot ? () => onSpot(i) : undefined} aria-label={p ? p.first_name : 'Poste libre'}
            style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 78 }}>
            <span style={{ width: 40, height: 40, borderRadius: 999, background: p ? (mine ? 'var(--gold)' : 'var(--text)') : 'rgba(255,255,255,.12)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, border: sel ? '3px solid var(--gold)' : p ? 0 : '2px dashed rgba(255,255,255,.4)', boxShadow: mine ? '0 0 0 6px rgba(233,192,74,.3)' : 'none' }}>
              {p ? (p.number ?? p.first_name.slice(0, 2).toUpperCase()) : '+'}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: mine ? 'var(--gold)' : '#fff', background: 'rgba(0,0,0,.45)', padding: '1px 6px', borderRadius: 6, whiteSpace: 'nowrap' }}>{p ? p.first_name : 'Libre'}</span>
          </Tag>
        )
      })}
    </div>
  )
}

function LineupView({ lineup, players, me }: { lineup: NonNullable<Awaited<ReturnType<typeof fetchLineup>>>; players: Profile[]; me: Profile }) {
  const mine = lineup.individual?.[me.id] ?? []
  const inXI = lineup.positions.some((s) => s.profile_id === me.id)
  return (
    <div className="stack stack--lg">
      <Pitch spots={lineup.positions.map((s) => ({ x: s.x, y: s.y, pid: s.profile_id }))} players={players} me={me} label={lineup.formation} />
      {(mine.length > 0 || inXI) && (
        <section className="card" style={{ gap: 10, borderColor: 'var(--gold)' }}>
          <span className="eyebrow" style={{ color: 'var(--gold)' }}>Ton rôle · {me.first_name}</span>
          {mine.length ? mine.map((l, i) => <Bullet key={i}>{l}</Bullet>) : <p className="small text-2">Pas de consigne individuelle cette semaine.</p>}
        </section>
      )}
      {lineup.collective.length > 0 && (
        <section className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Consignes collectives</span>
          {lineup.collective.map((l, i) => <Bullet key={i}>{l}</Bullet>)}
        </section>
      )}
    </div>
  )
}

function LineupEditor({ event, me, players, initial, onSaved }: { event: TeamEvent; me: Profile; players: Profile[]; initial: Awaited<ReturnType<typeof fetchLineup>>; onSaved: () => void }) {
  const [formation, setFormation] = useState(initial?.formation ?? '4-4-2')
  const [spots, setSpots] = useState<(string | null)[]>(() => {
    const base = FORMATIONS[initial?.formation ?? '4-4-2'] ?? FORMATIONS['4-4-2']
    return base.map((_, i) => initial?.positions[i]?.profile_id ?? null)
  })
  const [selected, setSelected] = useState<number | null>(null)
  const [collective, setCollective] = useState((initial?.collective ?? []).join('\n'))
  const [individual, setIndividual] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initial?.individual ?? {}).map(([k, v]) => [k, v.join('\n')])))
  const [who, setWho] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    const n = (FORMATIONS[formation] ?? []).length
    setSpots((s) => Array.from({ length: n }, (_, i) => s[i] ?? null))
  }, [formation])

  const layout = FORMATIONS[formation] ?? FORMATIONS['4-4-2']
  const placed = new Set(spots.filter(Boolean) as string[])
  const bench = players.filter((p) => !placed.has(p.id))

  function place(pid: string) {
    if (selected === null) return
    setSpots((s) => s.map((x, i) => (i === selected ? pid : x === pid ? null : x)))
    setSelected(null)
  }

  async function save(publish: boolean) {
    setBusy(true)
    try {
      const positions: LineupSpot[] = layout.map((pos, i) => ({ profile_id: spots[i] ?? '', x: pos.x, y: pos.y })).filter((s) => s.profile_id)
      const ind: Record<string, string[]> = {}
      Object.entries(individual).forEach(([k, v]) => { const l = lines(v); if (l.length) ind[k] = l })
      const wasPublished = !!initial?.published
      await saveLineup(event.id, { formation, positions, collective: lines(collective), individual: ind, published: publish || wasPublished })
      if (publish && !wasPublished) void notify('lineup_published', event.id)
      setMsg(publish ? 'Plan de match publié' : 'Brouillon enregistré')
      setTimeout(() => setMsg(null), 2500)
      onSaved()
    } finally { setBusy(false) }
  }

  return (
    <div className="stack stack--lg">
      <div className="scroll-x">
        {Object.keys(FORMATIONS).map((f) => <button key={f} className={`chip chip--ghost ${formation === f ? 'is-active' : ''}`} style={{ minHeight: 36 }} onClick={() => setFormation(f)}>{f}</button>)}
      </div>
      <Pitch spots={layout.map((pos, i) => ({ x: pos.x, y: pos.y, pid: spots[i] }))} players={players} me={me} selected={selected} onSpot={(i) => setSelected(selected === i ? null : i)} label={formation} />
      {selected !== null ? (
        <div className="stack" style={{ gap: 8 }}>
          <span className="small text-2">Choisis le joueur pour ce poste :</span>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {players.map((p) => <button key={p.id} className={`chip chip--ghost ${spots[selected] === p.id ? 'is-active' : ''}`} style={{ minHeight: 36 }} onClick={() => place(p.id)}>{p.first_name}</button>)}
            <button className="chip" style={{ minHeight: 36 }} onClick={() => { setSpots((s) => s.map((x, i) => (i === selected ? null : x))); setSelected(null) }}>Vider le poste</button>
          </div>
        </div>
      ) : (
        <p className="small muted">Touche un rond sur le terrain pour y placer un joueur. Remplaçants : {bench.map((b) => b.first_name).join(', ') || 'aucun'}.</p>
      )}

      <section className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Consignes collectives (une par ligne)</span>
        <textarea className="input" rows={4} style={{ padding: 12, minHeight: 100 }} value={collective} onChange={(e) => setCollective(e.target.value)} placeholder={'Pressing déclenché sur la passe vers leur latéral\nRester compacts : 30 mètres entre les lignes'} />
      </section>

      <section className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Consignes individuelles</span>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {players.map((p) => <button key={p.id} className={`chip chip--ghost ${who === p.id ? 'is-active' : ''}`} style={{ minHeight: 34 }} onClick={() => setWho(p.id)}>{p.first_name}{individual[p.id]?.trim() ? ' •' : ''}</button>)}
        </div>
        {who && (
          <textarea className="input" rows={3} style={{ padding: 12, minHeight: 84 }} value={individual[who] ?? ''} onChange={(e) => setIndividual((m) => ({ ...m, [who]: e.target.value }))}
            placeholder={`Consignes pour ${players.find((p) => p.id === who)?.first_name} (une par ligne). Lui seul les voit.`} />
        )}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button className="btn btn--sm btn--secondary" disabled={busy} onClick={() => save(false)}>Enregistrer le brouillon</button>
        <button className="btn btn--sm" disabled={busy || placed.size === 0} onClick={() => save(true)}>{initial?.published ? 'Mettre à jour' : 'Publier aux joueurs'}</button>
      </div>
      {msg && <span className="small gold center">{msg}</span>}
      {initial?.published ? <Chip tone="gold">Publié · visible par les joueurs</Chip> : <Chip>Brouillon · invisible des joueurs</Chip>}
    </div>
  )
}

function ScoutingCard({ opponent, initial, canEdit, previous, onSaved }: { opponent: string; initial: Awaited<ReturnType<typeof fetchScouting>>; canEdit: boolean; previous: { event: TeamEvent; result: MatchResult } | null; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [system, setSystem] = useState(initial?.system ?? '')
  const [strengths, setStrengths] = useState((initial?.strengths ?? []).join('\n'))
  const [weaknesses, setWeaknesses] = useState((initial?.weaknesses ?? []).join('\n'))
  const [keyPlayers, setKeyPlayers] = useState(initial?.key_players ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [busy, setBusy] = useState(false)

  if (editing) {
    return (
      <section className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Fiche · {opponent}</span>
        <input className="input" placeholder="Système (ex. 4-4-2)" value={system} onChange={(e) => setSystem(e.target.value)} />
        <label className="label">Points forts (un par ligne)</label>
        <textarea className="input" rows={3} style={{ padding: 12 }} value={strengths} onChange={(e) => setStrengths(e.target.value)} />
        <label className="label">Points faibles (un par ligne)</label>
        <textarea className="input" rows={3} style={{ padding: 12 }} value={weaknesses} onChange={(e) => setWeaknesses(e.target.value)} />
        <input className="input" placeholder="Joueurs à surveiller" value={keyPlayers} onChange={(e) => setKeyPlayers(e.target.value)} />
        <textarea className="input" rows={2} style={{ padding: 12 }} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button className="btn btn--sm btn--secondary" onClick={() => setEditing(false)}>Annuler</button>
          <button className="btn btn--sm" disabled={busy} onClick={async () => {
            setBusy(true)
            await saveScouting({ opponent, system: system || null, strengths: lines(strengths), weaknesses: lines(weaknesses), key_players: keyPlayers || null, notes: notes || null })
            setBusy(false); setEditing(false); onSaved()
          }}>Enregistrer</button>
        </div>
      </section>
    )
  }

  return (
    <div className="stack stack--md">
      <section className="card" style={{ gap: 12 }}>
        <div className="row row--between">
          <span className="display" style={{ fontSize: 22 }}>{opponent}</span>
          {canEdit && <button className="link" onClick={() => setEditing(true)}>{initial ? 'Modifier' : 'Remplir la fiche'}</button>}
        </div>
        {previous && (
          <div className="row row--between small"><span className="muted">Match aller ({previous.event.matchday ?? ''})</span><span style={{ fontWeight: 700 }}>Ardziv {previous.result.goals_for}-{previous.result.goals_against}</span></div>
        )}
        {initial?.system && <div className="row row--between small"><span className="muted">Système</span><span style={{ fontWeight: 700 }}>{initial.system}</span></div>}
        {initial?.key_players && <div className="row row--between small"><span className="muted">À surveiller</span><span style={{ fontWeight: 700 }}>{initial.key_players}</span></div>}
        {!initial && <p className="small muted">{canEdit ? 'Pas encore de fiche pour cet adversaire. Elle restera disponible pour le match retour.' : 'Le staff n’a pas encore rempli la fiche de cet adversaire.'}</p>}
      </section>
      {initial && initial.strengths.length > 0 && <section className="card" style={{ gap: 10 }}><span className="eyebrow">Points forts</span>{initial.strengths.map((s, i) => <Bullet key={i}>{s}</Bullet>)}</section>}
      {initial && initial.weaknesses.length > 0 && <section className="card" style={{ gap: 10 }}><span className="eyebrow">Où leur faire mal</span>{initial.weaknesses.map((s, i) => <Bullet key={i}>{s}</Bullet>)}</section>}
      {initial?.notes && <section className="card" style={{ gap: 8 }}><span className="eyebrow">Notes</span><p className="small text-2" style={{ whiteSpace: 'pre-line' }}>{initial.notes}</p></section>}
    </div>
  )
}

function Bullet({ children }: { children: string }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.4 }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--gold)', marginTop: 8, flex: 'none' }} />
      <span>{children}</span>
    </div>
  )
}
