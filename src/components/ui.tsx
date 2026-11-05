import type { ReactNode } from 'react'
import { initials } from '../lib/format'
import type { Availability, Profile } from '../lib/types'

export function Avatar({ p, me = false, lg = false, staff = false }: { p: Pick<Profile, 'first_name' | 'last_name'>; me?: boolean; lg?: boolean; staff?: boolean }) {
  const cls = ['avatar', lg && 'avatar--lg', me && 'avatar--me', staff && 'avatar--staff'].filter(Boolean).join(' ')
  return <div className={cls}>{initials(p.first_name, p.last_name)}</div>
}

export function Chip({ children, tone = 'default', active = false }: { children: ReactNode; tone?: 'default' | 'gold' | 'red' | 'ghost'; active?: boolean }) {
  const cls = ['chip', tone !== 'default' && `chip--${tone}`, active && 'is-active'].filter(Boolean).join(' ')
  return <span className={cls}>{children}</span>
}

export function PageTitle({ kicker, title, right }: { kicker?: string; title: string; right?: ReactNode }) {
  return (
    <div className="row row--between" style={{ alignItems: 'flex-end' }}>
      <div className="stack">
        {kicker && <span className="kicker">{kicker}</span>}
        <h1 className="display display--xl">{title}</h1>
      </div>
      {right}
    </div>
  )
}

export function Segmented({ value, onChange, disabled = false }: { value: Availability | null; onChange: (v: Availability) => void; disabled?: boolean }) {
  const opts: { k: Availability; l: string }[] = [
    { k: 'yes', l: 'Présent' },
    { k: 'maybe', l: 'Incertain' },
    { k: 'no', l: 'Absent' },
  ]
  return (
    <div className="segmented" role="radiogroup" aria-label="Ta disponibilité">
      {opts.map((o) => (
        <button
          key={o.k}
          role="radio"
          aria-checked={value === o.k}
          disabled={disabled}
          className={`segmented__btn ${value === o.k ? `is-${o.k}` : ''}`}
          onClick={() => onChange(o.k)}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}

export const STATUS_META: Record<Availability | 'none', { label: string; color: string }> = {
  yes: { label: 'Présent', color: 'var(--gold)' },
  maybe: { label: 'Incertain', color: 'var(--text-2)' },
  no: { label: 'Absent', color: 'var(--red)' },
  none: { label: 'Sans réponse', color: 'var(--muted-2)' },
}

export function Status({ s }: { s: Availability | null | undefined }) {
  const m = STATUS_META[s ?? 'none']
  return <span className="status" style={{ color: m.color }}>{m.label}</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card card--sm center muted small">{children}</div>
}

export function Skeleton({ h = 120 }: { h?: number }) {
  return <div className="skeleton" style={{ minHeight: h }} />
}
