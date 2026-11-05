import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { disablePush, enablePush, getPushState, notify, type PushState } from '../lib/push'

/** Carte d'activation des notifications. `compact` = version ligne pour l'onglet Plus. */
export default function PushCard({ compact = false }: { compact?: boolean }) {
  const { profile } = useAuth()
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testMsg, setTestMsg] = useState<string | null>(null)

  useEffect(() => {
    getPushState().then(setState).catch(() => setState('unsupported'))
  }, [])

  if (!state || !profile) return null
  if (!compact && (state === 'enabled' || state === 'unsupported')) return null

  async function on() {
    setBusy(true)
    setError(null)
    try {
      setState(await enablePush(profile!.id))
    } catch {
      setError("L'activation a échoué. Réessaie dans un instant.")
    } finally {
      setBusy(false)
    }
  }
  async function test() {
    setTestMsg('Envoi…')
    const r = await notify('test')
    setTestMsg(r && r.sent > 0 ? 'Envoyée, regarde ton écran' : "Pas d'envoi : la fonction Supabase n'est pas encore prête")
    setTimeout(() => setTestMsg(null), 4000)
  }
  async function off() {
    setBusy(true)
    await disablePush()
    setState('default')
    setBusy(false)
  }

  const text: Record<PushState, string> = {
    'needs-install': "Sur iPhone, ajoute d'abord l'app à l'écran d'accueil (Partager → Sur l'écran d'accueil), puis ouvre-la depuis l'icône.",
    unsupported: 'Ce navigateur ne gère pas les notifications.',
    denied: 'Les notifications sont bloquées. Autorise-les dans les réglages du téléphone pour Ardziv 2.',
    default: 'Convocation publiée, rappel de dispo, résultat : sois prévenu sans ouvrir WhatsApp.',
    enabled: 'Tu reçois les convocations, les rappels et les résultats.',
  }

  return (
    <section className={compact ? 'stack stack--md' : 'card'} style={compact ? undefined : { gap: 12, borderColor: 'rgba(233,192,74,.35)' }}>
      <div className="stack" style={{ gap: 4 }}>
        <span className="eyebrow" style={{ color: state === 'enabled' ? 'var(--gold)' : undefined }}>
          Notifications {state === 'enabled' ? '· activées' : ''}
        </span>
        <p className="small text-2" style={{ lineHeight: 1.45 }}>{text[state]}</p>
      </div>
      {state === 'default' && <button className="btn btn--sm" disabled={busy} onClick={on}>{busy ? 'Activation…' : 'Activer les notifications'}</button>}
      {state === 'enabled' && compact && (
        <>
          <button className="btn btn--sm" disabled={busy} onClick={test}>{testMsg ?? "M'envoyer une notification de test"}</button>
          <button className="btn btn--sm btn--secondary" disabled={busy} onClick={off}>Désactiver sur cet appareil</button>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  )
}
