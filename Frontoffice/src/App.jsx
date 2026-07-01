import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import useAuthStore from './store/authStore'
import useSocketStore from './store/socketStore'

import Layout from './components/layout/Layout'
import ProtectedRoute from './components/layout/ProtectedRoute'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import MfaVerifyPage from './pages/MfaVerifyPage'
import MentionsLegalesPage from './pages/MentionsLegalesPage'
import CookieBanner from './components/ui/CookieBanner'
import DashboardPage from './pages/DashboardPage'
import AnnoncesPage from './pages/AnnoncesPage'
import AnnonceDetailPage from './pages/AnnonceDetailPage'
import EvenementsPage from './pages/EvenementsPage'
import EvenementDetailPage from './pages/EvenementDetailPage'
import VotesPage from './pages/VotesPage'
import MessagesPage from './pages/MessagesPage'
import ConversationPage from './pages/ConversationPage'
import ContratsPage from './pages/ContratsPage'
import NotificationsPage from './pages/NotificationsPage'
import ProfilPage from './pages/ProfilPage'

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
      <CookieBanner />
      <Routes>
        <Route path="/login"            element={!token ? <LoginPage />           : <Navigate to="/dashboard" replace />} />
        <Route path="/register"         element={!token ? <RegisterPage />        : <Navigate to="/dashboard" replace />} />
        <Route path="/mentions-legales"      element={<MentionsLegalesPage />} />
        <Route path="/verify-email"          element={<VerifyEmailPage />} />
        <Route path="/forgot-password"       element={!token ? <ForgotPasswordPage />  : <Navigate to="/dashboard" replace />} />
        <Route path="/reset-password/:token" element={!token ? <ResetPasswordPage />    : <Navigate to="/dashboard" replace />} />
        <Route path="/mfa"                   element={!token ? <MfaVerifyPage />        : <Navigate to="/dashboard" replace />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard"     element={<DashboardPage />} />
            <Route path="/annonces"      element={<AnnoncesPage />} />
            <Route path="/annonces/:id"  element={<AnnonceDetailPage />} />
            <Route path="/evenements"    element={<EvenementsPage />} />
            <Route path="/evenements/:id" element={<EvenementDetailPage />} />
            <Route path="/votes"         element={<VotesPage />} />
            <Route path="/messages"      element={<MessagesPage />} />
            <Route path="/messages/:id"  element={<ConversationPage />} />
            <Route path="/contrats"      element={<ContratsPage />} />
            <Route path="/contrats/:id"  element={
              <Suspense fallback={<div className="p-8 text-center text-gray-400">Chargement...</div>}>
                <ContratDetailPage />
              </Suspense>
            } />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profil"        element={<ProfilPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
