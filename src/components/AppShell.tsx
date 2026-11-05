import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { roleLabel } from '../lib/types'
import { Avatar } from './ui'
import { IconCalendar, IconChart, IconGrid, IconHome, IconUsers } from './Icons'

const NAV = [
  { to: '/', label: 'Accueil', Icon: IconHome, end: true },
  { to: '/agenda', label: 'Agenda', Icon: IconCalendar },
  { to: '/groupe', label: 'Groupe', Icon: IconUsers },
  { to: '/stats', label: 'Stats', Icon: IconChart },
  { to: '/plus', label: 'Plus', Icon: IconGrid },
]

export default function AppShell() {
  const { profile } = useAuth()
  return (
    <div className="shell">
      <header className="shell__header">
        <div className="row" style={{ gap: 10 }}>
          <img src="/icons/icon-192.png" alt="" width={34} height={34} style={{ borderRadius: 9 }} />
          <div className="stack" style={{ gap: 2 }}>
            <span className="display" style={{ fontSize: 20, letterSpacing: '0.01em' }}>
              Ardziv <span className="gold">2</span>
            </span>
            <span className="kicker" style={{ fontSize: 11 }}>Départemental 2 · poule B</span>
          </div>
        </div>
        {profile && (
          <NavLink to="/plus" className="row" style={{ gap: 8, minHeight: 44 }} aria-label="Mon profil">
            <div className="stack" style={{ alignItems: 'flex-end', gap: 0, lineHeight: 1.15 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{profile.first_name}</span>
              <span className="gold" style={{ fontSize: 11, fontWeight: 600 }}>{roleLabel(profile)}</span>
            </div>
            <Avatar p={profile} me lg />
          </NavLink>
        )}
      </header>
      <main className="shell__main">
        <Suspense fallback={<div className="skeleton" style={{ minHeight: 240 }} />}>
          <Outlet />
        </Suspense>
      </main>
      <nav className="shell__nav">
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav__item ${isActive ? 'is-active' : ''}`} aria-label={label}>
            {({ isActive }) => (
              <>
                <Icon fill={isActive && to === '/' ? 'var(--gold-soft)' : 'none'} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
