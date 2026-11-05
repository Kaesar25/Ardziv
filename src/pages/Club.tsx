import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'
import { supabase } from '../lib/supabase'
import { fetchAvailabilities, fetchEvents, fetchProfiles, fetchResults, fetchStats } from '../lib/data'
import { fetchMotmSeason } from '../lib/data2'
import { fetchQuizScores, saveQuizScore } from '../lib/data4'
import { isPlayer, type Profile } from '../lib/types'
import { PageTitle, Skeleton } from '../components/ui'

type Tab = 'histoire' | 'quiz' | 'saison'
const TABS: [Tab, string][] = [['histoire', 'Histoire'], ['quiz', 'Quiz'], ['saison', 'Ma saison']]

export default function Club() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.some(([k]) => k === params.get('onglet')) ? params.get('onglet') : 'histoire') as Tab
  if (!profile) return null
  return (
    <>
      <PageTitle kicker="Depuis 1924" title="Le club" />
      <div className="segmented">
        {TABS.map(([k, l]) => <button key={k} className={`segmented__btn ${tab === k ? 'is-yes' : ''}`} onClick={() => setParams(k === 'histoire' ? {} : { onglet: k }, { replace: true })}>{l}</button>)}
      </div>
      {tab === 'histoire' && <History />}
      {tab === 'quiz' && <Quiz me={profile} />}
      {tab === 'saison' && <Wrapped me={profile} />}
    </>
  )
}

// ====================== Histoire ======================
const TIMELINE: { year: string; title: string; text: string }[] = [
  { year: '1924', title: 'Naissance au camp Oddo', text: "Des réfugiés arméniens rescapés du génocide arrivent à Marseille. Au camp Oddo, qui accueille jusqu'à 5 500 personnes entre 1922 et 1927, ils fondent l'Union Générale Arménienne de Scoutisme et de Culture Physique : l'UGA." },
  { year: '1964', title: 'UGA + Ardziv', text: "L'UGA et l'AS Ardziv fusionnent et deviennent l'Entente UGA Ardziv. « Ardziv » veut dire « aigle » en arménien." },
  { year: 'Sévan', title: 'La maison du club', text: "Le club joue au stade Sévan, du nom du grand lac d'Arménie. Aujourd'hui encore, c'est l'un des repères de la communauté arménienne de Marseille." },
  { year: '2011-2013', title: 'Dans le haut de la DH', text: 'Deux saisons de suite, l’équipe première termine 5e de Division d’Honneur, le plus haut niveau régional de l’époque.' },
  { year: '2019', title: 'Première montée en National 3', text: 'Ardziv accède au niveau national pour la première fois, en N3.' },
  { year: '2022', title: 'Retour en N3', text: 'Après une 2e place en Régional 1 (58 points), le club retrouve le National 3. Gaël Andonian, ancien de l’OM et international arménien (23 sélections), porte le maillot d’Ardziv à partir de 2022.' },
  { year: '2025', title: 'Retour en Régional 1', text: "L'équipe première redescend en R1, où elle joue en 2026-2027. L'équipe 2, la réserve, joue en Départemental 2, poule B." },
]

function History() {
  return (
    <div className="stack stack--lg">
      <section className="card" style={{ gap: 10, borderColor: 'rgba(233,192,74,.45)' }}>
        <span className="eyebrow" style={{ color: 'var(--gold)' }}>EUGA Ardziv Marseille</span>
        <p style={{ lineHeight: 1.5 }}>Plus qu'un club : un siècle d'histoire de la communauté arménienne de Marseille, né d'un camp de réfugiés et devenu un club de niveau national. Porter ce maillot, c'est porter cette histoire.</p>
      </section>
      <div className="stack" style={{ gap: 0 }}>
        {TIMELINE.map((t, i) => (
          <div key={t.year} style={{ display: 'grid', gridTemplateColumns: '78px 18px minmax(0,1fr)', gap: 10 }}>
            <span className="gold" style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: t.year.length > 4 ? 15 : 20, textAlign: 'right', paddingTop: 2 }}>{t.year}</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ width: 12, height: 12, borderRadius: 99, background: 'var(--gold)', marginTop: 6, flexShrink: 0 }} />
              {i < TIMELINE.length - 1 && <span style={{ flex: 1, width: 2, background: 'var(--line-strong)' }} />}
            </div>
            <div className="stack" style={{ gap: 4, paddingBottom: 22 }}>
              <span style={{ fontWeight: 700 }}>{t.title}</span>
              <span className="small text-2" style={{ lineHeight: 1.5 }}>{t.text}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="small muted">Sources : Stat Football Club France, Armenian Diaspora Survey (Marseille), Wikipédia. Une date à corriger ou un souvenir à ajouter ? Dépose-le dans la boîte à idées.</p>
    </div>
  )
}

// ====================== Quiz ======================
interface Q { q: string; options: string[]; answer: number; why: string }
const QUESTIONS: Q[] = [
  { q: 'En quelle année est née l’UGA, ancêtre du club ?', options: ['1915', '1924', '1946', '1964'], answer: 1, why: 'L’UGA est fondée en 1924 par des réfugiés arméniens à Marseille.' },
  { q: 'Où l’UGA a-t-elle été créée ?', options: ['Au camp Oddo', 'Au Vélodrome', 'À Beaumont', 'Au Vieux-Port'], answer: 0, why: 'Le camp Oddo accueillait les réfugiés arméniens entre 1922 et 1927.' },
  { q: 'Que veut dire « Ardziv » en arménien ?', options: ['Lion', 'Montagne', 'Aigle', 'Étoile'], answer: 2, why: 'Ardziv (Արծիվ) signifie « aigle ».' },
  { q: 'En quelle année l’UGA et l’AS Ardziv ont-elles fusionné ?', options: ['1924', '1958', '1964', '1982'], answer: 2, why: 'La fusion de 1964 donne l’Entente UGA Ardziv, l’EUGA Ardziv.' },
  { q: 'D’où vient le nom du stade Sévan ?', options: ['D’un joueur', 'D’un lac d’Arménie', 'D’une rue de Marseille', 'D’une ville de France'], answer: 1, why: 'Le lac Sevan est le plus grand lac d’Arménie.' },
  { q: 'En quelle année l’équipe première monte-t-elle pour la première fois en National 3 ?', options: ['2015', '2019', '2022', '2024'], answer: 1, why: 'Première accession au niveau national en 2019.' },
  { q: 'Quel classement a permis de remonter en N3 en 2022 ?', options: ['1er de R1', '2e de R1', '3e de R1', 'Barrage'], answer: 1, why: '2e de Régional 1 en 2021-2022, avec 58 points.' },
  { q: 'Quel ancien joueur de l’OM et international arménien a porté le maillot d’Ardziv ?', options: ['Gaël Andonian', 'Youri Djorkaeff', 'Alain Boghossian', 'Henrikh Mkhitaryan'], answer: 0, why: 'Gaël Andonian, 23 sélections avec l’Arménie, est passé par Ardziv à partir de 2022.' },
  { q: 'Combien de réfugiés le camp Oddo a-t-il accueilli au plus fort ?', options: ['Environ 500', 'Environ 1 500', 'Environ 5 500', 'Environ 15 000'], answer: 2, why: 'Environ 5 500 réfugiés entre 1922 et 1927.' },
  { q: 'Dans quelle division joue l’équipe 2 en 2026-2027 ?', options: ['Régional 2', 'Départemental 1', 'Départemental 2', 'Départemental 3'], answer: 2, why: 'L’équipe 2 joue en Départemental 2, poule B.' },
]

function Quiz({ me }: { me: Profile }) {
  const scores = useAsync(async () => ({ scores: await fetchQuizScores(), profiles: await fetchProfiles() }), [])
  const order = useMemo(() => [...QUESTIONS].sort(() => Math.random() - 0.5), [])
  const [i, setI] = useState(-1)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const mine = scores.data?.scores.find((s) => s.profile_id === me.id)

  if (i === -1) return (
    <div className="stack stack--lg">
      <section className="card center" style={{ gap: 12, alignItems: 'center' }}>
        <span className="eyebrow">Quiz Ardziv</span>
        <span style={{ fontWeight: 700, fontSize: 18 }}>{QUESTIONS.length} questions sur l’histoire du club</span>
        {mine && <span className="small muted">Ton meilleur score : {mine.best}/{mine.total}</span>}
        <button className="btn" onClick={() => setI(0)}>Commencer</button>
      </section>
      <Leaderboard data={scores.data} me={me} />
    </div>
  )

  if (i >= order.length) return (
    <div className="stack stack--lg">
      <section className="card center" style={{ gap: 10, alignItems: 'center' }}>
        <span className="eyebrow">Résultat</span>
        <span className="gold" style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 52 }}>{score}/{order.length}</span>
        <span className="text-2">{score === order.length ? 'Sans faute. Tu connais ton club par cœur.' : score >= 7 ? 'Très solide, un vrai aigle.' : score >= 4 ? 'Pas mal, relis l’onglet Histoire.' : 'Il est temps de découvrir ton club !'}</span>
        <button className="btn btn--sm" onClick={() => { setI(0); setScore(0); setPicked(null) }}>Rejouer</button>
      </section>
      <Leaderboard data={scores.data} me={me} />
    </div>
  )

  const q = order[i]
  return (
    <section className="card" style={{ gap: 12 }}>
      <div className="row row--between"><span className="eyebrow">Question {i + 1}/{order.length}</span><span className="small gold" style={{ fontWeight: 700 }}>{score} pt{score > 1 ? 's' : ''}</span></div>
      <div className="bar"><span style={{ width: `${(i / order.length) * 100}%`, background: 'var(--gold)' }} /></div>
      <span style={{ fontWeight: 700, fontSize: 18, lineHeight: 1.35 }}>{q.q}</span>
      {q.options.map((o, k) => {
        const state = picked == null ? '' : k === q.answer ? 'is-yes' : k === picked ? 'is-no' : ''
        return <button key={o} disabled={picked != null} className={`segmented__btn ${state}`} style={{ background: state ? undefined : 'var(--ink)', minHeight: 52, textAlign: 'left', padding: '0 16px', opacity: 1 }} onClick={() => { setPicked(k); if (k === q.answer) setScore((s) => s + 1) }}>{o}</button>
      })}
      {picked != null && (
        <>
          <span className="small text-2">{q.why}</span>
          <button className="btn btn--sm" onClick={async () => {
            const next = i + 1
            setPicked(null); setI(next)
            if (next >= order.length) { await saveQuizScore(me.id, score, order.length, mine?.best ?? null); void scores.reload() }
          }}>{i + 1 < order.length ? 'Question suivante' : 'Voir mon score'}</button>
        </>
      )}
    </section>
  )
}

function Leaderboard({ data, me }: { data: { scores: { profile_id: string; best: number; total: number }[]; profiles: Profile[] } | null; me: Profile }) {
  if (!data || !data.scores.length) return null
  return (
    <section className="stack stack--md">
      <span className="eyebrow">Classement du vestiaire</span>
      <div className="card card--list">
        {data.scores.slice(0, 10).map((s, i) => {
          const p = data.profiles.find((x) => x.id === s.profile_id)
          if (!p) return null
          return (
            <div key={s.profile_id} className="listrow">
              <span className="gold" style={{ fontWeight: 800, textAlign: 'center' }}>{i + 1}</span>
              <span style={{ fontWeight: 600, color: p.id === me.id ? 'var(--gold)' : undefined }}>{p.first_name}</span>
              <span style={{ fontWeight: 700 }}>{s.best}/{s.total}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ====================== Ardziv Wrapped ======================
function Wrapped({ me }: { me: Profile }) {
  const q = useAsync(async () => {
    const seasonStart = new Date(new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1, 6, 1).toISOString()
    const now = new Date().toISOString()
    const [events, results, stats, motm, profiles, squads] = await Promise.all([
      fetchEvents(seasonStart, now), fetchResults(), fetchStats(), fetchMotmSeason(), fetchProfiles(),
      supabase.from('squad_players').select('event_id').eq('profile_id', me.id),
    ])
    const trainings = events.filter((e) => e.type === 'training' && (e.status ?? 'scheduled') === 'scheduled')
    const avail = await fetchAvailabilities(trainings.map((e) => e.id))
    return { events, results, stats, motm, profiles, squadIds: ((squads.data ?? []) as { event_id: string }[]).map((s) => s.event_id), trainings, avail }
  }, [me.id])
  const [slide, setSlide] = useState(0)
  if (q.loading || !q.data) return <Skeleton h={360} />
  const d = q.data
  const matchIds = new Set(d.events.filter((e) => e.type === 'match').map((e) => e.id))
  const played = d.results.filter((r) => matchIds.has(r.event_id))
  const w = played.filter((r) => r.goals_for > r.goals_against).length
  const dr = played.filter((r) => r.goals_for === r.goals_against).length
  const gf = played.reduce((a, r) => a + r.goals_for, 0)
  const myStats = d.stats.filter((s) => s.profile_id === me.id && matchIds.has(s.event_id))
  const goals = myStats.reduce((a, s) => a + s.goals, 0)
  const assists = myStats.reduce((a, s) => a + s.assists, 0)
  const apps = myStats.filter((s) => s.played).length || d.squadIds.filter((id) => matchIds.has(id) && played.some((r) => r.event_id === id)).length
  const motmWins = d.motm.find((m) => m.profile_id === me.id)?.wins ?? 0
  const present = d.avail.filter((a) => a.profile_id === me.id && a.status === 'yes').length
  const byGoals: Record<string, number> = {}
  d.stats.filter((s) => matchIds.has(s.event_id)).forEach((s) => { byGoals[s.profile_id] = (byGoals[s.profile_id] ?? 0) + s.goals })
  const top = Object.entries(byGoals).sort((a, b) => b[1] - a[1])[0]
  const topName = top && top[1] > 0 ? d.profiles.find((p) => p.id === top[0])?.first_name : null
  const rank = Object.entries(byGoals).sort((a, b) => b[1] - a[1]).findIndex(([id]) => id === me.id) + 1

  const slides: { k: string; big: string; title: string; sub: string }[] = [
    { k: 'intro', big: 'Ta saison', title: `${me.first_name}, voici ton Ardziv Wrapped`, sub: 'Tout ce que tu as donné pour l’équipe 2 depuis juillet.' },
    { k: 'team', big: `${w}V ${dr}N ${played.length - w - dr}D`, title: `${played.length} matchs, ${gf} buts marqués`, sub: 'Le bilan collectif de l’équipe 2 cette saison.' },
  ]
  if (isPlayer(me)) {
    slides.push({ k: 'apps', big: String(apps), title: apps > 1 ? 'matchs joués' : 'match joué', sub: d.squadIds.length ? `${d.squadIds.filter((id) => matchIds.has(id)).length} convocations reçues.` : 'Les convocations apparaîtront ici.' })
    slides.push({ k: 'goals', big: `${goals} + ${assists}`, title: 'buts et passes décisives', sub: goals > 0 && rank > 0 ? `${rank === 1 ? 'Meilleur buteur de l’équipe' : `${rank}e buteur de l’équipe`}.` : topName ? `Meilleur buteur de l’équipe : ${topName} (${top![1]}).` : 'Les feuilles de match rempliront ce compteur.' })
    slides.push({ k: 'train', big: d.trainings.length ? `${Math.round((present / d.trainings.length) * 100)} %` : '—', title: 'de présence à l’entraînement', sub: `${present} séance${present > 1 ? 's' : ''} sur ${d.trainings.length}.` })
    slides.push({ k: 'motm', big: String(motmWins), title: motmWins > 1 ? 'fois homme du match' : 'fois homme du match', sub: motmWins ? 'Élu par tes coéquipiers.' : 'Le vote de tes coéquipiers t’attend.' })
  }
  slides.push({ k: 'end', big: 'Ardziv', title: 'Merci pour cette saison', sub: 'Un aigle ne vole jamais seul. Rendez-vous au prochain match.' })
  const s = slides[Math.min(slide, slides.length - 1)]

  return (
    <div className="stack stack--md">
      <div className="row" style={{ gap: 4 }}>{slides.map((x, i) => <span key={x.k} style={{ flex: 1, height: 3, borderRadius: 9, background: i <= slide ? 'var(--gold)' : 'var(--surface-2)' }} />)}</div>
      <button onClick={() => setSlide((v) => (v + 1) % slides.length)} className="card" aria-label="Diapositive suivante"
        style={{ minHeight: 420, justifyContent: 'center', alignItems: 'flex-start', textAlign: 'left', gap: 14, background: slide % 2 ? 'linear-gradient(160deg,#1c1608,#0B0B0C 70%)' : 'linear-gradient(160deg,#141416,#0B0B0C)', borderColor: 'rgba(233,192,74,.4)', color: 'inherit' }}>
        <span className="eyebrow" style={{ color: 'var(--gold)' }}>Ardziv Wrapped · {slide + 1}/{slides.length}</span>
        <span className="gold" style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: s.big.length > 8 ? 46 : 76, lineHeight: 1, letterSpacing: '-0.01em' }}>{s.big}</span>
        <span style={{ fontWeight: 700, fontSize: 22, lineHeight: 1.2 }}>{s.title}</span>
        <span className="text-2" style={{ lineHeight: 1.45 }}>{s.sub}</span>
        <span className="small muted" style={{ marginTop: 'auto' }}>Touche pour continuer</span>
      </button>
      <p className="small muted center">Le Wrapped se met à jour au fil des matchs. La version finale sort en fin de saison.</p>
    </div>
  )
}
