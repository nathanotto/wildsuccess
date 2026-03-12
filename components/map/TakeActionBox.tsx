import { UserValue, Activity } from '@/lib/types'

interface Props {
  values: UserValue[]
  activities: Activity[]
  overdueActivityIds: string[]
}

export default function TakeActionBox({ values, activities, overdueActivityIds }: Props) {
  const below = values.filter(v => v.score < v.sufficiency_mark)

  const suggestions: Array<{ value: UserValue; type: 'overdue' | 'new'; text: string }> = below.flatMap(v => {
    const items: Array<{ value: UserValue; type: 'overdue' | 'new'; text: string }> = []
    const serving = activities.filter(a => a.value_links?.some(l => l.value_id === v.id))
    const overdue = serving.filter(a => overdueActivityIds.includes(a.id))
    if (overdue.length > 0) {
      items.push({ value: v, type: 'overdue', text: `Schedule ${overdue.map(a => a.name).join(', ')}` })
    }
    if (serving.length <= 2) {
      items.push({ value: v, type: 'new', text: `Add activities for ${v.name}` })
    }
    return items
  })

  return (
    <div style={{ padding: '14px 28px 36px', maxWidth: 800, margin: '0 auto' }}>
      {suggestions.length > 0 && (
        <div style={{
          border: '1.5px solid #E8E4DC', borderRadius: 16, background: '#FFFFFF',
          padding: '14px 18px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#2D2A26', marginBottom: 10 }}>Take Action</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {suggestions.map((s, i) => (
              <div key={i} style={{
                padding: '6px 12px', borderRadius: 8,
                background: s.type === 'overdue' ? '#FDF5F4' : '#F8F7F4',
                border: `1px solid ${s.type === 'overdue' ? '#C4504A20' : '#E8E4DC'}`,
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 10,
              }}>
                <span>{s.type === 'overdue' ? '📅' : '✦'}</span>
                <span style={{ fontWeight: 600 }}>{s.text}</span>
                <span style={{ color: '#8A8578' }}>→ {s.value.name} ({s.value.score}/{s.value.sufficiency_mark})</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {suggestions.length === 0 && below.length === 0 && (
        <div style={{ fontSize: 12, color: '#8A8578', textAlign: 'center', padding: '12px 0' }}>
          All values at or above sufficiency.
        </div>
      )}
    </div>
  )
}
