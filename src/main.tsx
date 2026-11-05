import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { AuthProvider, useAuth } from './lib/auth'
import AppShell from './components/AppShell'
import Login from './pages/Login'
import Join from './pages/Join'
import Home from './pages/Home'
import Agenda from './pages/Agenda'
import EventDetail from './pages/EventDetail'
import Group from './pages/Group'
import Stats from './pages/Stats'
import More from './pages/More'
const Members = lazy(() => import('./pages/Members'))
const TacticsLibrary = lazy(() => import('./pages/TacticsLibrary'))
const Training = lazy(() => import('./pages/Training'))
const StaffSpace = lazy(() => import('./pages/StaffSpace'))
const Cohesion = lazy(() => import('./pages/Cohesion'))
const PublicMatchPage = lazy(() => import('./pages/Public').then((m) => ({ default: m.PublicMatchPage })))
const PublicTeamPage = lazy(() => import('./pages/Public').then((m) => ({ default: m.PublicTeamPage })))
const Visuals = lazy(() => import('./pages/Visuals'))
const Funding = lazy(() => import('./pages/Funding'))
const Equipe1 = lazy(() => import('./pages/Equipe1'))
const Video = lazy(() => import('./pages/Video'))
const Feed = lazy(() => import('./pages/Feed'))
const Club = lazy(() => import('./pages/Club'))

function Gate() {
  const { session, profile, loading } = useAuth()
  if (loading) return <div className="auth"><div className="skeleton" style={{ minHeight: 200 }} /></div>
  if (!session) return <Login />
  if (!profile) return <Join />
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="evenement/:id" element={<EventDetail />} />
        <Route path="groupe" element={<Group />} />
        <Route path="stats" element={<Stats />} />
        <Route path="plus" element={<More />} />
        <Route path="membres" element={<Members />} />
        <Route path="tactique" element={<TacticsLibrary />} />
        <Route path="entrainement" element={<Training />} />
        <Route path="staff" element={<StaffSpace />} />
        <Route path="vestiaire" element={<Cohesion />} />
        <Route path="club" element={<Club />} />
        <Route path="actus" element={<Feed />} />
        <Route path="video" element={<Video />} />
        <Route path="equipe1" element={<Equipe1 />} />
        <Route path="cagnottes" element={<Funding />} />
        <Route path="visuels" element={<Visuals />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/public/match/:id" element={<Suspense fallback={null}><PublicMatchPage /></Suspense>} />
        <Route path="/public/equipe" element={<Suspense fallback={null}><PublicTeamPage /></Suspense>} />
        <Route path="*" element={<AuthProvider><Gate /></AuthProvider>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
