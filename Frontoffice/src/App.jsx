import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import useAuthStore from './store/authStore'
import useSocketStore from './store/socketStore'

import Layout from './components/layout/Layout'
import ProtectedRoute from './components/layout/ProtectedRoute'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import AnnoncesPage from './pages/AnnoncesPage'
import AnnonceDetailPage from './pages/AnnonceDetailPage'
import EvenementsPage from './pages/EvenementsPage'
import EvenementDetailPage from './pages/EvenementDetailPage'
import VotesPage from './pages/VotesPage'
import MessagesPage from './pages/MessagesPage'
import ConversationPage from './pages/ConversationPage'
import ContratsPage from './pages/ContratsPage'
import IncidentsPage from './pages/IncidentsPage'
import ProfilPage from './pages/ProfilPage'
import CartePage from './pages/CartePage'

const ContratDetailPage = lazy(() => import('./pages/ContratDetailPage'))

export default function App() {
  const { token, fetchMe } = useAuthStore()
  const { connect, disconnect } = useSocketStore()

  useEffect(() => {
    if (token) {
      fetchMe()
      connect(token)
    } else {
      disconnect()
    }
    return () => { if (!token) disconnect() }
  }, [token])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={!token ? <LoginPage />    : <Navigate to="/dashboard" replace />} />
        <Route path="/register" element={!token ? <RegisterPage /> : <Navigate to="/dashboard" replace />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard"     element={<DashboardPage />} />
            <Route path="/carte"         element={<CartePage />} />
            <Route path="/annonces"      element={<AnnoncesPage />} />
            <Route path="/annonces/:id"  element={<AnnonceDetailPage />} />
            <Route path="/evenements"    element={<EvenementsPage />} />
            <Route path="/evenements/:id" element={<EvenementDetailPage />} />
            <Route path="/votes"         element={<VotesPage />} />
            <Route path="/messages"      element={<MessagesPage />} />
            <Route path="/messages/:id"  element={<ConversationPage />} />
            <Route path="/contrats"      element={<ContratsPage />} />
            <Route path="/contrats/:id"  element={
              <Suspense fallback={<div className="p-8 text-center text-gray-400">Chargement…</div>}>
                <ContratDetailPage />
              </Suspense>
            } />
            <Route path="/incidents"     element={<IncidentsPage />} />
            <Route path="/profil"        element={<ProfilPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
