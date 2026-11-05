import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
    setBusy(false)
    if (error) return setError("Impossible d'envoyer le code. Vérifie l'adresse.")
    setStep('code')
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setError('Code incorrect ou expiré.')
  }

  return (
    <div className="auth">
      <div className="stack" style={{ alignItems: 'center', gap: 14 }}>
        <img src="/icons/icon-192.png" alt="Écusson EUGA Ardziv" width={84} height={84} style={{ borderRadius: 20 }} />
        <h1 className="display display--xl center">EUGA Ardziv <span className="gold">2</span></h1>
        <p className="text-2 center">L'app de l'équipe réserve.</p>
      </div>

      {step === 'email' ? (
        <form className="form" onSubmit={sendCode}>
          <label className="label" htmlFor="email">Ton adresse e-mail</label>
          <input id="email" className="input" type="email" inputMode="email" autoComplete="email" placeholder="prenom@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button className="btn" disabled={busy || !email}>{busy ? 'Envoi…' : 'Recevoir mon code'}</button>
          <p className="small muted center">Tu recevras un code à 6 chiffres par e-mail. Pas de mot de passe à retenir.</p>
          {error && <p className="error center">{error}</p>}
        </form>
      ) : (
        <form className="form" onSubmit={verify}>
          <label className="label" htmlFor="code">Code reçu sur {email}</label>
          <input id="code" className="input" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} required style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: 22, fontWeight: 700 }} />
          <button className="btn" disabled={busy || code.length < 6}>{busy ? 'Vérification…' : 'Entrer'}</button>
          <button type="button" className="link center" style={{ justifyContent: 'center' }} onClick={() => setStep('email')}>Changer d'adresse</button>
          {error && <p className="error center">{error}</p>}
        </form>
      )}
    </div>
  )
}
