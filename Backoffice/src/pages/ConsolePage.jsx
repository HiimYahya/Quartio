import { useState, useRef } from 'react'
import api from '../services/api'

const EXAMPLES = [
  { label: 'Annonces actives',        query: 'FIND annonces WHERE statut = "active" LIMIT 20' },
  { label: 'Incidents critiques',     query: 'FIND incidents WHERE priorite = "critique" ORDER BY createdAt DESC LIMIT 10' },
  { label: 'Compter incidents ouverts', query: 'COUNT incidents WHERE statut = "ouvert"' },
  { label: 'Événements planifiés',    query: 'FIND evenements WHERE statut = "planifie" ORDER BY date_debut ASC LIMIT 10' },
  { label: 'Annonces payantes > 50pts', query: 'FIND annonces WHERE est_payant = true AND cout_points > 50 LIMIT 20' },
  { label: 'Incidents avec "bruit"',  query: 'FIND incidents WHERE titre CONTAINS "bruit"' },
  { label: 'Annonces par type',       query: 'FIND annonces WHERE statut IN ("active", "inactive") LIMIT 30' },
  { label: 'Archiver les inactives',  query: 'UPDATE annonces WHERE statut = "inactive" SET { "statut": "archivee" }' },
]

const SYNTAX_HELP = `Quartio-QL - Syntaxe

FIND   <collection> [WHERE <conditions>] [ORDER BY <field> ASC|DESC] [LIMIT n]
COUNT  <collection> [WHERE <conditions>]
INSERT <collection> { "field": value, ... }
UPDATE <collection> WHERE <conditions> SET { "field": value, ... }
DELETE <collection> WHERE <conditions>

Collections : annonces, evenements, incidents, conversations, messages

Opérateurs : =  !=  >  <  >=  <=  CONTAINS  IN (v1, v2, ...)
Logique     : AND  OR  NOT IN (...)
Littéraux   : "texte"  42  true  false  null`

export default function ConsolePage() {
  const [query, setQuery]     = useState('FIND annonces WHERE statut = "active" LIMIT 10')
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [showHelp, setShowHelp] = useState(false)
  const textareaRef = useRef(null)

  const execute = async () => {
    if (!query.trim()) return
    setLoading(true)
    const ts = Date.now()
    try {
      const { data } = await api.post('/query', { query: query.trim() })
      setResult({ ok: true, data, ts })
      setHistory((h) => [{ query: query.trim(), ok: true, ts }, ...h].slice(0, 20))
    } catch (err) {
      const error = err.response?.data ?? { error: err.message }
      setResult({ ok: false, error, ts })
      setHistory((h) => [{ query: query.trim(), ok: false, ts }, ...h].slice(0, 20))
    }
    setLoading(false)
  }

  const handleKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      execute()
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const el    = textareaRef.current
      const start = el.selectionStart
      const end   = el.selectionEnd
      const next  = query.slice(0, start) + '  ' + query.slice(end)
      setQuery(next)
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 2 })
    }
  }

  const rows = result?.data?.result
  const isArray = Array.isArray(rows)
  const columns = isArray && rows.length > 0
    ? [...new Set(rows.flatMap((r) => Object.keys(r)))]
        .filter((k) => !['__v'].includes(k))
        .slice(0, 12)
    : []

  return (
    <div className="space-y-4 h-full flex flex-col">

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {EXAMPLES.map(({ label, query: q }) => (
            <button key={label} onClick={() => setQuery(q)}
              className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors">
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowHelp((v) => !v)}
          className="text-xs px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg shrink-0">
          {showHelp ? 'Masquer l\'aide' : '? Syntaxe'}
        </button>
      </div>

      {showHelp && (
        <pre className="bg-slate-900 text-green-300 text-xs p-4 rounded-xl overflow-x-auto leading-relaxed font-mono whitespace-pre">
          {SYNTAX_HELP}
        </pre>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-0">

        <div className="lg:col-span-3 flex flex-col gap-3">

          <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
              <span className="text-xs text-slate-400 font-mono">Quartio-QL</span>
              <span className="text-xs text-slate-500">Ctrl+Entrée pour exécuter</span>
            </div>
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              rows={4}
              spellCheck={false}
              className="w-full bg-transparent text-green-300 font-mono text-sm p-4 resize-none outline-none placeholder-slate-600"
              placeholder="FIND annonces WHERE statut = &quot;active&quot; LIMIT 10"
            />
            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-700">
              <span className="text-xs text-slate-500">
                {result && (
                  <span className={result.ok ? 'text-green-400' : 'text-red-400'}>
                    {result.ok
                      ? `${result.data.duration_ms}ms - ${isArray ? `${rows.length} résultat(s)` : typeof rows === 'number' ? `count: ${rows}` : 'OK'}`
                      : `Erreur : ${result.error?.error ?? 'inconnue'}`}
                  </span>
                )}
              </span>
              <button
                onClick={execute}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-60 transition-colors"
              >
                {loading ? '...' : '▶ Exécuter'}
              </button>
            </div>
          </div>

          {result && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex-1 min-h-0">
              {!result.ok ? (
                <div className="p-4">
                  <p className="text-sm font-semibold text-red-600 mb-1">Erreur</p>
                  <pre className="text-xs text-red-500 font-mono bg-red-50 p-3 rounded-lg overflow-x-auto">
                    {result.error?.error ?? JSON.stringify(result.error, null, 2)}
                  </pre>
                  {result.error?.type === 'parse_error' && (
                    <p className="text-xs text-slate-400 mt-2">Vérifiez la syntaxe - cliquez sur "? Syntaxe" pour l'aide.</p>
                  )}
                </div>
              ) : typeof result.data.result === 'number' ? (
                <div className="p-6 text-center">
                  <p className="text-4xl font-bold text-indigo-600">{result.data.result}</p>
                  <p className="text-sm text-slate-500 mt-1">document(s) correspondant(s)</p>
                </div>
              ) : !isArray || rows.length === 0 ? (
                <div className="p-5">
                  <pre className="text-xs font-mono text-slate-600 bg-slate-50 p-3 rounded-lg overflow-auto max-h-80">
                    {JSON.stringify(result.data.result, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="overflow-auto max-h-96">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        {columns.map((col) => (
                          <th key={col} className="px-3 py-2.5 text-left font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {rows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          {columns.map((col) => {
                            const val = row[col]
                            return (
                              <td key={col} className="px-3 py-2 text-slate-600 max-w-xs truncate font-mono">
                                {val === null || val === undefined
                                  ? <span className="text-slate-300">null</span>
                                  : typeof val === 'boolean'
                                    ? <span className={val ? 'text-green-600' : 'text-red-500'}>{String(val)}</span>
                                    : typeof val === 'object'
                                      ? <span className="text-slate-400">{JSON.stringify(val).slice(0, 40)}</span>
                                      : String(val).slice(0, 60)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <details className="border-t border-slate-100">
                <summary className="px-4 py-2 text-xs text-slate-400 cursor-pointer hover:text-slate-600">
                  Voir l'AST généré
                </summary>
                <pre className="px-4 pb-4 text-xs font-mono text-slate-500 overflow-x-auto">
                  {JSON.stringify(result.data.ast, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Historique</h3>
          {history.length === 0 ? (
            <p className="text-xs text-slate-400">Aucune requête exécutée</p>
          ) : (
            <div className="space-y-1.5">
              {history.map(({ query: q, ok, ts }, i) => (
                <button key={ts + i} onClick={() => setQuery(q)}
                  className="w-full text-left group">
                  <div className={`flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 transition-colors`}>
                    <span className={`shrink-0 mt-0.5 ${ok ? 'text-green-400' : 'text-red-400'}`}>
                      {ok ? '' : ''}
                    </span>
                    <span className="text-xs font-mono text-slate-600 truncate group-hover:text-slate-900">
                      {q.slice(0, 50)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
