import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'
import { fetchEvents, fetchProfiles, fetchResults, fetchStats } from '../lib/data'
import { fetchMotmResults } from '../lib/data2'
import { isCaptainOrStaff, type Profile, type TeamEvent } from '../lib/types'
import { PageTitle, Skeleton } from '../components/ui'

type Kind = 'affiche' | 'score' | 'motm'
const W = 1080
const H = 1350
const GOLD = '#E9C04A'

export default function Visuals() {
  const { profile } = useAuth()
  const q = useAsync(async () => {
    const [events, results, profiles, stats] = await Promise.all([fetchEvents(), fetchResults(), fetchProfiles(), fetchStats()])
    return { matches: events.filter((e) => e.type === 'match'), results, profiles, stats }
  }, [])
  const [kind, setKind] = useState<Kind>('affiche')
  const [matchId, setMatchId] = useState<string>('')
  if (!profile || q.loading || !q.data) return <><Skeleton h={60} /><Skeleton h={400} /></>
  const { matches, results } = q.data
  const now = Date.now()
  const upcoming = matches.filter((m) => new Date(m.starts_at).getTime() > now - 3 * 3600_000 && (m.status ?? 'scheduled') === 'scheduled')
  const played = matches.filter((m) => results.some((r) => r.event_id === m.id)).reverse()
  const options = kind === 'affiche' ? upcoming : played
  const match = options.find((m) => m.id === matchId) ?? options[0] ?? null
  return (
    <>
      <PageTitle kicker="Prêts pour Instagram et WhatsApp" title="Visuels" />
      <div className="segmented">
        {([['affiche', 'Affiche'], ['score', 'Score final'], ['motm', 'Homme du match']] as const).map(([k, l]) => <button key={k} className={`segmented__btn ${kind === k ? 'is-yes' : ''}`} style={{ fontSize: 13 }} onClick={() => { setKind(k); setMatchId('') }}>{l}</button>)}
      </div>
      {options.length === 0 ? <p className="small muted">{kind === 'affiche' ? 'Aucun match à venir.' : 'Aucun résultat enregistré.'}</p> : (
        <>
          <select className="input" value={match?.id ?? ''} onChange={(e) => setMatchId(e.target.value)}>
            {options.map((m) => <option key={m.id} value={m.id}>{m.matchday ? `${m.matchday} · ` : ''}{m.title}</option>)}
          </select>
          {match && <Poster kind={kind} match={match} data={q.data} me={profile} />}
        </>
      )}
    </>
  )
}

function Poster({ kind, match, data, me }: { kind: Kind; match: TeamEvent; data: { results: { event_id: string; goals_for: number; goals_against: number }[]; profiles: Profile[]; stats: { event_id: string; profile_id: string; goals: number }[] }; me: Profile }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const motm = useAsync(async () => (kind === 'motm' ? await fetchMotmResults(match.id) : []), [kind, match.id])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setReady(false)
      await Promise.all([document.fonts.load('italic 800 100px "Barlow Condensed"'), document.fonts.load('700 40px Inter')]).catch(() => null)
      const logo = await loadImage('/icons/icon-512.png').catch(() => null)
      if (cancelled || !ref.current) return
      const r = data.results.find((x) => x.event_id === match.id) ?? null
      const scorers = data.stats.filter((s) => s.event_id === match.id && s.goals > 0).map((s) => `${data.profiles.find((p) => p.id === s.profile_id)?.first_name ?? '?'}${s.goals > 1 ? ` ×${s.goals}` : ''}`)
      const rows = motm.data ?? []
      const winner = rows.length && rows[0].closed ? data.profiles.find((p) => p.id === rows[0].nominee_id) ?? null : null
      draw(ref.current, kind, match, r, scorers, winner, rows[0]?.votes ?? 0, rows[0]?.total ?? 0, logo)
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [kind, match, data, motm.data])

  async function exportPng(share: boolean) {
    const blob = await new Promise<Blob | null>((res) => ref.current!.toBlob(res, 'image/png'))
    if (!blob) return
    const name = `ardziv2-${kind}-${match.starts_at.slice(0, 10)}.png`
    const file = new File([blob], name, { type: 'image/png' })
    if (share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: match.title }); return } catch { /* annulé */ }
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    setMsg('Image enregistrée')
  }

  const motmPending = kind === 'motm' && motm.data && !(motm.data.length && motm.data[0].closed)
  return (
    <div className="stack stack--md">
      <canvas ref={ref} width={W} height={H} style={{ width: '100%', borderRadius: 16, border: '1px solid var(--line)', background: '#0B0B0C' }} aria-label="Aperçu du visuel" />
      {motmPending && <p className="small muted">Le vote n'est pas encore clos (48 h après le match) : le visuel affichera le gagnant dès la clôture.</p>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn--secondary btn--sm" disabled={!ready} onClick={() => exportPng(false)}>Enregistrer</button>
        <button className="btn btn--sm" disabled={!ready} onClick={() => exportPng(true)}>Partager</button>
      </div>
      {msg && <p className="small gold">{msg}</p>}
      {!isCaptainOrStaff(me) && <p className="small muted">Tout le monde peut créer et partager les visuels officiels de l'équipe.</p>}
    </div>
  )
}

const loadImage = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src })

export function draw(c: HTMLCanvasElement, kind: Kind, m: TeamEvent, r: { goals_for: number; goals_against: number } | null, scorers: string[], winner: Profile | null, votes: number, total: number, logo: HTMLImageElement | null) {
  const x = c.getContext('2d')!
  const D = (size: number) => `italic 800 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`
  const B = (size: number, w = 600) => `${w} ${size}px Inter, Arial, sans-serif`
  // Fond
  const g = x.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#17140B'); g.addColorStop(0.55, '#0B0B0C'); g.addColorStop(1, '#0B0B0C')
  x.fillStyle = g; x.fillRect(0, 0, W, H)
  // Bandes dorées
  x.save(); x.globalAlpha = 0.09; x.fillStyle = GOLD
  for (let i = -2; i < 8; i++) { x.beginPath(); x.moveTo(i * 220, 0); x.lineTo(i * 220 + 90, 0); x.lineTo(i * 220 - 410, H); x.lineTo(i * 220 - 500, H); x.fill() }
  x.restore()
  x.fillStyle = GOLD; x.fillRect(80, 80, 8, 120)
  if (logo) { x.save(); x.beginPath(); x.arc(W - 160, 140, 80, 0, Math.PI * 2); x.clip(); x.drawImage(logo, W - 240, 60, 160, 160); x.restore() }
  x.textBaseline = 'alphabetic'
  x.fillStyle = '#fff'; x.font = D(64); x.fillText('EUGA ARDZIV 2', 110, 140)
  x.fillStyle = 'rgba(255,255,255,.6)'; x.font = B(30, 600); x.fillText(`${m.competition ?? 'Départemental 2'} · poule B${m.matchday ? ` · ${m.matchday}` : ''}`, 110, 192)

  const home = m.is_home !== false
  const opp = (m.opponent ?? m.title).toUpperCase()
  const [left, right] = home ? ['ARDZIV 2', opp] : [opp, 'ARDZIV 2']
  const date = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).format(new Date(m.starts_at))
  const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(m.starts_at))
  const fit = (t: string, max: number, size: number) => { let s = size; x.font = D(s); while (x.measureText(t).width > max && s > 40) { s -= 4; x.font = D(s) } return s }

  if (kind === 'affiche') {
    x.fillStyle = GOLD; x.font = D(150); x.fillText('JOUR DE', 80, 470); x.fillText('MATCH', 80, 610)
    x.fillStyle = '#fff'; fit(left, 920, 110); x.fillText(left, 80, 800)
    x.fillStyle = GOLD; x.font = D(70); x.fillText('VS', 80, 880)
    x.fillStyle = '#fff'; fit(right, 920, 110); x.fillText(right, 80, 1000)
    x.fillStyle = GOLD; x.fillRect(80, 1080, W - 160, 4)
    x.fillStyle = '#fff'; x.font = B(44, 700); x.fillText(cap(date), 80, 1160)
    x.fillStyle = 'rgba(255,255,255,.7)'; x.font = B(36, 500); x.fillText(`${time}${m.location ? ` · ${m.location}` : ''}`, 80, 1220)
  } else if (kind === 'score' && r) {
    const res = r.goals_for > r.goals_against ? 'VICTOIRE' : r.goals_for === r.goals_against ? 'MATCH NUL' : 'DÉFAITE'
    x.fillStyle = GOLD; x.font = D(130); x.fillText(res, 80, 440)
    x.fillStyle = 'rgba(255,255,255,.6)'; x.font = B(32, 600); x.fillText('SCORE FINAL', 84, 510)
    const [a, b] = home ? [r.goals_for, r.goals_against] : [r.goals_against, r.goals_for]
    x.fillStyle = '#fff'; fit(left, 700, 80); x.fillText(left, 80, 660)
    x.fillStyle = home ? GOLD : '#fff'; x.font = D(220); x.textAlign = 'right'; x.fillText(String(a), W - 80, 700)
    x.fillStyle = '#fff'; x.textAlign = 'left'; fit(right, 700, 80); x.fillText(right, 80, 900)
    x.fillStyle = home ? '#fff' : GOLD; x.font = D(220); x.textAlign = 'right'; x.fillText(String(b), W - 80, 940); x.textAlign = 'left'
    x.fillStyle = GOLD; x.fillRect(80, 1010, W - 160, 4)
    if (scorers.length) { x.fillStyle = 'rgba(255,255,255,.6)'; x.font = B(30, 600); x.fillText('BUTEURS', 80, 1080); x.fillStyle = '#fff'; x.font = B(40, 700); wrap(x, scorers.join(' · '), 80, 1140, W - 160, 52) }
    x.fillStyle = 'rgba(255,255,255,.6)'; x.font = B(30, 500); x.fillText(cap(date), 80, 1230)
  } else if (kind === 'motm') {
    x.fillStyle = GOLD; x.font = D(120); x.fillText('HOMME', 80, 450); x.fillText('DU MATCH', 80, 570)
    if (winner) {
      x.fillStyle = '#fff'; fit(`${winner.first_name}${winner.last_name ? ` ${winner.last_name}` : ''}`.toUpperCase(), 920, 170); x.fillText(`${winner.first_name}${winner.last_name ? ` ${winner.last_name}` : ''}`.toUpperCase(), 80, 800)
      if (winner.number != null) { x.save(); x.globalAlpha = 0.12; x.fillStyle = GOLD; x.font = D(520); x.textAlign = 'right'; x.fillText(String(winner.number), W - 40, 1060); x.restore() }
      x.fillStyle = 'rgba(255,255,255,.7)'; x.font = B(36, 600); x.fillText(`Élu par ses coéquipiers · ${votes} vote${votes > 1 ? 's' : ''} sur ${total}`, 80, 880)
    } else { x.fillStyle = 'rgba(255,255,255,.6)'; x.font = B(40, 600); x.fillText('Vote en cours…', 80, 780) }
    x.fillStyle = GOLD; x.fillRect(80, 1080, W - 160, 4)
    x.fillStyle = '#fff'; x.font = B(40, 700); fit2(x, m.title, W - 160, 40); x.fillText(m.title, 80, 1160)
    if (r) { x.fillStyle = 'rgba(255,255,255,.7)'; x.font = B(34, 500); x.fillText(`Score final ${r.goals_for}-${r.goals_against} · ${date}`, 80, 1220) }
  }
  x.fillStyle = 'rgba(255,255,255,.35)'; x.font = B(24, 600); x.fillText('Depuis 1924 · Marseille', 80, H - 50)
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
function fit2(x: CanvasRenderingContext2D, t: string, max: number, size: number) { let s = size; while (x.measureText(t).width > max && s > 20) { s -= 2; x.font = `700 ${s}px Inter, Arial, sans-serif` } }
function wrap(x: CanvasRenderingContext2D, t: string, left: number, top: number, max: number, lh: number) {
  const words = t.split(' '); let line = ''; let y = top
  for (const w of words) { const test = line ? `${line} ${w}` : w; if (x.measureText(test).width > max && line) { x.fillText(line, left, y); line = w; y += lh } else line = test }
  if (line) x.fillText(line, left, y)
}
