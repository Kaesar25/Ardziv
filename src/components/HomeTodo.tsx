import { Link } from 'react-router-dom'
import { useAsync } from '../lib/useAsync'
import { fetchEvents } from '../lib/data'
import { euros, fetchDuties, fetchFines, fetchMyMotmVote, fetchPollVotes, fetchPolls, motmOpen, weekStart } from '../lib/data2'
import { isPlayer, type Profile } from '../lib/types'
import { IconArrow } from './Icons'

interface Item { to: string; title: string; sub: string; hot?: boolean }

/** « À faire » sur l'accueil : jour J, vote homme du match, sondages, tâche de la semaine, amendes. */
export default function HomeTodo({ me }: { me: Profile }) {
  const q = useAsync(async () => {
    const now = Date.now()
    const recent = await fetchEvents(new Date(now - 3 * 86_400_000).toISOString(), new Date(now + 86_400_000).toISOString())
    const [polls, duties, fines] = await Promise.all([fetchPolls(), fetchDuties(weekStart()), fetchFines()])
    const openPolls = polls.filter((p) => !p.closes_at || new Date(p.closes_at).getTime() > now)
    const votes = await fetchPollVotes(openPolls.map((p) => p.id))
    const voteMatch = recent.filter((e) => e.type === 'match' && motmOpen(e.starts_at)).pop() ?? null
    const myMotm = voteMatch ? await fetchMyMotmVote(voteMatch.id, me.id) : null
    const today = recent.find((e) => e.type === 'match' && (e.status ?? 'scheduled') === 'scheduled' && Math.abs(new Date(e.starts_at).getTime() - now) < 14 * 3600_000) ?? null
    return { openPolls, votes, duties, fines, voteMatch, myMotm, today }
  }, [me.id])

  if (q.loading || !q.data) return null
  const { openPolls, votes, duties, fines, voteMatch, myMotm, today } = q.data
  const items: Item[] = []

  if (today) items.push({ to: `/evenement/${today.id}?onglet=jourj`, title: "C'est jour de match", sub: `${today.title} · déroulé, checklist et score en direct`, hot: true })
  if (voteMatch && isPlayer(me) && !myMotm) items.push({ to: `/evenement/${voteMatch.id}?onglet=vote`, title: 'Vote pour l’homme du match', sub: `${voteMatch.title} · vote secret`, hot: true })
  const unanswered = openPolls.filter((p) => !votes.some((v) => v.poll_id === p.id && v.profile_id === me.id))
  if (unanswered.length) items.push({ to: '/groupe?onglet=sondages', title: unanswered.length === 1 ? 'Un sondage attend ta réponse' : `${unanswered.length} sondages attendent ta réponse`, sub: unanswered[0].question })
  const myDuty = duties.filter((d) => d.profile_id === me.id && d.week_start === weekStart() && !d.done)
  if (myDuty.length) items.push({ to: '/groupe?onglet=taches', title: 'Ta tâche de la semaine', sub: myDuty.map((d) => d.label).join(', ') })
  const due = fines.filter((f) => f.profile_id === me.id && !f.paid).reduce((a, f) => a + f.amount, 0)
  if (due > 0) items.push({ to: '/groupe?onglet=caisse', title: `${euros(due)} à régler à la caisse`, sub: 'Amendes et cotisations en attente' })

  if (!items.length) return null
  return (
    <section className="stack stack--md">
      <h2 className="h2">À faire</h2>
      {items.map((it) => (
        <Link key={it.to + it.title} to={it.to} className="card card--sm row" style={{ color: 'inherit', gap: 12, borderColor: it.hot ? 'rgba(233,192,74,.45)' : undefined, padding: 14 }}>
          <div className="stack" style={{ gap: 2, flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 700, color: it.hot ? 'var(--gold)' : 'var(--text)' }}>{it.title}</span>
            <span className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.sub}</span>
          </div>
          <IconArrow stroke={it.hot ? 'var(--gold)' : 'var(--muted)'} />
        </Link>
      ))}
    </section>
  )
}
