'use client'
import { useState } from 'react'
import { UserValue, LifeDomain, Activity, BigOutcome } from '@/lib/types'

interface Props {
  values: UserValue[]
  domains: LifeDomain[]
  activities: Activity[]
  outcomes: BigOutcome[]
  overdueActivityIds: string[]
  displayName: string
  onEditDomain: (d: LifeDomain) => void
  onEditActivity: (a: Activity) => void
  onEditOutcome: (o: BigOutcome) => void
  onAddActivity: () => void
  onAddDomain: () => void
  onAddOutcome: () => void
}

const CX = 500
const CY = 255

// 8 distinct colors for up to 8 values; cycles if more
const VALUE_COLORS = [
  '#C4725A', '#4B82AF', '#5A9E6F', '#9E6A46',
  '#8B7CB8', '#E09B3D', '#5BADA0', '#C97B8E',
]

function curvePath(x1: number, y1: number, x2: number, y2: number, curvature = 0.12) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const cx = mx - dy * curvature
  const cy = my + dx * curvature
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
}

function computeDomainLayout(domains: LifeDomain[]): Record<string, { x: number; y: number }> {
  const sorted = [...domains].sort((a, b) => a.sort_order - b.sort_order)
  const half = Math.ceil(sorted.length / 2)
  const left = sorted.slice(0, half)
  const right = sorted.slice(half)
  const positions: Record<string, { x: number; y: number }> = {}
  const innerRadius = 190
  const outerRadius = 250

  left.forEach((d, i) => {
    const angle = (Math.PI * 0.72) + (left.length > 1 ? (i / (left.length - 1)) * (Math.PI * 0.56) : Math.PI * 0.28)
    const r = i % 2 === 0 ? innerRadius : outerRadius
    positions[d.id] = { x: CX + Math.cos(angle) * r, y: CY + Math.sin(angle) * r * 0.85 }
  })

  right.forEach((d, i) => {
    const angle = (Math.PI * -0.28) + (right.length > 1 ? (i / (right.length - 1)) * (Math.PI * 0.56) : Math.PI * 0.28)
    const r = i % 2 === 0 ? innerRadius : outerRadius
    positions[d.id] = { x: CX + Math.cos(angle) * r, y: CY + Math.sin(angle) * r * 0.85 }
  })

  return positions
}

function computeActivityLayout(
  activities: Activity[],
  domainLayout: Record<string, { x: number; y: number }>
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}
  const clusters: Record<string, Activity[]> = {}

  activities.forEach(a => {
    const primaryDomainId = a.domain_links?.[0]?.domain_id
    if (!primaryDomainId) return
    if (!clusters[primaryDomainId]) clusters[primaryDomainId] = []
    clusters[primaryDomainId].push(a)
  })

  Object.entries(clusters).forEach(([did, acts]) => {
    const dPos = domainLayout[did]
    if (!dPos) return
    const dx = dPos.x - CX
    const dy = dPos.y - CY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const nx = dx / dist
    const ny = dy / dist
    const px = -ny
    const py = nx
    const branchDist = 80
    const spread = 28

    acts.forEach((a, i) => {
      const offset = (i - (acts.length - 1) / 2) * spread
      positions[a.id] = {
        x: dPos.x + nx * branchDist + px * offset,
        y: dPos.y + ny * branchDist + py * offset,
      }
    })
  })

  return positions
}

export default function LifeMapSVG({
  values, domains, activities, outcomes, overdueActivityIds, displayName,
  onEditDomain, onEditActivity, onEditOutcome, onAddActivity, onAddDomain, onAddOutcome,
}: Props) {
  const [selectedDomain, setSelectedDomain] = useState<LifeDomain | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [selectedOutcome, setSelectedOutcome] = useState<BigOutcome | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  const domainLayout = computeDomainLayout(domains)
  const activityLayout = computeActivityLayout(activities, domainLayout)

  // Value → color map
  const valueColorMap: Record<string, string> = {}
  values.forEach((v, i) => { valueColorMap[v.id] = VALUE_COLORS[i % VALUE_COLORS.length] })

  // Activity count per domain
  const actCountByDomain: Record<string, number> = {}
  activities.forEach(a => {
    a.domain_links?.forEach(dl => {
      actCountByDomain[dl.domain_id] = (actCountByDomain[dl.domain_id] ?? 0) + 1
    })
  })

  // Highlighted sets
  const hlDomains = selectedActivity
    ? (selectedActivity.domain_links?.map(l => l.domain_id) ?? [])
    : selectedDomain ? [selectedDomain.id] : []

  const hlActivities = selectedDomain
    ? activities.filter(a => a.domain_links?.some(l => l.domain_id === selectedDomain.id)).map(a => a.id)
    : selectedActivity ? [selectedActivity.id] : []

  const hlOutcomeActivities = selectedOutcome
    ? activities.filter(a => a.big_outcome_id === selectedOutcome.id).map(a => a.id)
    : []

  // Big outcomes row layout
  const outcomeBoxW = 155
  const outcomeBoxH = 52
  const outcomeY = 505
  const totalOutcomeW = outcomes.length * outcomeBoxW + (outcomes.length - 1) * 10
  const outcomeStartX = CX - totalOutcomeW / 2

  // Center stats: domains with ≥1 activity
  const sorted = [...domains].sort((a, b) => a.sort_order - b.sort_order)
  const half = Math.ceil(sorted.length / 2)
  const leftDomains = sorted.slice(0, half)
  const rightDomains = sorted.slice(half)
  const leftActive = leftDomains.filter(d => (actCountByDomain[d.id] ?? 0) > 0).length
  const rightActive = rightDomains.filter(d => (actCountByDomain[d.id] ?? 0) > 0).length
  const leftCoverage = leftDomains.length > 0 ? leftActive / leftDomains.length : 0
  const rightCoverage = rightDomains.length > 0 ? rightActive / rightDomains.length : 0

  return (
    <svg
      viewBox="0 0 1000 580"
      style={{ width: '100%', height: 'auto', maxWidth: 'min(1400px, calc((100vh - 160px) * 1.724))' }}
      onClick={() => { setSelectedDomain(null); setSelectedActivity(null); setSelectedOutcome(null) }}
    >
      <defs>
        <filter id="glow-life">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <style>{`
          @keyframes pulse-life { 0%,100% { r: 6; } 50% { r: 8; } }
          .overdue-dot-life { animation: pulse-life 2s ease-in-out infinite; }
        `}</style>
      </defs>

      {/* SUSTAINING / FLOURISHING labels */}
      <text x={CX - 310} y={38} textAnchor="middle" fontSize={10} fontWeight={700} fill="#9E6A46" letterSpacing="2" opacity={0.5}>SUSTAINING</text>
      <text x={CX + 310} y={38} textAnchor="middle" fontSize={10} fontWeight={700} fill="#4B82AF" letterSpacing="2" opacity={0.5}>FLOURISHING</text>

      {/* Lines: center → domains */}
      {domains.map(d => {
        const dp = domainLayout[d.id]
        if (!dp) return null
        const hl = hlDomains.includes(d.id)
        const isLeft = leftDomains.some(ld => ld.id === d.id)
        return (
          <path key={`c-${d.id}`}
            d={curvePath(CX, CY, dp.x, dp.y, isLeft ? 0.08 : -0.08)}
            fill="none"
            stroke={isLeft ? '#C4A882' : '#82ABC4'}
            strokeWidth={hl ? 2.5 : 1.5}
            strokeOpacity={hl ? 0.5 : 0.12}
          />
        )
      })}

      {/* Lines: domain → activities (primary) */}
      {activities.map(a => {
        const ap = activityLayout[a.id]
        if (!ap) return null
        const primaryDomainId = a.domain_links?.[0]?.domain_id
        if (!primaryDomainId) return null
        const dp = domainLayout[primaryDomainId]
        if (!dp) return null
        const hl = (hlDomains.includes(primaryDomainId) && hlActivities.includes(a.id)) || hlOutcomeActivities.includes(a.id)
        const hov = hoveredNode === a.id
        return (
          <line key={`da-${a.id}`}
            x1={dp.x} y1={dp.y} x2={ap.x} y2={ap.y}
            stroke={hl || hov ? '#8A8578' : '#DDD8D0'}
            strokeWidth={hl || hov ? 1.8 : 0.7}
            strokeOpacity={hl || hov ? 0.5 : 0.2}
          />
        )
      })}

      {/* Dashed lines from activities to their outcome boxes */}
      {activities.map(a => {
        const ap = activityLayout[a.id]
        if (!ap || !a.big_outcome_id) return null
        const oIdx = outcomes.findIndex(o => o.id === a.big_outcome_id)
        if (oIdx < 0) return null
        const ox = outcomeStartX + oIdx * (outcomeBoxW + 10) + outcomeBoxW / 2
        const hl = hlOutcomeActivities.includes(a.id) || hlActivities.includes(a.id)
        return (
          <line key={`ao-${a.id}`}
            x1={ap.x} y1={ap.y} x2={ox} y2={outcomeY}
            stroke={hl ? '#C4725A' : '#E8E4DC'}
            strokeWidth={hl ? 1.2 : 0.5}
            strokeOpacity={hl ? 0.5 : 0.15}
            strokeDasharray="4 4"
          />
        )
      })}

      {/* Dashed lines to secondary domains */}
      {activities.filter(a => (a.domain_links?.length ?? 0) > 1).map(a => {
        const ap = activityLayout[a.id]
        if (!ap) return null
        return a.domain_links?.slice(1).map(dl => {
          const dp = domainLayout[dl.domain_id]
          if (!dp) return null
          const hl = hlActivities.includes(a.id)
          return (
            <line key={`cross-${a.id}-${dl.domain_id}`}
              x1={ap.x} y1={ap.y} x2={dp.x} y2={dp.y}
              stroke={hl ? '#8A857880' : '#E8E4DC'}
              strokeWidth={hl ? 1.2 : 0.5}
              strokeOpacity={hl ? 0.4 : 0.12}
              strokeDasharray={hl ? 'none' : '3 3'}
            />
          )
        })
      })}

      {/* CENTER NODE */}
      <circle cx={CX} cy={CY} r={52} fill="#FFFFFF" stroke="#E8E4DC" strokeWidth={2} />
      <path d={`M ${CX} ${CY - 42} A 42 42 0 0 0 ${CX} ${CY + 42}`}
        fill="none" stroke="#9E6A46" strokeWidth={5} strokeOpacity={leftCoverage} strokeLinecap="round" />
      <path d={`M ${CX} ${CY - 42} A 42 42 0 0 1 ${CX} ${CY + 42}`}
        fill="none" stroke="#4B82AF" strokeWidth={5} strokeOpacity={rightCoverage} strokeLinecap="round" />
      <text x={CX} y={CY - 8} textAnchor="middle" fontSize={14} fontWeight={700} fill="#2D2A26">{displayName}</text>
      <text x={CX - 18} y={CY + 10} textAnchor="middle" fontSize={9} fontWeight={600} fill="#9E6A46">{leftActive}/{leftDomains.length}</text>
      <text x={CX + 18} y={CY + 10} textAnchor="middle" fontSize={9} fontWeight={600} fill="#4B82AF">{rightActive}/{rightDomains.length}</text>
      <text x={CX} y={CY + 26} textAnchor="middle" fontSize={7.5} fontWeight={500} fill="#8A8578" opacity={0.8}>domains active</text>

      {/* DOMAIN NODES */}
      {domains.map(d => {
        const dp = domainLayout[d.id]
        if (!dp) return null
        const actCount = actCountByDomain[d.id] ?? 0
        const r = 28 + Math.min(actCount, 8) * 1.8
        const isSel = selectedDomain?.id === d.id
        const isHl = hlDomains.includes(d.id)
        const isLeft = leftDomains.some(ld => ld.id === d.id)
        const fillColor = isLeft ? '#9E6A4612' : '#4B82AF12'
        const strokeColor = isLeft ? '#9E6A46' : '#4B82AF'
        const empty = actCount === 0

        return (
          <g key={d.id}
            onClick={(e) => {
              e.stopPropagation()
              setSelectedDomain(selectedDomain?.id === d.id ? null : d)
              setSelectedActivity(null)
            }}
            onDoubleClick={(e) => { e.stopPropagation(); onEditDomain(d) }}
            onMouseEnter={() => setHoveredNode(`d${d.id}`)}
            onMouseLeave={() => setHoveredNode(null)}
            style={{ cursor: 'pointer' }}
          >
            {(isSel || isHl) && (
              <circle cx={dp.x} cy={dp.y} r={r + 6} fill="none" stroke={strokeColor} strokeWidth={1.5} strokeOpacity={0.3} filter="url(#glow-life)" />
            )}
            <circle cx={dp.x} cy={dp.y} r={r}
              fill={empty ? '#FAFAF7' : fillColor}
              stroke={strokeColor}
              strokeWidth={isSel ? 2.5 : 1.5}
              strokeOpacity={empty ? 0.2 : isSel ? 0.8 : 0.4}
              strokeDasharray={empty ? '4 3' : 'none'}
            />
            <text x={dp.x} y={dp.y + 4} textAnchor="middle" dominantBaseline="central"
              fontSize={actCount > 0 ? Math.min(r * 0.45, 13) : 11}
              fontWeight={600} fill={empty ? '#C4BFB4' : isLeft ? '#9E6A46' : '#4B82AF'} opacity={empty ? 0.6 : 0.9}>
              {actCount > 0 ? actCount : '·'}
            </text>
            <text x={dp.x} y={dp.y + r + 13} textAnchor="middle" fontSize={10} fontWeight={700}
              fill={empty ? '#C4BFB4' : '#2D2A26'}>
              {d.name}
            </text>
          </g>
        )
      })}

      {/* ACTIVITY NODES */}
      {activities.map(a => {
        const ap = activityLayout[a.id]
        if (!ap) return null
        const isOverdue = overdueActivityIds.includes(a.id)
        const isHl = hlActivities.includes(a.id) || hlOutcomeActivities.includes(a.id)
        const isSel = selectedActivity?.id === a.id
        const isHov = hoveredNode === a.id

        // Color by primary linked value
        const primaryValueId = a.value_links?.[0]?.value_id
        const dotColor = primaryValueId ? (valueColorMap[primaryValueId] ?? '#C4BFB4') : '#C4BFB4'

        return (
          <g key={a.id}
            onClick={(e) => {
              e.stopPropagation()
              setSelectedActivity(selectedActivity?.id === a.id ? null : a)
              setSelectedDomain(null)
              setSelectedOutcome(null)
            }}
            onDoubleClick={(e) => { e.stopPropagation(); onEditActivity(a) }}
            onMouseEnter={() => setHoveredNode(a.id)}
            onMouseLeave={() => setHoveredNode(null)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={ap.x} cy={ap.y}
              r={isOverdue ? 6 : 4.5}
              fill={isOverdue ? '#C4504A' : isHl || isSel || isHov ? dotColor : dotColor + '99'}
              stroke={isSel ? '#2D2A26' : isHl || isHov ? dotColor : 'none'}
              strokeWidth={1.5}
              className={isOverdue ? 'overdue-dot-life' : ''}
            />
            {(isHl || isSel || isHov) && (
              <text x={ap.x} y={ap.y - 10} textAnchor="middle" fontSize={8}
                fontWeight={isOverdue ? 700 : 500} fill={isOverdue ? '#C4504A' : '#2D2A26'}>
                {a.name}
              </text>
            )}
          </g>
        )
      })}

      {/* Always-visible overdue labels */}
      {activities.filter(a => overdueActivityIds.includes(a.id)).map(a => {
        const ap = activityLayout[a.id]
        if (!ap) return null
        if (hlActivities.includes(a.id) || selectedActivity?.id === a.id || hoveredNode === a.id) return null
        return (
          <text key={`lbl-${a.id}`} x={ap.x} y={ap.y - 10} textAnchor="middle" fontSize={7.5} fontWeight={600} fill="#C4504A" opacity={0.7}>
            {a.name}
          </text>
        )
      })}

      {/* BIG OUTCOMES ROW */}
      {outcomes.length > 0 && (
        <>
          <text x={CX} y={outcomeY - 14} textAnchor="middle" fontSize={10} fontWeight={700} fill="#2D2A26" letterSpacing="2" opacity={0.4}>BIG OUTCOMES</text>
          {outcomes.map((o, idx) => {
            const ox = outcomeStartX + idx * (outcomeBoxW + 10)
            const isSel = selectedOutcome?.id === o.id
            const needsActivities = (o.activity_count ?? 0) <= 1
            return (
              <g key={o.id}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedOutcome(selectedOutcome?.id === o.id ? null : o)
                  setSelectedDomain(null)
                  setSelectedActivity(null)
                }}
                onDoubleClick={(e) => { e.stopPropagation(); onEditOutcome(o) }}
                style={{ cursor: 'pointer' }}
              >
                <rect x={ox} y={outcomeY} width={outcomeBoxW} height={outcomeBoxH} rx={12}
                  fill="#FFFFFF" stroke={isSel ? '#C4725A' : '#E8E4DC'} strokeWidth={isSel ? 1.5 : 1} />
                <text x={ox + outcomeBoxW / 2} y={outcomeY + 18} textAnchor="middle" fontSize={10} fontWeight={700} fill="#2D2A26">
                  {o.name.length > 18 ? o.name.slice(0, 17) + '…' : o.name}
                </text>
                <text x={ox + outcomeBoxW / 2} y={outcomeY + 31} textAnchor="middle" fontSize={8} fill="#8A8578">
                  {o.status} · {o.activity_count ?? 0} {(o.activity_count ?? 0) === 1 ? 'activity' : 'activities'}
                </text>
                {needsActivities && (
                  <text x={ox + outcomeBoxW / 2} y={outcomeY + 44} textAnchor="middle" fontSize={7.5} fill="#C4504A">
                    Needs more activities
                  </text>
                )}
              </g>
            )
          })}
        </>
      )}

      {/* VALUE COLOR LEGEND */}
      {values.length > 0 && (
        <g>
          <text x={18} y={480} fontSize={8} fontWeight={700} fill="#8A8578" letterSpacing="1" opacity={0.7}>VALUES</text>
          {values.map((v, i) => (
            <g key={v.id}>
              <circle cx={24} cy={493 + i * 14} r={4} fill={VALUE_COLORS[i % VALUE_COLORS.length]} opacity={0.85} />
              <text x={33} y={497 + i * 14} fontSize={8.5} fill="#2D2A26" opacity={0.75}>{v.name}</text>
            </g>
          ))}
        </g>
      )}

      {/* Add buttons */}
      <g onClick={(e) => { e.stopPropagation(); onAddActivity() }} style={{ cursor: 'pointer' }}>
        <circle cx={CX + 310} cy={58} r={12} fill="#F8F7F4" stroke="#E8E4DC" strokeWidth={1} />
        <text x={CX + 310} y={62} textAnchor="middle" fontSize={16} fill="#8A8578" fontWeight={300}>+</text>
        <text x={CX + 310} y={80} textAnchor="middle" fontSize={7} fill="#8A8578">activity</text>
      </g>
      <g onClick={(e) => { e.stopPropagation(); onAddDomain() }} style={{ cursor: 'pointer' }}>
        <circle cx={CX + 310} cy={98} r={12} fill="#F8F7F4" stroke="#E8E4DC" strokeWidth={1} />
        <text x={CX + 310} y={102} textAnchor="middle" fontSize={16} fill="#8A8578" fontWeight={300}>+</text>
        <text x={CX + 310} y={120} textAnchor="middle" fontSize={7} fill="#8A8578">domain</text>
      </g>
      <g onClick={(e) => { e.stopPropagation(); onAddOutcome() }} style={{ cursor: 'pointer' }}>
        <circle cx={CX + 310} cy={138} r={12} fill="#F8F7F4" stroke="#E8E4DC" strokeWidth={1} />
        <text x={CX + 310} y={142} textAnchor="middle" fontSize={16} fill="#8A8578" fontWeight={300}>+</text>
        <text x={CX + 310} y={160} textAnchor="middle" fontSize={7} fill="#8A8578">outcome</text>
      </g>
    </svg>
  )
}
