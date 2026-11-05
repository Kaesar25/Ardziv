import { StrictMode } from 'react'
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
