import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function Join() {
  const { refreshProfile, signOut, session } = useAuth()
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('join_team', { code: code.trim(), p_first_name: first.trim(), p_last_name: last.trim() || null })
    setBusy(false)
    if (error) {
      setError(error.message.includes('invalid_code') ? "Code d'équipe incorrect." : 'Une erreur est survenue, réessaie.')
      return
    }
    await refreshProfile()
  }

  return (
    <div className="auth">
      <div className="stack" style={{ gap: 8 }}>
        <span className="kicker">{session?.user.email}</span>
        <h1 className="display display--xl">Bienvenue dans le groupe</h1>
        <p className="text-2">Entre ton prénom et le code d'équipe qu'on t'a donné (joueur ou staff).</p>
      </div>
      <form className="form" onSubmit={submit}>
        <label className="label" htmlFor="first">Prénom</label>
        <input id="first" className="input" autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} required />
        <label className="label" htmlFor="last">Nom (facultatif)</label>
        <input id="last" className="input" autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} />
        <label className="label" htmlFor="code">Code d'équipe</label>
        <input id="code" className="input" autoCapitalize="characters" placeholder="ARDZIV2" value={code} onChange={(e) => setCode(e.target.value)} required />
        <button className="btn" disabled={busy || !first || !code}>{busy ? 'Un instant…' : 'Rejoindre'}</button>
        {error && <p className="error center">{error}</p>}
        <button type="button" className="link center" style={{ justifyContent: 'center' }} onClick={signOut}>Se déconnecter</button>
      </form>
    </div>
  )
}
