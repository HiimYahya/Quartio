import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f0faf5] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">!</div>
            <h1 className="text-lg font-bold text-gray-800 mb-1">Une erreur est survenue</h1>
            <p className="text-sm text-gray-500 mb-5">Quelque chose s'est mal passé de notre côté. Vous pouvez recharger la page.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => { window.location.href = '/dashboard' }}
                className="border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                Accueil
              </button>
              <button onClick={() => window.location.reload()}
                className="bg-[#1a4a3a] hover:bg-[#0f2e24] text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
                Recharger
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
