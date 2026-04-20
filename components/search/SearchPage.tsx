'use client'
import { useState, useRef, useCallback } from 'react'

const FONT = '"Source Sans 3", "Source Sans Pro", sans-serif'

interface SearchResult {
  id: string
  type: 'action_item' | 'note' | 'log'
  text: string
  date: string | null
  parent_name?: string | null
  status?: string
  note_type?: string
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  action_item: { label: 'item', color: '#2D2A26' },
  note: { label: 'note', color: '#4B82AF' },
  log: { label: 'logged', color: '#C4725A' },
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setSearched(false); return }
    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(Array.isArray(data) ? data : [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  function handleInput(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value.trim()), 300)
  }

  return (
    <div style={{ fontFamily: FONT, maxWidth: 700, margin: '0 auto', padding: '32px 24px 80px' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#2D2A26', margin: '0 0 16px' }}>Search</h1>

      <input
        value={query}
        onChange={e => handleInput(e.target.value)}
        placeholder="Search notes, logs, items..."
        autoFocus
        style={{
          width: '100%', fontSize: 15, border: '1px solid #E8E4DC', borderRadius: 10,
          padding: '10px 14px', background: '#FFF', color: '#2D2A26',
          outline: 'none', fontFamily: FONT, boxSizing: 'border-box',
        }}
      />

      {loading && (
        <div style={{ fontSize: 12, color: '#B5B0A8', marginTop: 12 }}>Searching...</div>
      )}

      {searched && !loading && results.length === 0 && (
        <div style={{ fontSize: 13, color: '#B5B0A8', marginTop: 16, fontStyle: 'italic' }}>
          No results found.
        </div>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {results.map(r => {
            const typeInfo = TYPE_LABELS[r.type] ?? { label: r.type, color: '#8A8578' }
            return (
              <div key={r.id + r.type} style={{
                padding: '10px 0', borderBottom: '1px solid #F0EDE8',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <div style={{ width: 60, flexShrink: 0, textAlign: 'right', paddingTop: 2 }}>
                  <div style={{ fontSize: 10, color: '#B5B0A8' }}>{fmtDate(r.date)}</div>
                  <div style={{ fontSize: 9, color: typeInfo.color, fontWeight: 600, marginTop: 2 }}>{typeInfo.label}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, color: '#2D2A26', lineHeight: 1.5,
                    ...(r.type === 'log' ? { borderLeft: '3px solid #C4725A40', paddingLeft: 8, background: '#FDF9F7', borderRadius: 2 } : {}),
                  }}>
                    {r.text}
                  </div>
                  {r.parent_name && (
                    <div style={{ fontSize: 11, color: '#8A857D', marginTop: 2, fontStyle: 'italic' }}>
                      on: {r.parent_name}
                    </div>
                  )}
                  {r.status && r.status !== 'completed' && r.status !== 'archived' && (
                    <span style={{ fontSize: 9, color: '#8A857D', marginTop: 2, display: 'inline-block' }}>{r.status}</span>
                  )}
                  {r.status === 'completed' && (
                    <span style={{ fontSize: 9, color: '#5A9E6F', marginTop: 2, display: 'inline-block' }}>completed</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
