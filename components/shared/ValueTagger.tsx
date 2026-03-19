'use client'
import { UserValue } from '@/lib/types'

interface Props {
  values: UserValue[]
  selected: string[]
  onChange: (ids: string[]) => void
  compact?: boolean
}

export default function ValueTagger({ values, selected, onChange, compact }: Props) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(v => v !== id) : [...selected, id])
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {values.map(v => {
        const active = selected.includes(v.id)
        return (
          <button
            key={v.id}
            onClick={() => toggle(v.id)}
            style={{
              padding: compact ? '2px 7px' : '3px 9px',
              borderRadius: 10,
              fontSize: compact ? 10 : 11,
              fontFamily: 'inherit',
              cursor: 'pointer',
              border: `1px solid ${active ? '#9E6A46' : '#E8E4DC'}`,
              background: active ? '#9E6A4615' : 'transparent',
              color: active ? '#9E6A46' : '#B5B0A8',
              fontWeight: active ? 600 : 400,
              transition: 'all 0.1s',
            }}
          >
            {v.name}
          </button>
        )
      })}
    </div>
  )
}
