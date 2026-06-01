import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import useAuthStore from './store/authStore'

import Layout        from './components/layout/Layout'
import ProtectedRoute from './components/layout/ProtectedRoute'

import LoginPage       from './pages/LoginPage'
import DashboardPage   from './pages/DashboardPage'
import UtilisateursPage from './pages/UtilisateursPage'
import QuartiersPage   from './pages/QuartiersPage'
import IncidentsPage   from './pages/IncidentsPage'
import VotesPage       from './pages/VotesPage'
import EvenementsPage  from './pages/EvenementsPage'
import AnnoncesPage    from './pages/AnnoncesPage'
import ContratsPage    from './pages/ContratsPage'

export default function App() {
  const { token, fetchMe } = useAuthStore()

  useEffect(() => {
    if (token) fetchMe()
  }, [token])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!token ? <LoginPage /> : <Navigate to="/dashboard" replace />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard"    element={<DashboardPage />} />
            <Route path="/utilisateurs" element={<UtilisateursPage />} />
            <Route path="/quartiers"    element={<QuartiersPage />} />
            <Route path="/incidents"    element={<IncidentsPage />} />
            <Route path="/votes"        element={<VotesPage />} />
            <Route path="/evenements"   element={<EvenementsPage />} />
            <Route path="/annonces"     element={<AnnoncesPage />} />
            <Route path="/contrats"     element={<ContratsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
