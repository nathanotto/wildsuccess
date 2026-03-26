'use client'
import { useRouter, usePathname } from 'next/navigation'

const FONT = "'Source Sans 3', 'Source Sans Pro', sans-serif"

const PERIODS = [
  { key: 'days', label: 'Days', href: '/review/days' },
  { key: 'week', label: 'Week', href: '/review/weekflow' },
  { key: 'month', label: 'Month', href: '/review/month' },
  { key: 'quarter', label: 'Quarter', href: '/review/quarter' },
  { key: 'year', label: 'Year', href: '/review/year' },
]

export default function ReviewSubNav() {
  const router = useRouter()
  const pathname = usePathname()
  const activePeriod = PERIODS.find(p => pathname.startsWith(p.href))?.key ?? 'days'

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', gap: 4, padding: '12px 0 8px',
      fontFamily: FONT,
    }}>
      {PERIODS.map(p => {
        const isActive = p.key === activePeriod
        return (
          <button
            key={p.key}
            onClick={() => router.push(p.href)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontFamily: FONT, padding: '2px 8px',
              fontWeight: isActive ? 700 : 400,
              color: isActive ? '#2D2A26' : '#B5B0A8',
              textDecoration: isActive ? 'underline' : 'none',
              textUnderlineOffset: 4,
            }}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
