import { Link } from 'react-router-dom'
import { useAsync } from '../lib/useAsync'
import { fetchPosts } from '../lib/data4'
import { timeAgo } from '../lib/format'
import { isGuest, type Profile } from '../lib/types'
import { IconArrow } from './Icons'

/** Accueil : accès coach équipe 1 et dernière actu de l'équipe. */
export default function HomeExtras({ me, profiles }: { me: Profile; profiles: Profile[] }) {
  const q = useAsync(() => fetchPosts(1).catch(() => null), [])
  const post = q.data?.posts[0]
  const author = post ? profiles.find((p) => p.id === post.author_id) : null
  const photo = post?.photos[0] ? q.data!.urls[post.photos[0]] : null
  return (
    <>
      {isGuest(me) && (
        <Link to="/equipe1" className="card row" style={{ color: 'inherit', borderColor: 'rgba(233,192,74,.45)' }}>
          <div className="stack" style={{ gap: 2, flex: 1 }}>
            <span style={{ fontWeight: 700, color: 'var(--gold)' }}>Forme des joueurs de l'équipe 2</span>
            <span className="small muted">Buts, présence, hommes du match, montées et descentes</span>
          </div>
          <IconArrow stroke="var(--gold)" />
        </Link>
      )}
      {post && (
        <section className="stack stack--md">
          <div className="row row--between"><h2 className="h2">Actus</h2><Link to="/actus" className="small gold" style={{ fontWeight: 600 }}>Tout voir</Link></div>
          <Link to="/actus" className="card card--sm" style={{ color: 'inherit', display: 'grid', gridTemplateColumns: photo ? '72px minmax(0,1fr)' : 'minmax(0,1fr)', gap: 12, alignItems: 'center' }}>
            {photo && <img src={photo} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 12 }} />}
            <div className="stack" style={{ gap: 2, minWidth: 0 }}>
              <span className="small muted">{author?.first_name ?? ''} · {timeAgo(post.created_at)}</span>
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{post.body || 'Nouvelle photo'}</span>
            </div>
          </Link>
        </section>
      )}
    </>
  )
}
