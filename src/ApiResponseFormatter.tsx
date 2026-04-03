import { useState, useCallback } from 'react'
import { Sun, Moon, Languages, Copy, Check, Braces, AlertCircle, Wand2 } from 'lucide-react'

const translations = {
  en: {
    title: 'API Response Formatter',
    subtitle: 'Paste JSON, XML, or CSV. Auto-detect format, format and highlight syntax.',
    inputLabel: 'Paste your API response',
    inputPlaceholder: 'Paste JSON, XML, or CSV here...',
    format: 'Format & Highlight',
    clear: 'Clear',
    copy: 'Copy',
    copied: 'Copied!',
    detected: 'Detected format',
    size: 'Size',
    lines: 'lines',
    chars: 'chars',
    error: 'Parse error',
    noInput: 'Paste content above and click "Format & Highlight"',
    builtBy: 'Built by',
  },
  pt: {
    title: 'Formatador de Respostas API',
    subtitle: 'Cole JSON, XML ou CSV. Detecta o formato automaticamente, formata e destaca a sintaxe.',
    inputLabel: 'Cole a resposta da API',
    inputPlaceholder: 'Cole JSON, XML ou CSV aqui...',
    format: 'Formatar e Destacar',
    clear: 'Limpar',
    copy: 'Copiar',
    copied: 'Copiado!',
    detected: 'Formato detectado',
    size: 'Tamanho',
    lines: 'linhas',
    chars: 'caracteres',
    error: 'Erro de parse',
    noInput: 'Cole conteudo acima e clique em "Formatar e Destacar"',
    builtBy: 'Criado por',
  }
} as const

type Lang = keyof typeof translations
type Format = 'json' | 'xml' | 'csv' | 'unknown'

function detectFormat(raw: string): Format {
  const trimmed = raw.trim()
  if (!trimmed) return 'unknown'
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
  if (trimmed.startsWith('<')) return 'xml'
  if (trimmed.includes(',') && trimmed.split('\n').length > 1) return 'csv'
  try { JSON.parse(trimmed); return 'json' } catch { /* */ }
  return 'unknown'
}

function formatJSON(raw: string): { output: string; error: string | null } {
  try {
    return { output: JSON.stringify(JSON.parse(raw), null, 2), error: null }
  } catch (e) {
    return { output: '', error: String(e) }
  }
}

function formatXML(raw: string): { output: string; error: string | null } {
  try {
    let indent = 0
    const lines = raw.replace(/>\s*</g, '>\n<').split('\n')
    const result = lines.map(line => {
      const trimmed = line.trim()
      if (!trimmed) return ''
      if (trimmed.startsWith('</')) { indent = Math.max(0, indent - 1) }
      const out = '  '.repeat(indent) + trimmed
      if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.startsWith('<!') && !trimmed.endsWith('/>') && !trimmed.includes('</')) { indent++ }
      return out
    }).filter(Boolean)
    return { output: result.join('\n'), error: null }
  } catch (e) {
    return { output: '', error: String(e) }
  }
}

function formatCSV(raw: string): { output: string; error: string | null } {
  const lines = raw.trim().split('\n')
  const rows = lines.map(l => l.split(',').map(c => c.trim()))
  const maxCols = Math.max(...rows.map(r => r.length))
  const widths = Array.from({ length: maxCols }, (_, i) => Math.max(...rows.map(r => (r[i] ?? '').length)))
  const result = rows.map(row =>
    row.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join(' | ')
  )
  const header = result[0]
  const sep = widths.map(w => '-'.repeat(w)).join('-+-')
  return { output: [header, sep, ...result.slice(1)].join('\n'), error: null }
}

function highlightJSON(code: string): string {
  return code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) return `<span class="text-cyan-400">${match}</span>`
        return `<span class="text-green-400">${match}</span>`
      }
      if (/true|false/.test(match)) return `<span class="text-yellow-400">${match}</span>`
      if (/null/.test(match)) return `<span class="text-red-400">${match}</span>`
      return `<span class="text-blue-400">${match}</span>`
    })
}

function highlightXML(code: string): string {
  return code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/&lt;(\/?[\w:.-]+)((?:\s+[\w:.-]+\s*=\s*"[^"]*")*)\s*\/?&gt;/g,
      (_, tag, attrs) => {
        const highlightedAttrs = attrs.replace(/([\w:.-]+)\s*=\s*("([^"]*)")/g,
          (_: string, k: string, v: string) => `<span class="text-yellow-400">${k}</span>=<span class="text-green-400">${v}</span>`)
        return `&lt;<span class="text-cyan-400">${tag}</span>${highlightedAttrs}&gt;`
      })
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="text-zinc-500">$1</span>')
}

export default function ApiResponseFormatter() {
  const [lang, setLang] = useState<Lang>(() => navigator.language.startsWith('pt') ? 'pt' : 'en')
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [format, setFormat] = useState<Format>('unknown')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [highlighted, setHighlighted] = useState('')

  const t = translations[lang]

  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', dark)
  }

  const handleFormat = useCallback(() => {
    if (!input.trim()) return
    const fmt = detectFormat(input)
    setFormat(fmt)
    let result: { output: string; error: string | null }
    if (fmt === 'json') result = formatJSON(input)
    else if (fmt === 'xml') result = formatXML(input)
    else if (fmt === 'csv') result = formatCSV(input)
    else result = { output: input.trim(), error: null }

    if (result.error) {
      setError(result.error)
      setOutput('')
      setHighlighted('')
    } else {
      setError('')
      setOutput(result.output)
      if (fmt === 'json') setHighlighted(highlightJSON(result.output))
      else if (fmt === 'xml') setHighlighted(highlightXML(result.output))
      else setHighlighted(result.output.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    }
  }, [input])

  const handleCopy = () => {
    navigator.clipboard.writeText(output).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const FORMAT_COLORS: Record<Format, string> = {
    json: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    xml: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    csv: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    unknown: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 transition-colors">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center">
              <Braces size={18} className="text-white" />
            </div>
            <span className="font-semibold">API Response Formatter</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang(l => l === 'en' ? 'pt' : 'en')} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <Languages size={14} />{lang.toUpperCase()}
            </button>
            <button onClick={() => setDark(d => !d)} className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <a href="https://github.com/gmowses/api-response-formatter" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">{t.title}</h1>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">{t.subtitle}</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Input */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
              <label className="font-semibold text-sm">{t.inputLabel}</label>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={t.inputPlaceholder}
                rows={18}
                spellCheck={false}
                className="w-full font-mono text-xs bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <div className="flex gap-2">
                <button onClick={handleFormat} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-600 transition-colors">
                  <Wand2 size={15} />{t.format}
                </button>
                <button onClick={() => { setInput(''); setOutput(''); setHighlighted(''); setError(''); setFormat('unknown') }}
                  className="px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">{t.clear}</button>
              </div>
            </div>

            {/* Output */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Output</span>
                <div className="flex items-center gap-2">
                  {format !== 'unknown' && output && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FORMAT_COLORS[format]}`}>
                      {t.detected}: {format.toUpperCase()}
                    </span>
                  )}
                  {output && (
                    <button onClick={handleCopy} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                      {copied ? t.copied : t.copy}
                    </button>
                  )}
                </div>
              </div>

              {error ? (
                <div className="flex items-start gap-2 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-400">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />{t.error}: {error}
                </div>
              ) : highlighted ? (
                <pre
                  className="font-mono text-xs bg-zinc-900 dark:bg-zinc-950 text-zinc-100 rounded-lg p-3 overflow-auto min-h-[18rem] max-h-[32rem] leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: highlighted }}
                />
              ) : (
                <div className="flex items-center justify-center min-h-[18rem] rounded-lg bg-zinc-50 dark:bg-zinc-800/30 border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 text-sm text-center px-4">
                  {t.noInput}
                </div>
              )}

              {output && (
                <div className="flex gap-4 text-xs text-zinc-400">
                  <span>{output.split('\n').length} {t.lines}</span>
                  <span>{output.length} {t.chars}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-zinc-400">
          <span>{t.builtBy} <a href="https://github.com/gmowses" className="text-zinc-600 dark:text-zinc-300 hover:text-cyan-500 transition-colors">Gabriel Mowses</a></span>
          <span>MIT License</span>
        </div>
      </footer>
    </div>
  )
}
