import { useEffect, useState } from 'react'
import { fetchMatchStats, saveMatchStats } from '../lib/data'
import type { MatchStat, Profile } from '../lib/types'
import { Avatar } from './ui'

type Row = Omit<MatchStat, 'event_id'>
type Field = 'goals' | 'assists' | 'yellow' | 'red'

const FIELDS: { k: Field; label: string; short: string }[] = [
  { k: 'goals', label: 'Buts', short: 'B' },
  { k: 'assists', label: 'Passes', short: 'P' },
  { k: 'yellow', label: 'Jaune', short: 'J' },
  { k: 'red', label: 'Rouge', short: 'R' },
]

const empty = (profile_id: string): Row => ({ profile_id, played: false, minutes: null, goals: 0, assists: 0, yellow: 0, red: 0 })

/** Feuille de match : qui a joué, buts, passes décisives, cartons. Lecture pour tous, saisie capitaine + staff. */
export default function MatchSheet({ eventId, players, canEdit }: { eventId: string; players: Profile[]; canEdit: boolean }) {
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchMatchStats(eventId).then((stats) => {
      const r: Record<string, Row> = {}
      players.forEach((p) => { r[p.id] = empty(p.id) })
      stats.forEach((s) => { r[s.profile_id] = { profile_id: s.profile_id, played: s.played, minutes: s.minutes, goals: s.goals, assists: s.assists, yellow: s.yellow, red: s.red } })
      setRows(r)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [eventId, players])

  if (!loaded) return null
  const byId = (id: string) => players.find((p) => p.id === id)
  const list = Object.values(rows)
  const scorers = list.filter((r) => r.goals > 0).sort((a, b) => b.goals - a.goals)
  const passers = list.filter((r) => r.assists > 0).sort((a, b) => b.assists - a.assists)
  const cards = list.filter((r) => r.yellow > 0 || r.red > 0)
  const nPlayed = list.filter((r) => r.played).length
  const hasData = scorers.length + passers.length + cards.length + nPlayed > 0

  function set(pid: string, patch: Partial<Row>) {
    setRows((prev) => {
      const cur = prev[pid] ?? empty(pid)
      const next = { ...cur, ...patch }
      if ((next.goals || next.assists || next.yellow || next.red) && !next.played) next.played = true
      return { ...prev, [pid]: next }
    })
  }

  async function save() {
    setBusy(true)
    try {
      await saveMatchStats(eventId, list)
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setBusy(false)
    }
  }

  const name = (id: string) => byId(id)?.first_name ?? '?'
  const fmt = (rs: Row[], k: Field) => rs.map((r) => `${name(r.profile_id)}${r[k] > 1 ? ` ×${r[k]}` : ''}`).join(', ')

  return (
    <section className="card" style={{ gap: 14 }}>
      <div className="row row--between">
        <h2 className="h2">Feuille de match</h2>
        {canEdit && !editing && <button className="link" onClick={() => setEditing(true)}>{hasData ? 'Modifier' : 'Remplir'}</button>}
      </div>

      {!editing && (
        hasData ? (
          <div className="stack stack--md small">
            {scorers.length > 0 && <Line label="Buteurs" value={fmt(scorers, 'goals')} />}
            {passers.length > 0 && <Line label="Passeurs" value={fmt(passers, 'assists')} />}
            {cards.length > 0 && <Line label="Cartons" value={cards.map((r) => `${name(r.profile_id)} (${[r.yellow ? `jaune${r.yellow > 1 ? ' ×' + r.yellow : ''}` : '', r.red ? 'rouge' : ''].filter(Boolean).join(', ')})`).join(', ')} />}
            {nPlayed > 0 && <Line label="Ont joué" value={`${nPlayed} joueurs`} />}
            {saved && <span className="gold">Feuille enregistrée</span>}
          </div>
        ) : (
          <p className="small muted">{canEdit ? 'Renseigne qui a joué, les buteurs, les passeurs et les cartons.' : 'Pas encore remplie par le capitaine ou le staff.'}</p>
        )
      )}

      {editing && (
        <>
          <p className="small text-2">Touche un prénom pour indiquer qu'il a joué. Dans chaque case, un appui ajoute 1 ; arrivé au maximum, la case revient à zéro.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) repeat(4, 40px)', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.06em' }}>
            <span>JOUEUR</span>
            {FIELDS.map((f) => <span key={f.k} className="center" title={f.label}>{f.label.toUpperCase().slice(0, 4)}</span>)}
          </div>
          <div className="stack" style={{ gap: 0 }}>
            {players.map((p) => {
              const r = rows[p.id] ?? empty(p.id)
              return (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) repeat(4, 40px)', gap: 6, alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--line)' }}>
                  <button className="row" style={{ gap: 8, minHeight: 40, opacity: r.played ? 1 : 0.55 }} onClick={() => set(p.id, { played: !r.played })} aria-pressed={r.played}>
                    <Avatar p={p} me={r.played} />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{p.first_name}</span>
                  </button>
                  {FIELDS.map((f) => (
                    <Counter key={f.k} value={r[f.k]} max={f.k === 'red' ? 1 : f.k === 'yellow' ? 2 : 20} label={`${f.label} ${p.first_name}`}
                      onChange={(v) => set(p.id, { [f.k]: v } as Partial<Row>)} />
                  ))}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button className="btn btn--sm btn--secondary" onClick={() => setEditing(false)} disabled={busy}>Annuler</button>
            <button className="btn btn--sm" onClick={save} disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </>
      )}
    </section>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '84px minmax(0,1fr)', gap: 8 }}>
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  )
}

/** Compteur compact : un appui ajoute 1, un appui long ou au maximum repasse à 0. */
function Counter({ value, max, onChange, label }: { value: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <button
      aria-label={`${label} : ${value}. Appuie pour ajouter`}
      onClick={() => onChange(value >= max ? 0 : value + 1)}
      onContextMenu={(e) => { e.preventDefault(); onChange(0) }}
      style={{ width: 40, height: 40, borderRadius: 10, background: value ? 'var(--gold)' : 'var(--surface-2)', color: value ? 'var(--ink)' : 'var(--muted-2)', fontWeight: 700, fontSize: 15, textAlign: 'center' }}
    >
      {value || '·'}
    </button>
  )
}
