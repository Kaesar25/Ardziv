import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'
import { fetchProfiles } from '../lib/data'
import { createPost, deletePost, fetchPosts, toggleLike, type Post } from '../lib/data4'
import { timeAgo } from '../lib/format'
import { isStaff, type Profile } from '../lib/types'
import { Avatar, PageTitle, Skeleton } from '../components/ui'

type Tab = 'fil' | 'galerie'

export default function Feed() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('onglet') === 'galerie' ? 'galerie' : 'fil'
  const q = useAsync(async () => ({ ...(await fetchPosts()), profiles: await fetchProfiles() }), [])
  const [zoom, setZoom] = useState<string | null>(null)
  if (!profile) return null
  return (
    <>
      <PageTitle kicker="La vie de l'équipe" title="Actus" />
      <div className="segmented" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button className={`segmented__btn ${tab === 'fil' ? 'is-yes' : ''}`} onClick={() => setParams({}, { replace: true })}>Fil</button>
        <button className={`segmented__btn ${tab === 'galerie' ? 'is-yes' : ''}`} onClick={() => setParams({ onglet: 'galerie' }, { replace: true })}>Galerie</button>
      </div>
      {tab === 'fil' && <Composer me={profile} onDone={() => void q.reload()} />}
      {q.loading || !q.data ? <Skeleton h={240} /> : tab === 'fil' ? (
        q.data.posts.length === 0 ? <p className="small muted center">Rien pour l'instant. Partage la première photo de l'équipe !</p> :
          q.data.posts.map((p) => <PostCard key={p.id} post={p} me={profile} profiles={q.data!.profiles} urls={q.data!.urls} likes={q.data!.likes.filter((l) => l.post_id === p.id).map((l) => l.profile_id)} onZoom={setZoom} onChange={() => void q.reload()} />)
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 4 }}>
          {q.data.posts.flatMap((p) => p.photos).map((path) => q.data!.urls[path] && (
            <button key={path} onClick={() => setZoom(q.data!.urls[path])} style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: 'var(--surface-2)' }} aria-label="Agrandir la photo">
              <img src={q.data!.urls[path]} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </button>
          ))}
          {!q.data.posts.some((p) => p.photos.length) && <p className="small muted" style={{ gridColumn: '1 / -1' }}>Aucune photo pour l'instant.</p>}
        </div>
      )}
      {zoom && (
        <button className="sheet-backdrop" style={{ justifyContent: 'center', alignItems: 'center', padding: 12 }} onClick={() => setZoom(null)} aria-label="Fermer">
          <img src={zoom} alt="" style={{ maxWidth: '100%', maxHeight: '90dvh', borderRadius: 12 }} />
        </button>
      )}
    </>
  )
}

function Composer({ me, onDone }: { me: Profile; onDone: () => void }) {
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  return (
    <section className="card" style={{ gap: 10 }}>
      <textarea className="input" rows={2} style={{ padding: 12, minHeight: 64 }} placeholder="Une photo, un mot pour le groupe…" value={body} onChange={(e) => setBody(e.target.value)} />
      {files.length > 0 && (
        <div className="scroll-x">
          {files.map((f, i) => (
            <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
              <img src={URL.createObjectURL(f)} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10 }} />
              <button aria-label="Retirer" onClick={() => setFiles((fs) => fs.filter((_, k) => k !== i))} style={{ position: 'absolute', top: 2, right: 2, width: 22, height: 22, borderRadius: 99, background: 'rgba(0,0,0,.7)', color: '#fff', fontSize: 12 }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { setFiles((fs) => [...fs, ...Array.from(e.target.files ?? [])].slice(0, 6)); e.target.value = '' }} />
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn--secondary btn--sm" onClick={() => input.current?.click()}>Photos</button>
        <button className="btn btn--sm" disabled={busy || (!body.trim() && !files.length)} onClick={async () => {
          setBusy(true); setError(null)
          try { await createPost(me.id, body.trim(), files, null); setBody(''); setFiles([]); onDone() } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') } finally { setBusy(false) }
        }}>{busy ? 'Envoi…' : 'Publier'}</button>
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  )
}

function PostCard({ post, me, profiles, urls, likes, onZoom, onChange }: { post: Post; me: Profile; profiles: Profile[]; urls: Record<string, string>; likes: string[]; onZoom: (u: string) => void; onChange: () => void }) {
  const author = profiles.find((p) => p.id === post.author_id)
  const liked = likes.includes(me.id)
  const canDelete = post.author_id === me.id || isStaff(me)
  const names = likes.map((id) => profiles.find((p) => p.id === id)?.first_name).filter(Boolean)
  return (
    <section className="card card--sm" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 10 }}>
        {author && <Avatar p={author} me={author.id === me.id} />}
        <div className="stack" style={{ gap: 0, flex: 1 }}><span style={{ fontWeight: 600 }}>{author?.first_name ?? 'Ancien membre'}</span><span className="small muted">{timeAgo(post.created_at)}</span></div>
        {canDelete && <button className="small muted" onClick={async () => { if (confirm('Supprimer cette publication ?')) { await deletePost(post); onChange() } }}>Supprimer</button>}
      </div>
      {post.body && <p style={{ lineHeight: 1.45, whiteSpace: 'pre-line' }}>{post.body}</p>}
      {post.photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: post.photos.length === 1 ? '1fr' : '1fr 1fr', gap: 4 }}>
          {post.photos.map((path) => urls[path] && (
            <button key={path} onClick={() => onZoom(urls[path])} style={{ borderRadius: 10, overflow: 'hidden', aspectRatio: post.photos.length === 1 ? undefined : '1' }} aria-label="Agrandir">
              <img src={urls[path]} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', maxHeight: 420 }} />
            </button>
          ))}
        </div>
      )}
      <div className="row" style={{ gap: 10 }}>
        <button className={`chip chip--ghost ${liked ? 'is-active' : ''}`} style={{ minHeight: 34, padding: '0 12px' }} onClick={async () => { await toggleLike(post.id, me.id, !liked); onChange() }}>Bravo{likes.length ? ` · ${likes.length}` : ''}</button>
        {names.length > 0 && <span className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{names.slice(0, 3).join(', ')}{names.length > 3 ? ` et ${names.length - 3} autres` : ''}</span>}
      </div>
    </section>
  )
}
