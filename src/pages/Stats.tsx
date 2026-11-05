import { useAsync } from '../lib/useAsync'
import { fetchEvents, fetchProfiles, fetchResults, fetchStats } from '../lib/data'
import { fmtDate } from '../lib/format'
import { useAuth } from '../lib/auth'
import { PageTitle, Skeleton } from '../components/ui'

export default function Stats() {
  const { profile } = useAuth()
  const q = useAsync(async () => {
    const [events, results, stats, profiles] = await Promise.all([fetchEvents(), fetchResults(), fetchStats(), fetchProfiles()])
    return { events, results, stats, profiles }
  }, [])
  if (q.loading || !q.data) return <><Skeleton h={60} /><Skeleton h={300} /></>
  const { events, results, stats, profiles } = q.data

  const matches = events.filter((e) => e.type === 'match')
  const played = results.map((r) => ({ r, e: matches.find((m) => m.id === r.event_id)! })).filter((x) => x.e).sort((a, b) => b.e.starts_at.localeCompare(a.e.starts_at))
  const wins = results.filter((r) => r.goals_for > r.goals_against).length
  const draws = results.filter((r) => r.goals_for === r.goals_against).length
  const gf = results.reduce((a, r) => a + r.goals_for, 0)
  const ga = results.reduce((a, r) => a + r.goals_against, 0)

  const goals: Record<string, number> = {}
  stats.forEach((s) => { goals[s.profile_id] = (goals[s.profile_id] ?? 0) + s.goals })
  const scorers = Object.entries(goals).filter(([, g]) => g > 0).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const max = scorers[0]?.[1] ?? 1

  return (
    <>
      <PageTitle kicker={`Saison 2026-2027 · ${results.length} journées jouées`} title="Résultats" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
        {[['joués', results.length, false], ['victoires', wins, true], ['nuls', draws, false], ['buts', `${gf}-${ga}`, false]].map(([l, v, g]) => (
          <div key={String(l)} className="card card--sm" style={{ alignItems: 'center', gap: 2, padding: '12px 6px' }}>
            <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 30, lineHeight: 1, color: g ? 'var(--gold)' : 'var(--text)' }}>{String(v)}</span>
            <span className="small muted" style={{ fontSize: 11 }}>{String(l)}</span>
          </div>
        ))}
      </div>

      <section className="stack stack--md">
        <h2 className="h2">Derniers matchs</h2>
        {played.length === 0 && <p className="muted small">Aucun résultat saisi.</p>}
        {played.map(({ r, e }) => {
          const res = r.goals_for > r.goals_against ? 'V' : r.goals_for === r.goals_against ? 'N' : 'D'
          const bg = res === 'V' ? 'var(--gold)' : res === 'N' ? 'var(--muted-2)' : 'var(--red)'
          return (
            <div key={r.event_id} className="card card--sm" style={{ display: 'grid', gridTemplateColumns: '30px minmax(0,1fr) auto', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 14 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: bg, color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{res}</span>
              <div className="stack" style={{ gap: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{e.opponent ?? e.title}</span>
                <span className="small muted">{e.matchday ? `${e.matchday} · ` : ''}{fmtDate(e.starts_at)} · {e.is_home ? 'Sévan' : 'extérieur'}</span>
              </div>
              <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 22 }}>{r.goals_for}-{r.goals_against}</span>
            </div>
          )
        })}
      </section>

      <section className="card" style={{ padding: '16px 18px', gap: 12 }}>
        <h2 className="h2">Buteurs</h2>
        {scorers.length === 0 && <p className="muted small">Les buteurs apparaîtront dès que le capitaine ou le staff remplira la feuille de match.</p>}
        {scorers.map(([pid, g]) => {
          const p = profiles.find((x) => x.id === pid)
          const me = pid === profile?.id
          return (
            <div key={pid} style={{ display: 'grid', gridTemplateColumns: '72px minmax(0,1fr) 24px', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <span style={{ fontWeight: 600, color: me ? 'var(--gold)' : 'var(--text)' }}>{p?.first_name ?? '?'}</span>
              <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}><div style={{ width: `${Math.round((g / max) * 100)}%`, height: 6, background: me ? 'var(--gold)' : 'var(--muted-2)' }} /></div>
              <span style={{ fontWeight: 700, textAlign: 'right' }}>{g}</span>
            </div>
          )
        })}
      </section>
    </>
  )
}
