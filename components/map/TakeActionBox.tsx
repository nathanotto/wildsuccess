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
    <div style={{ padding: '12px 0' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#8A857D', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, paddingLeft: 4 }}>
        Take Action
      </div>
      {suggestions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {suggestions.map((s, i) => (
            <div key={i} style={{
              padding: '8px 10px', borderRadius: 8,
              background: s.type === 'overdue' ? '#FDF5F4' : '#F8F7F4',
              border: `1px solid ${s.type === 'overdue' ? '#C4504A20' : '#E8E4DC'}`,
              fontSize: 11, lineHeight: 1.4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 10 }}>{s.type === 'overdue' ? '📅' : '✦'}</span>
                <span style={{ fontWeight: 600, color: '#2D2A26' }}>{s.text}</span>
              </div>
              <div style={{ color: '#8A8578', fontSize: 10, marginTop: 2, paddingLeft: 17 }}>
                {s.value.name} ({s.value.score}/{s.value.sufficiency_mark})
              </div>
            </div>
          ))}
        </div>
      ) : below.length === 0 ? (
        <div style={{ fontSize: 11, color: '#B5B0A8', padding: '8px 4px' }}>
          All values at sufficiency.
        </div>
      ) : null}
    </div>
  )
}
