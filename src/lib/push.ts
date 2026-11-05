import { supabase } from './supabase'

// Clé publique VAPID : elle est faite pour être dans l'app (la clé privée reste dans Supabase).
export const VAPID_PUBLIC_KEY = 'BHxyJs1i8XN3SR0LdOeovnY5qdbNegcteXggN3D0FBvLhhcFadayoOm6DG7rM5OiOLt35CPJinFvmF4GaUYFf3Q'

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'default' | 'enabled'

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function getPushState(): Promise<PushState> {
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub && Notification.permission === 'granted') return 'enabled'
  return 'default'
}

export async function enablePush(profileId: string): Promise<PushState> {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'default'
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) })
  }
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error } = await supabase.from('push_subscriptions').upsert(
    { endpoint: json.endpoint, profile_id: profileId, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent.slice(0, 200) },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
  return 'enabled'
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export type NotifyKind = 'test' | 'squad_published' | 'remind' | 'event_created' | 'result' | 'announcement'

/** Demande à la fonction Supabase d'envoyer les notifications. N'échoue jamais côté app. */
export async function notify(kind: NotifyKind, eventId?: string): Promise<{ sent: number } | null> {
  try {
    const { data, error } = await supabase.functions.invoke('notify', { body: { kind, event_id: eventId } })
    if (error) return null
    return data as { sent: number }
  } catch {
    return null
  }
}
