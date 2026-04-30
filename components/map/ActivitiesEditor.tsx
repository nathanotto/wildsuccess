'use client'
import { useState, useMemo } from 'react'
import { Activity, UserValue, LifeDomain, BigOutcome } from '@/lib/types'
import EditActivityModal from './EditActivityModal'
import { COLORS } from '@/lib/theme'

const EC: Record<string, string> = { A: COLORS.primary, B: '#4B82AF', C: '#D4564E', D: '#5A9E6F', '0': '#B5B0A8' }
const EL: Record<string, string> = { A: 'Focus', B: 'Routine', C: 'Connection', D: 'Restore', '0': 'Open' }
const FREQ_LABELS: Record<string, string> = {
  daily: 'Daily', weekly: 'Weekly', biweekly: 'Biweekly',
  monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual',
}
const STATUS_ORDER = ['active', 'aspirational', 'paused', 'completed']
const STATUS_LABELS: Record<string, string> = {
  active: 'Active', aspirational: 'Aspirational', paused: 'Paused', completed: 'Completed',
}
const STATUS_COLORS: Record<string, string> = {
  active: '#5A9E6F', aspirational: '#4B82AF', paused: '#B5B0A8', completed: COLORS.primary,
}

interface Props {
  activities: Activity[]
  values: UserValue[]
  domains: LifeDomain[]
  outcomes: BigOutcome[]
  onSave: (id: string, data: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onCreate: (data: Record<string, unknown>) => Promise<void>
  onClose: () => void
}

export default function ActivitiesEditor({ activities, values, domains, outcomes, onSave, onDelete, onCreate, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('active')
  const [editing, setEditing] = useState<Activity | 'new' | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return activities.filter(a => {
      if (filterStatus !== 'all' && a.status !== filterStatus) return false
      if (q && !a.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [activities, filterStatus, search])

  const grouped = useMemo(() => {
    const map: Record<string, Activity[]> = {}
    for (const a of filtered) {
      if (!map[a.status]) map[a.status] = []
      map[a.status].push(a)
    }
    return map
  }, [filtered])

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: activities.length }
    for (const a of activities) map[a.status] = (map[a.status] ?? 0) + 1
    return map
  }, [activities])

  async function togglePause(a: Activity) {
    setTogglingId(a.id)
    const newStatus = a.status === 'active' ? 'paused' : 'active'
    await onSave(a.id, { status: newStatus })
    setTogglingId(null)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(45,42,38,0.40)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#FAFAF7', borderRadius: 16, boxShadow: '0 8px 40px rgba(45,42,38,0.18)',
        width: '90vw', maxWidth: 760, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px 12px', borderBottom: '1px solid #E8E4DC',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2D2A26' }}>Activities</div>
            <div style={{ fontSize: 11, color: '#8A857D', marginTop: 1 }}>
              {activities.length} total · {counts['active'] ?? 0} active
            </div>
          </div>
          <button
            onClick={() => setEditing('new')}
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none',
              background: COLORS.primary, color: '#FFF', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            + New Activity
          </button>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 8, border: 'none',
              background: '#E8E4DC', cursor: 'pointer', fontSize: 16, color: '#5A5650',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        {/* Search + filter */}
        <div style={{
          padding: '10px 20px', borderBottom: '1px solid #F0EDE8',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search activities…"
            style={{
              flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid #E8E4DC',
              fontSize: 12, outline: 'none', fontFamily: 'inherit', background: '#FFF',
            }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {['all', 'active', 'aspirational', 'paused', 'completed'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                style={{
                  padding: '4px 10px', borderRadius: 6,
                  border: `1px solid ${filterStatus === s ? COLORS.primary : '#E8E4DC'}`,
                  background: filterStatus === s ? '#FDF6F3' : 'transparent',
                  color: filterStatus === s ? COLORS.primary : '#8A857D',
                  fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {s === 'all' ? 'All' : STATUS_LABELS[s]} {counts[s] ? `(${counts[s]})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#B5B0A8', fontSize: 13 }}>
              {search ? 'No activities match your search.' : 'No activities in this category.'}
            </div>
          )}

          {STATUS_ORDER.filter(s => filterStatus === 'all' || filterStatus === s).map(status => {
            const group = grouped[status]
            if (!group?.length) return null
            return (
              <div key={status}>
                {filterStatus === 'all' && (
                  <div style={{
                    padding: '6px 20px 4px',
                    fontSize: 10, fontWeight: 700, color: STATUS_COLORS[status],
                    letterSpacing: 0.8, textTransform: 'uppercase',
                  }}>
                    {STATUS_LABELS[status]} ({group.length})
                  </div>
                )}
                {group.map(a => (
                  <ActivityRow
                    key={a.id}
                    activity={a}
                    toggling={togglingId === a.id}
                    onEdit={() => setEditing(a)}
                    onTogglePause={() => togglePause(a)}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Inline edit modal */}
      {editing !== null && (
        <EditActivityModal
          activity={editing === 'new' ? null : editing}
          values={values}
          domains={domains}
          outcomes={outcomes}
          onSave={async (data) => {
            if (editing === 'new') {
              await onCreate(data)
            } else {
              await onSave(editing.id, data)
            }
            setEditing(null)
          }}
          onDelete={editing !== 'new' ? async () => {
            await onDelete(editing.id)
            setEditing(null)
          } : null}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function ActivityRow({ activity: a, toggling, onEdit, onTogglePause }: {
  activity: Activity
  toggling: boolean
  onEdit: () => void
  onTogglePause: () => void
}) {
  const isActive = a.status === 'active'
  const canToggle = a.status === 'active' || a.status === 'paused'

  return (
    <div
      onClick={onEdit}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 20px', cursor: 'pointer',
        borderBottom: '1px solid #F5F3EF',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F5F3EF'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
    >
      {/* Time type dot */}
      <span
        title={EL[a.time_type]}
        style={{
          width: 10, height: 10, borderRadius: '50%',
          background: EC[a.time_type] ?? '#B5B0A8',
          flexShrink: 0,
        }}
      />

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: a.status === 'paused' ? '#B5B0A8' : '#2D2A26',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textDecoration: a.status === 'paused' ? 'line-through' : 'none',
        }}>
          {a.name}
          {a.is_preventive && (
            <span title="Preventive" style={{ marginLeft: 5, fontSize: 9, color: '#9E6A46', fontWeight: 700, letterSpacing: 0.3 }}>PROTECT</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {a.frequency && (
            <span style={{
              fontSize: 10, color: '#8A857D',
              background: '#F0EDE8', borderRadius: 4, padding: '1px 5px',
            }}>
              {FREQ_LABELS[a.frequency] ?? a.frequency}
            </span>
          )}
          {(a.value_links?.length ?? 0) > 0 && (
            <span style={{ fontSize: 10, color: '#8A857D' }}>
              {a.value_links!.length} value{a.value_links!.length !== 1 ? 's' : ''}
            </span>
          )}
          {a.description && (
            <span style={{
              fontSize: 10, color: '#B5B0A8',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200,
            }}>
              {a.description}
            </span>
          )}
        </div>
      </div>

      {/* Time type label */}
      <span style={{
        fontSize: 10, fontWeight: 600, color: EC[a.time_type] ?? '#B5B0A8',
        minWidth: 52, textAlign: 'right',
      }}>
        {EL[a.time_type] ?? a.time_type}
      </span>

      {/* Pause / Resume button */}
      {canToggle && (
        <button
          onClick={e => { e.stopPropagation(); onTogglePause() }}
          disabled={toggling}
          title={isActive ? 'Pause this activity' : 'Resume this activity'}
          style={{
            padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
            border: `1px solid ${isActive ? '#E0DDD6' : '#5A9E6F'}`,
            background: isActive ? 'transparent' : '#5A9E6F15',
            color: isActive ? '#8A857D' : '#5A9E6F',
            cursor: toggling ? 'default' : 'pointer',
            opacity: toggling ? 0.5 : 1,
            fontFamily: 'inherit', flexShrink: 0,
          }}
        >
          {isActive ? 'Pause' : 'Resume'}
        </button>
      )}
    </div>
  )
}
