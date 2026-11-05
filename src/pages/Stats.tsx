import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '../lib/useAsync'
import { fetchEvents, fetchProfiles, fetchResults, fetchStandings, fetchStats, saveStandings, sortStandings } from '../lib/data'
import { fmtDate, timeAgo } from '../lib/format'
import { useAuth } from '../lib/auth'
import { isCaptainOrStaff, isPlayer, isStaff, YELLOW_ALERT, type MatchStat, type Profile, type Standing } from '../lib/types'
import { PageTitle, Skeleton } from '../components/ui'
import StandingsTable from '../components/StandingsTable'

export default function Stats() {
  const { profile } = useAuth()
  const staff = isStaff(profile)
  const [editStandings, setEditStandings] = useState(false)

  const q = useAsync(async () => {
    const [events, results, stats, profiles, standings] = await Promise.all([fetchEvents(), fetchResults(), fetchStats(), fetchProfiles(), fetchStandings()])
    return { events, results, stats, profiles, standings }
  }, [])
  if (q.loading || !q.data || !profile) return <><Skeleton h={60} /><Skeleton h={300} /></>
  const { events, results, stats, profiles, standings } = q.data

  const matches = events.filter((e) => e.type === 'match')
  const played = results.map((r) => ({ r, e: matches.find((m) => m.id === r.event_id)! })).filter((x) => x.e).sort((a, b) => b.e.starts_at.localeCompare(a.e.starts_at))
  const wins = results.filter((r) => r.goals_for > r.goals_against).length
  const draws = results.filter((r) => r.goals_for === r.goals_against).length
  const gf = results.reduce((a, r) => a + r.goals_for, 0)
  const ga = results.reduce((a, r) => a + r.goals_against, 0)

  const totals = aggregate(stats)
  const ranking = (k: 'goals' | 'assists') => Object.entries(totals).filter(([, t]) => t[k] > 0).sort((a, b) => b[1][k] - a[1][k]).slice(0, 6).map(([pid, t]) => ({ pid, v: t[k] }))
  const scorers = ranking('goals')
  const passers = ranking('assists')
  const warned = Object.entries(totals).filter(([, t]) => t.yellow >= YELLOW_ALERT || t.red > 0).sort((a, b) => b[1].red - a[1].red || b[1].yellow - a[1].yellow)
  const mine = totals[profile.id]
  const myPos = standings.findIndex((s) => s.is_us) + 1
  const lastUpdate = standings.reduce((m, s) => (s.updated_at > m ? s.updated_at : m), '')

  return (
    <>
      <PageTitle kicker={`Saison 2026-2027 · ${results.length} journées jouées`} title="Résultats" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
        {[[myPos ? `${myPos}${myPos === 1 ? 'er' : 'e'}` : '–', 'classement', true], [wins, 'victoires', false], [draws, 'nuls', false], [`${gf}-${ga}`, 'buts', false]].map(([v, l, g]) => (
          <div key={String(l)} className="card card--sm" style={{ alignItems: 'center', gap: 2, padding: '12px 6px' }}>
            <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 30, lineHeight: 1, color: g ? 'var(--gold)' : 'var(--text)' }}>{String(v)}</span>
            <span className="small muted" style={{ fontSize: 11 }}>{String(l)}</span>
          </div>
        ))}
      </div>

      {isPlayer(profile) && (
        <section className="card" style={{ padding: '16px 18px', gap: 12 }}>
          <h2 className="h2">Mes stats</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 6 }}>
            {[[mine?.played ?? 0, 'matchs'], [mine?.goals ?? 0, 'buts'], [mine?.assists ?? 0, 'passes'], [(mine?.yellow ?? 0) + (mine?.red ?? 0), 'cartons']].map(([v, l]) => (
              <div key={String(l)} className="stack" style={{ alignItems: 'center', gap: 2, background: 'var(--surface-2)', borderRadius: 12, padding: '10px 4px' }}>
                <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 26, lineHeight: 1 }}>{String(v)}</span>
                <span className="small muted" style={{ fontSize: 11 }}>{String(l)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {isCaptainOrStaff(profile) && warned.length > 0 && (
        <section className="card" style={{ gap: 10, background: '#24140F', borderColor: '#5C2A22' }}>
          <span className="eyebrow" style={{ color: '#FF9C8A' }}>Cartons à surveiller</span>
          {warned.map(([pid, t]) => (
            <div key={pid} className="row row--between small">
              <span style={{ fontWeight: 600 }}>{name(profiles, pid)}</span>
              <span style={{ color: '#E0B9B1' }}>{[t.yellow ? `${t.yellow} jaune${t.yellow > 1 ? 's' : ''}` : '', t.red ? `${t.red} rouge${t.red > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}</span>
            </div>
          ))}
          <p className="small" style={{ color: '#E0B9B1' }}>Vérifie le barème de suspension du District de Provence avant le prochain match.</p>
        </section>
      )}

      <section className="card" style={{ padding: '16px 18px', gap: 12 }}>
        <div className="row row--between">
          <h2 className="h2">D2 · poule B</h2>
          {staff && !editStandings && <button className="link" onClick={() => setEditStandings(true)}>Mettre à jour</button>}
        </div>
        {editStandings ? (
          <StandingsEditor rows={standings} onDone={() => { setEditStandings(false); void q.reload() }} />
        ) : standings.length ? (
          <>
            <StandingsTable rows={standings} />
            {lastUpdate && <p className="small muted">Mis à jour {timeAgo(lastUpdate)}.</p>}
          </>
        ) : (
          <p className="small muted">Classement pas encore saisi.</p>
        )}
      </section>

      <section className="stack stack--md">
        <h2 className="h2">Derniers matchs</h2>
        {played.length === 0 && <p className="muted small">Aucun résultat saisi.</p>}
        {played.map(({ r, e }) => {
          const res = r.goals_for > r.goals_against ? 'V' : r.goals_for === r.goals_against ? 'N' : 'D'
          const bg = res === 'V' ? 'var(--gold)' : res === 'N' ? 'var(--muted-2)' : 'var(--red)'
          return (
            <Link key={r.event_id} to={`/evenement/${e.id}`} className="card card--sm" style={{ display: 'grid', gridTemplateColumns: '30px minmax(0,1fr) auto', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 14, color: 'inherit' }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: bg, color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{res}</span>
              <div className="stack" style={{ gap: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{e.opponent ?? e.title}</span>
                <span className="small muted">{e.matchday ? `${e.matchday} · ` : ''}{fmtDate(e.starts_at)} · {e.is_home ? 'Sévan' : 'extérieur'}</span>
              </div>
              <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 22 }}>{r.goals_for}-{r.goals_against}</span>
            </Link>
          )
        })}
      </section>

      <Ranking title="Buteurs" rows={scorers} profiles={profiles} me={profile.id} empty="Les buteurs apparaîtront dès qu'une feuille de match sera remplie (ouvre un match passé)." />
      <Ranking title="Passeurs" rows={passers} profiles={profiles} me={profile.id} empty="Les passes décisives apparaîtront avec les feuilles de match." />
    </>
  )
}

interface Totals { played: number; goals: number; assists: number; yellow: number; red: number }
function aggregate(stats: MatchStat[]): Record<string, Totals> {
  const out: Record<string, Totals> = {}
  stats.forEach((s) => {
    const t = (out[s.profile_id] ??= { played: 0, goals: 0, assists: 0, yellow: 0, red: 0 })
    if (s.played) t.played++
    t.goals += s.goals
    t.assists += s.assists
    t.yellow += s.yellow
    t.red += s.red
  })
  return out
}

const name = (profiles: Profile[], id: string) => profiles.find((p) => p.id === id)?.first_name ?? '?'

function Ranking({ title, rows, profiles, me, empty }: { title: string; rows: { pid: string; v: number }[]; profiles: Profile[]; me: string; empty: string }) {
  const max = rows[0]?.v ?? 1
  return (
    <section className="card" style={{ padding: '16px 18px', gap: 12 }}>
      <h2 className="h2">{title}</h2>
      {rows.length === 0 && <p className="muted small">{empty}</p>}
      {rows.map(({ pid, v }) => {
        const mine = pid === me
        return (
          <div key={pid} style={{ display: 'grid', gridTemplateColumns: '80px minmax(0,1fr) 24px', alignItems: 'center', gap: 10, fontSize: 14 }}>
            <span style={{ fontWeight: 600, color: mine ? 'var(--gold)' : 'var(--text)' }}>{name(profiles, pid)}</span>
            <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}><div style={{ width: `${Math.round((v / max) * 100)}%`, height: 6, background: mine ? 'var(--gold)' : 'var(--muted-2)' }} /></div>
            <span style={{ fontWeight: 700, textAlign: 'right' }}>{v}</span>
          </div>
        )
      })}
    </section>
  )
}

type Num = 'played' | 'won' | 'drawn' | 'lost' | 'goals_for' | 'goals_against'
const COLS: { k: Num; l: string }[] = [
  { k: 'played', l: 'J' }, { k: 'won', l: 'V' }, { k: 'drawn', l: 'N' }, { k: 'lost', l: 'D' }, { k: 'goals_for', l: 'BP' }, { k: 'goals_against', l: 'BC' },
]

/** Saisie du classement par le staff : les points se calculent tout seuls (V×3 + N). */
function StandingsEditor({ rows, onDone }: { rows: Standing[]; onDone: () => void }) {
  const [data, setData] = useState<Standing[]>(rows.map((r) => ({ ...r })))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (team: string, k: Num, v: number) =>
    setData((d) => d.map((r) => {
      if (r.team !== team) return r
      const n = { ...r, [k]: Math.max(0, v) }
      n.points = n.won * 3 + n.drawn
      return n
    }))

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await saveStandings(sortStandings(data))
      onDone()
    } catch {
      setError("L'enregistrement a échoué.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack stack--md">
      <p className="small text-2">Recopie les chiffres de Score'n'co ou de la FFF. Les points se calculent automatiquement (3 par victoire, 1 par nul).</p>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 420 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px,1fr) repeat(6, 40px) 34px', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--muted)', paddingBottom: 6 }}>
            <span>ÉQUIPE</span>{COLS.map((c) => <span key={c.k} className="center">{c.l}</span>)}<span className="center">PTS</span>
          </div>
          {data.map((r) => (
            <div key={r.team} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px,1fr) repeat(6, 40px) 34px', gap: 4, alignItems: 'center', padding: '4px 0', borderTop: '1px solid var(--line)' }}>
              <span style={{ fontSize: 13, fontWeight: r.is_us ? 700 : 500, color: r.is_us ? 'var(--gold)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.team}</span>
              {COLS.map((c) => (
                <input key={c.k} aria-label={`${c.l} ${r.team}`} inputMode="numeric" value={r[c.k]} onChange={(e) => set(r.team, c.k, Number(e.target.value.replace(/\D/g, '')) || 0)}
                  style={{ width: 40, height: 36, borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--surface-2)', color: 'var(--text)', textAlign: 'center', fontSize: 14 }} />
              ))}
              <span className="center" style={{ fontWeight: 700 }}>{r.points}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button className="btn btn--sm btn--secondary" disabled={busy} onClick={onDone}>Annuler</button>
        <button className="btn btn--sm" disabled={busy} onClick={save}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
