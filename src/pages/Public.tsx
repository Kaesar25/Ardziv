import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchPublicMatch, fetchPublicTeam, type PublicMatch, type PublicTeam } from '../lib/data4'

const TZ = 'Europe/Paris'
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { ...o, timeZone: TZ }).format(new Date(iso))
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="shell" style={{ minHeight: '100dvh' }}>
      <header className="shell__header">
        <div className="row" style={{ gap: 10 }}>
          <img src="/icons/icon-192.png" alt="" width={34} height={34} style={{ borderRadius: 9 }} />
          <div className="stack" style={{ gap: 2 }}>
            <span className="display" style={{ fontSize: 20 }}>EUGA Ardziv <span className="gold">2</span></span>
            <span className="kicker" style={{ fontSize: 11 }}>Marseille · depuis 1924</span>
          </div>
        </div>
      </header>
      <main className="shell__main" style={{ paddingBottom: 40 }}>{children}</main>
    </div>
  )
}

export function PublicMatchPage() {
  const { id } = useParams()
  const [m, setM] = useState<PublicMatch | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    const load = () => fetchPublicMatch(id ?? '').then((x) => alive && setM(x)).catch(() => alive && setM(null))
    void load()
    const t = setInterval(load, 30_000) // score en direct
    return () => { alive = false; clearInterval(t) }
  }, [id])
  if (m === undefined) return <Frame><div className="skeleton" style={{ minHeight: 300 }} /></Frame>
  if (!m) return <Frame><p className="muted">Ce match n'existe pas ou n'est plus disponible.</p></Frame>
  const home = m.is_home !== false
  const opp = m.opponent ?? m.title
  const [l, r] = home ? ['Ardziv 2', opp] : [opp, 'Ardziv 2']
  const score = m.result ?? (m.live && m.live.phase !== 'pre' ? m.live : null)
  const [sl, sr] = score ? (home ? [score.for, score.against] : [score.against, score.for]) : [null, null]
  const isLive = !m.result && m.live && m.live.phase !== 'pre' && m.live.phase !== 'finished'
  return (
    <Frame>
      <span className="kicker">{m.competition ?? 'Départemental 2'}{m.matchday ? ` · ${m.matchday}` : ''}</span>
      <section className="card" style={{ gap: 18, alignItems: 'center', borderColor: 'rgba(233,192,74,.45)' }}>
        {isLive && <span className="chip chip--red">En direct</span>}
        {m.status && m.status !== 'scheduled' && <span className="chip chip--red">{m.status === 'postponed' ? 'Reporté' : 'Annulé'}</span>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center', width: '100%' }}>
          <span style={{ fontWeight: 700, textAlign: 'center', color: home ? 'var(--gold)' : undefined }}>{l}</span>
          <span className="display" style={{ fontSize: 56 }}>{sl != null ? `${sl} - ${sr}` : 'VS'}</span>
          <span style={{ fontWeight: 700, textAlign: 'center', color: !home ? 'var(--gold)' : undefined }}>{r}</span>
        </div>
        <span className="text-2 center">{cap(fmt(m.starts_at, { weekday: 'long', day: 'numeric', month: 'long' }))} · {fmt(m.starts_at, { hour: '2-digit', minute: '2-digit' })}</span>
        {m.location && <a className="small gold" style={{ fontWeight: 600 }} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.location)}`} target="_blank" rel="noreferrer">{m.location} · itinéraire</a>}
      </section>
      {m.scorers.length > 0 && (
        <section className="card card--sm" style={{ gap: 6 }}>
          <span className="eyebrow">Buteurs d'Ardziv</span>
          {m.scorers.map((s) => <span key={s.name}>{s.name}{s.goals > 1 ? ` ×${s.goals}` : ''}</span>)}
        </section>
      )}
      {isLive && <p className="small muted center">Le score se met à jour automatiquement.</p>}
      <Link to="/public/equipe" className="btn btn--secondary btn--sm">Classement et calendrier de l'équipe</Link>
    </Frame>
  )
}

export function PublicTeamPage() {
  const [t, setT] = useState<PublicTeam | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => { fetchPublicTeam().then(setT).catch(() => setErr(true)) }, [])
  if (err) return <Frame><p className="muted">Page indisponible pour le moment.</p></Frame>
  if (!t) return <Frame><div className="skeleton" style={{ minHeight: 300 }} /></Frame>
  const played = t.matches.filter((m) => m.for != null)
  const next = t.matches.filter((m) => m.for == null && new Date(m.starts_at).getTime() > Date.now() - 3 * 3600_000 && (m.status ?? 'scheduled') === 'scheduled')
  const w = played.filter((m) => m.for! > m.against!).length
  const d = played.filter((m) => m.for === m.against).length
  const rank = t.standings.findIndex((s) => s.is_us) + 1
  return (
    <Frame>
      <div className="stack">
        <span className="kicker">Saison {t.season} · Départemental 2, poule B</span>
        <h1 className="display display--xl">L'équipe 2</h1>
      </div>
      <section className="card" style={{ gap: 8 }}>
        <p style={{ lineHeight: 1.5 }}>La réserve de l'EUGA Ardziv, club historique de la communauté arménienne de Marseille, fondé en 1924. L'équipe première joue en Régional 1.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
          {[[rank ? `${rank}e` : '—', 'au classement'], [`${w}V ${d}N ${played.length - w - d}D`, 'bilan'], [String(played.reduce((a, m) => a + (m.for ?? 0), 0)), 'buts marqués']].map(([v, l]) => (
            <div key={l} className="card card--sm" style={{ background: 'var(--ink)', gap: 2, alignItems: 'center' }}><span className="display" style={{ fontSize: 26 }}>{v}</span><span className="small muted">{l}</span></div>
          ))}
        </div>
      </section>
      {next.length > 0 && (
        <section className="stack stack--md">
          <span className="eyebrow">Prochains matchs</span>
          <div className="card card--list">
            {next.slice(0, 4).map((m) => (
              <Link key={m.id} to={`/public/match/${m.id}`} className="listrow" style={{ gridTemplateColumns: '70px minmax(0,1fr)', color: 'inherit' }}>
                <span className="small gold" style={{ fontWeight: 700 }}>{fmt(m.starts_at, { day: 'numeric', month: 'short' })}</span>
                <span style={{ fontWeight: 600 }}>{m.title}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="stack stack--md">
        <span className="eyebrow">Classement</span>
        <div className="card card--list">
          {t.standings.map((s, i) => (
            <div key={s.team} className="listrow" style={{ gridTemplateColumns: '24px minmax(0,1fr) 40px 44px' }}>
              <span className="small muted" style={{ fontWeight: 700 }}>{i + 1}</span>
              <span style={{ fontWeight: s.is_us ? 800 : 500, color: s.is_us ? 'var(--gold)' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.team}</span>
              <span className="small muted" style={{ textAlign: 'right' }}>{s.played} J</span>
              <span style={{ fontWeight: 800, textAlign: 'right' }}>{s.points}</span>
            </div>
          ))}
        </div>
      </section>
      {played.length > 0 && (
        <section className="stack stack--md">
          <span className="eyebrow">Résultats</span>
          <div className="card card--list">
            {[...played].reverse().map((m) => (
              <Link key={m.id} to={`/public/match/${m.id}`} className="listrow" style={{ gridTemplateColumns: '54px minmax(0,1fr) auto', color: 'inherit' }}>
                <span className="small muted">{m.matchday ?? fmt(m.starts_at, { day: 'numeric', month: 'short' })}</span>
                <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
                <span style={{ fontWeight: 800, color: m.for! > m.against! ? 'var(--gold)' : m.for! < m.against! ? 'var(--red)' : 'var(--text-2)' }}>{m.is_home !== false ? `${m.for}-${m.against}` : `${m.against}-${m.for}`}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </Frame>
  )
}
