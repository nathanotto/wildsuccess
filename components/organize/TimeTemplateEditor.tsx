'use client'
import { useState, useEffect } from 'react'
import { TimeTemplateBlock } from '@/lib/types'

const EC: Record<string, string> = { A: '#C4725A', B: '#4B82AF', C: '#D4564E', D: '#5A9E6F', '0': '#B5B0A8' }
const EL: Record<string, string> = { A: 'Focus', B: 'Routine', C: 'Unwanted', D: 'Self-care', '0': 'Free' }
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface Props {
  onClose: () => void
}

interface EditingBlock {
  id?: string
  day_of_week: number
  label: string
  start_time: string
  end_time: string
  time_type: 'A' | 'B' | 'C' | 'D' | '0'
  sort_order: number
}

function formatBlockTime(t: string): string {
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr)
  const m = mStr ?? '00'
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return m === '00' ? `${h12} ${ampm}` : `${h12}:${m} ${ampm}`
}

export default function TimeTemplateEditor({ onClose }: Props) {
  const [blocks, setBlocks] = useState<TimeTemplateBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EditingBlock | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const res = await fetch('/api/time-template')
      if (res.ok) setBlocks(await res.json())
      setLoading(false)
    }
    load()
  }, [])

  const blocksForDay = (d: number) =>
    blocks.filter(b => b.day_of_week === d).sort((a, b) => a.sort_order - b.sort_order || a.start_time.localeCompare(b.start_time))

  const openNew = (day: number) => {
    const dayBlocks = blocksForDay(day)
    setEditing({
      day_of_week: day,
      label: '',
      start_time: '09:00',
      end_time: '10:00',
      time_type: 'B',
      sort_order: dayBlocks.length,
    })
  }

  const openEdit = (b: TimeTemplateBlock) => {
    setEditing({
      id: b.id,
      day_of_week: b.day_of_week,
      label: b.label,
      start_time: b.start_time.slice(0, 5),
      end_time: b.end_time.slice(0, 5),
      time_type: b.time_type,
      sort_order: b.sort_order,
    })
  }

  const saveEditing = async () => {
    if (!editing || !editing.label.trim()) return
    setSaving(true)

    if (editing.id) {
      const res = await fetch(`/api/time-template/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: editing.label,
          start_time: editing.start_time,
          end_time: editing.end_time,
          time_type: editing.time_type,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setBlocks(bs => bs.map(b => b.id === updated.id ? updated : b))
      }
    } else {
      const res = await fetch('/api/time-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_of_week: editing.day_of_week,
          label: editing.label,
          start_time: editing.start_time,
          end_time: editing.end_time,
          time_type: editing.time_type,
          sort_order: editing.sort_order,
          context: [],
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setBlocks(bs => [...bs, created])
      }
    }

    setEditing(null)
    setSaving(false)
  }

  const deleteBlock = async (id: string) => {
    const res = await fetch(`/api/time-template/${id}`, { method: 'DELETE' })
    if (res.ok) setBlocks(bs => bs.filter(b => b.id !== id))
    setEditing(null)
  }

  const seedDefaults = async () => {
    await fetch('/api/time-template/seed-defaults', { method: 'POST' })
    const res = await fetch('/api/time-template')
    if (res.ok) setBlocks(await res.json())
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1001,
      background: 'rgba(45,42,38,0.35)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Source Sans 3', sans-serif",
    }}>
      <div style={{
        width: '95vw', maxWidth: 1400, height: '90vh', background: '#FAFAF7',
        borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid #E8E4DC', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#2D2A26' }}>Time Template</span>
            <span style={{ fontSize: 13, color: '#8A857D' }}>Your ideal week — generates default blocks when Organize opens</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {blocks.length === 0 && !loading && (
              <button onClick={seedDefaults} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #C4725A', background: '#C4725A10', color: '#C4725A', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>
                Seed Default Template
              </button>
            )}
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #E8E4DC', background: 'transparent', cursor: 'pointer', fontSize: 16, color: '#8A857D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>

        {/* Body — 7 columns */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B5B0A8', fontSize: 14 }}>Loading...</div>
          ) : (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {DAY_LABELS.map((dayLabel, dayIdx) => {
                const dayBlocks = blocksForDay(dayIdx)
                return (
                  <div key={dayIdx} style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    borderRight: dayIdx < 6 ? '1px solid #E8E4DC' : 'none',
                    overflow: 'hidden',
                  }}>
                    {/* Day header */}
                    <div style={{
                      padding: '10px 8px 8px', borderBottom: '1px solid #E8E4DC',
                      background: 'white', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#2D2A26' }}>{dayLabel}</div>
                      <div style={{ fontSize: 10, color: '#B5B0A8', marginTop: 1 }}>{dayBlocks.length} block{dayBlocks.length !== 1 ? 's' : ''}</div>
                    </div>

                    {/* Blocks */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '6px 6px' }}>
                      {dayBlocks.map(block => {
                        const isEditingThis = editing?.id === block.id
                        return (
                          <div key={block.id}
                            onClick={() => !isEditingThis && openEdit(block)}
                            style={{
                              marginBottom: 5, borderRadius: 8, overflow: 'hidden',
                              border: '1px solid', borderColor: isEditingThis ? '#C4725A' : '#E8E4DC',
                              background: isEditingThis ? '#C4725A05' : 'white',
                              cursor: isEditingThis ? 'default' : 'pointer',
                            }}
                          >
                            {!isEditingThis ? (
                              <div style={{ padding: '7px 9px', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                <div style={{ width: 3, height: 28, borderRadius: 2, background: EC[block.time_type], flexShrink: 0, marginTop: 2 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: '#2D2A26', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.label}</div>
                                  <div style={{ fontSize: 10, color: '#8A857D' }}>{formatBlockTime(block.start_time)} – {formatBlockTime(block.end_time)}</div>
                                  <div style={{ fontSize: 9, color: EC[block.time_type], fontWeight: 600, marginTop: 1 }}>{EL[block.time_type]}</div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ padding: '8px 10px' }}>
                                <input
                                  autoFocus
                                  value={editing.label}
                                  onChange={e => setEditing(ed => ed ? { ...ed, label: e.target.value } : ed)}
                                  placeholder="Block name"
                                  style={{ width: '100%', padding: '4px 7px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 12, fontFamily: "'Source Sans 3', sans-serif", outline: 'none', marginBottom: 6, boxSizing: 'border-box', background: 'white' }}
                                />
                                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 9, color: '#8A857D', marginBottom: 2 }}>Start</div>
                                    <input type="time" value={editing.start_time} onChange={e => setEditing(ed => ed ? { ...ed, start_time: e.target.value } : ed)}
                                      style={{ width: '100%', padding: '3px 5px', borderRadius: 5, border: '1px solid #E8E4DC', fontSize: 11, fontFamily: "'Source Sans 3', sans-serif", outline: 'none' }} />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 9, color: '#8A857D', marginBottom: 2 }}>End</div>
                                    <input type="time" value={editing.end_time} onChange={e => setEditing(ed => ed ? { ...ed, end_time: e.target.value } : ed)}
                                      style={{ width: '100%', padding: '3px 5px', borderRadius: 5, border: '1px solid #E8E4DC', fontSize: 11, fontFamily: "'Source Sans 3', sans-serif", outline: 'none' }} />
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
                                  {['A', 'B', 'C', 'D', '0'].map(e => (
                                    <button key={e} onClick={() => setEditing(ed => ed ? { ...ed, time_type: e as 'A' | 'B' | 'C' | 'D' | '0' } : ed)}
                                      style={{ flex: 1, padding: '3px 0', borderRadius: 5, border: '1.5px solid', borderColor: editing.time_type === e ? EC[e] : '#E8E4DC', background: editing.time_type === e ? EC[e] + '15' : 'transparent', color: editing.time_type === e ? EC[e] : '#8A857D', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>{EL[e]}</button>
                                  ))}
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={saveEditing} disabled={saving || !editing.label.trim()}
                                    style={{ flex: 1, padding: '4px 0', borderRadius: 6, border: 'none', background: '#C4725A', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif", opacity: saving || !editing.label.trim() ? 0.6 : 1 }}>Save</button>
                                  <button onClick={() => deleteBlock(block.id)}
                                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #D4564E30', background: 'transparent', color: '#D4564E', fontSize: 11, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>Del</button>
                                  <button onClick={() => setEditing(null)}
                                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E8E4DC', background: 'transparent', color: '#8A857D', fontSize: 11, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>✕</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* New block form */}
                      {editing && !editing.id && editing.day_of_week === dayIdx ? (
                        <div style={{ borderRadius: 8, border: '1px solid #C4725A', background: '#C4725A05', padding: '8px 10px' }}>
                          <input
                            autoFocus
                            value={editing.label}
                            onChange={e => setEditing(ed => ed ? { ...ed, label: e.target.value } : ed)}
                            placeholder="Block name"
                            style={{ width: '100%', padding: '4px 7px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 12, fontFamily: "'Source Sans 3', sans-serif", outline: 'none', marginBottom: 6, boxSizing: 'border-box', background: 'white' }}
                          />
                          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 9, color: '#8A857D', marginBottom: 2 }}>Start</div>
                              <input type="time" value={editing.start_time} onChange={e => setEditing(ed => ed ? { ...ed, start_time: e.target.value } : ed)}
                                style={{ width: '100%', padding: '3px 5px', borderRadius: 5, border: '1px solid #E8E4DC', fontSize: 11, fontFamily: "'Source Sans 3', sans-serif", outline: 'none' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 9, color: '#8A857D', marginBottom: 2 }}>End</div>
                              <input type="time" value={editing.end_time} onChange={e => setEditing(ed => ed ? { ...ed, end_time: e.target.value } : ed)}
                                style={{ width: '100%', padding: '3px 5px', borderRadius: 5, border: '1px solid #E8E4DC', fontSize: 11, fontFamily: "'Source Sans 3', sans-serif", outline: 'none' }} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 3, marginBottom: 8, flexWrap: 'wrap' }}>
                            {['A', 'B', 'C', 'D', '0'].map(e => (
                              <button key={e} onClick={() => setEditing(ed => ed ? { ...ed, time_type: e as 'A' | 'B' | 'C' | 'D' | '0' } : ed)}
                                style={{ flex: 1, padding: '3px 0', borderRadius: 5, border: '1.5px solid', borderColor: editing.time_type === e ? EC[e] : '#E8E4DC', background: editing.time_type === e ? EC[e] + '15' : 'transparent', color: editing.time_type === e ? EC[e] : '#8A857D', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>{EL[e]}</button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={saveEditing} disabled={saving || !editing.label.trim()}
                              style={{ flex: 1, padding: '4px 0', borderRadius: 6, border: 'none', background: '#C4725A', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif", opacity: saving || !editing.label.trim() ? 0.6 : 1 }}>Add</button>
                            <button onClick={() => setEditing(null)}
                              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E8E4DC', background: 'transparent', color: '#8A857D', fontSize: 11, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>✕</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => openNew(dayIdx)}
                          style={{ width: '100%', padding: '7px 0', borderRadius: 7, border: '1.5px dashed #D0CBC3', background: 'transparent', color: '#B5B0A8', fontSize: 11, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif', transition: 'all 0.12s" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#C4725A'; (e.currentTarget as HTMLElement).style.color = '#C4725A' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#D0CBC3'; (e.currentTarget as HTMLElement).style.color = '#B5B0A8' }}
                        >+ Add block</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
