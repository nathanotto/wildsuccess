'use client'
import { useState, useRef } from 'react'
import { UserValue, LifeDomain, BigOutcome, Activity } from '@/lib/types'

interface Props {
  values: UserValue[]
  activities: Activity[]
  outcomes: BigOutcome[]
  overdueActivityIds: string[]
  displayName: string
  onEditValue: (v: UserValue) => void
  onEditActivity: (a: Activity) => void
  onEditOutcome: (o: BigOutcome) => void
  onAddValue: () => void
  onAddActivity: () => void
  onAddOutcome: () => void
  onShowReference: () => void
  onShowActivities: () => void
  missionsByOutcome?: Record<string, string>
}

const CX = 500
const CY = 255

function valueNodeColor(v: UserValue) {
  if (v.score < v.sufficiency_mark) return { fill: '#D4564E', stroke: '#B8443E', bg: '#D4564E18' }
  if (v.score >= 8) return { fill: '#3A7CB8', stroke: '#2D6AA0', bg: '#3A7CB818' }
  return { fill: '#5A9E6F', stroke: '#4A8B5E', bg: '#5A9E6F18' }
}

function curvePath(x1: number, y1: number, x2: number, y2: number, curvature = 0.15) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const cx = mx - dy * curvature
  const cy = my + dx * curvature
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
}

function computeValueLayout(
  values: UserValue[],
  overrides: Record<string, { x: number; y: number }>
): Record<string, { x: number; y: number }> {
  const protect = values.filter(v => v.value_type === 'preventive')
  const expand = values.filter(v => v.value_type === 'promotional')
  const positions: Record<string, { x: number; y: number }> = {}
  const innerRadius = 185
  const outerRadius = 245

  protect.forEach((v, i) => {
    if (overrides[v.id]) { positions[v.id] = overrides[v.id]; return }
    const angle = (Math.PI * 0.72) + (protect.length > 1 ? (i / (protect.length - 1)) * (Math.PI * 0.56) : Math.PI * 0.28)
    const r = i % 2 === 0 ? innerRadius : outerRadius
    positions[v.id] = { x: CX + Math.cos(angle) * r, y: CY + Math.sin(angle) * r * 0.85 }
  })

  expand.forEach((v, i) => {
    if (overrides[v.id]) { positions[v.id] = overrides[v.id]; return }
    const angle = (Math.PI * -0.28) + (expand.length > 1 ? (i / (expand.length - 1)) * (Math.PI * 0.56) : Math.PI * 0.28)
    const r = i % 2 === 0 ? innerRadius : outerRadius
    positions[v.id] = { x: CX + Math.cos(angle) * r, y: CY + Math.sin(angle) * r * 0.85 }
  })

  return positions
}

function computeActivityLayout(
  activities: Activity[],
  valueLayout: Record<string, { x: number; y: number }>
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}
  const clusters: Record<string, Activity[]> = {}

  activities.forEach(a => {
    const primaryValueId = a.value_links?.[0]?.value_id
    if (!primaryValueId) return
    if (!clusters[primaryValueId]) clusters[primaryValueId] = []
    clusters[primaryValueId].push(a)
  })

  Object.entries(clusters).forEach(([vid, acts]) => {
    const vPos = valueLayout[vid]
    if (!vPos) return
    const dx = vPos.x - CX
    const dy = vPos.y - CY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const nx = dx / dist
    const ny = dy / dist
    const px = -ny
    const py = nx
    const branchDist = 85
    const spread = 32

    acts.forEach((a, i) => {
      const offset = (i - (acts.length - 1) / 2) * spread
      positions[a.id] = {
        x: Math.max(24, Math.min(976, vPos.x + nx * branchDist + px * offset)),
        y: Math.max(24, Math.min(556, vPos.y + ny * branchDist + py * offset)),
      }
    })
  })

  return positions
}

export default function WildSuccessMapSVG({
  values, activities, outcomes, overdueActivityIds, displayName,
  onEditValue, onEditActivity, onEditOutcome, onAddValue, onAddActivity, onAddOutcome, onShowReference, onShowActivities,
  missionsByOutcome = {},
}: Props) {
  const [selectedValue, setSelectedValue] = useState<UserValue | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [selectedOutcome, setSelectedOutcome] = useState<BigOutcome | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  // Drag state
  const svgRef = useRef<SVGSVGElement>(null)
  const [posOverrides, setPosOverrides] = useState<Record<string, { x: number; y: number }>>(() =>
    Object.fromEntries(values.filter(v => v.position_x != null).map(v => [v.id, { x: v.position_x!, y: v.position_y! }]))
  )
  const dragging = useRef<{ id: string; ox: number; oy: number } | null>(null)

  function svgPoint(e: React.MouseEvent): { x: number; y: number } | null {
    if (!svgRef.current) return null
    const pt = svgRef.current.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse())
    return { x: svgP.x, y: svgP.y }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return
    const pt = svgPoint(e)
    if (!pt) return
    const x = Math.max(30, Math.min(970, pt.x - dragging.current.ox))
    const y = Math.max(30, Math.min(550, pt.y - dragging.current.oy))
    setPosOverrides(prev => ({ ...prev, [dragging.current!.id]: { x, y } }))
  }

  function handleMouseUp() {
    if (!dragging.current) return
    const { id } = dragging.current
    dragging.current = null
    setPosOverrides(prev => {
      const pos = prev[id]
      if (pos) {
        fetch(`/api/values/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position_x: pos.x, position_y: pos.y }),
        })
      }
      return prev
    })
  }

  const protect = values.filter(v => v.value_type === 'preventive')
  const expand = values.filter(v => v.value_type === 'promotional')
  const protectAvg = protect.length > 0 ? protect.reduce((s, v) => s + v.score, 0) / protect.length : 0
  const expandAvg = expand.length > 0 ? expand.reduce((s, v) => s + v.score, 0) / expand.length : 0

  const visibleActivities = activities.filter(a => a.status === 'active' || a.status === 'aspirational')
  const valueLayout = computeValueLayout(values, posOverrides)
  const activityLayout = computeActivityLayout(visibleActivities, valueLayout)

  const hlValues = selectedActivity
    ? (selectedActivity.value_links?.map(l => l.value_id) ?? [])
    : selectedValue ? [selectedValue.id] : []

  const hlActivities = selectedValue
    ? visibleActivities.filter(a => a.value_links?.some(l => l.value_id === selectedValue.id)).map(a => a.id)
    : selectedActivity ? [selectedActivity.id] : []

  const hlOutcomeActivities = selectedOutcome
    ? visibleActivities.filter(a => a.big_outcome_id === selectedOutcome.id).map(a => a.id)
    : []

  const getHighestLeverage = () => {
    const below = values.filter(v => v.score < v.sufficiency_mark).sort((a, b) => a.score - b.score)
    if (below.length === 0) return 'All values at sufficiency'
    return `Focus: get ${below[0].name} to sufficiency`
  }

  // Big outcomes row layout
  const outcomeBoxW = 155
  const outcomeBoxH = 52
  const outcomeY = 505
  const totalOutcomeW = outcomes.length * outcomeBoxW + (outcomes.length - 1) * 10
  const outcomeStartX = CX - totalOutcomeW / 2

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1000 580"
      style={{ width: '100%', height: 'auto', maxWidth: 'min(1400px, calc((100vh - 160px) * 1.724))' }}
      onClick={() => { setSelectedValue(null); setSelectedActivity(null); setSelectedOutcome(null) }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={e => { if (dragging.current) e.preventDefault() }}
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <style>{`
          @keyframes pulse { 0%,100% { r: 6; } 50% { r: 8; } }
          .overdue-dot { animation: pulse 2s ease-in-out infinite; }
        `}</style>
      </defs>

      {/* PROTECT / EXPAND labels */}
      <text x={CX - 310} y={38} textAnchor="middle" fontSize={10} fontWeight={700} fill="#9E6A46" letterSpacing="2" opacity={0.5}>PROTECT</text>
      <text x={CX + 310} y={38} textAnchor="middle" fontSize={10} fontWeight={700} fill="#4B82AF" letterSpacing="2" opacity={0.5}>EXPAND</text>
      <text
        x={CX - 310} y={52} textAnchor="middle" fontSize={9} fill="#9E6A46" opacity={0.45}
        style={{ cursor: 'pointer', textDecoration: 'underline' }}
        onClick={onShowReference}
      >Reference</text>
      <text
        x={CX - 310} y={64} textAnchor="middle" fontSize={9} fill="#9E6A46" opacity={0.45}
        style={{ cursor: 'pointer', textDecoration: 'underline' }}
        onClick={onShowActivities}
      >Activities</text>

      {/* Lines: center → values */}
      {values.map(v => {
        const vp = valueLayout[v.id]
        if (!vp) return null
        const vc = valueNodeColor(v)
        const hl = hlValues.includes(v.id)
        return (
          <path key={`c-${v.id}`}
            d={curvePath(CX, CY, vp.x, vp.y, v.value_type === 'preventive' ? 0.08 : -0.08)}
            fill="none"
            stroke={hl ? vc.stroke : v.value_type === 'preventive' ? '#C4A882' : '#82ABC4'}
            strokeWidth={hl ? 2.5 : 1.5}
            strokeOpacity={hl ? 0.6 : 0.15}
          />
        )
      })}

      {/* Lines: values → activities */}
      {visibleActivities.map(a => {
        const ap = activityLayout[a.id]
        if (!ap) return null
        return a.value_links?.map(link => {
          const vp = valueLayout[link.value_id]
          if (!vp) return null
          const v = values.find(v => v.id === link.value_id)
          if (!v) return null
          const vc = valueNodeColor(v)
          const hl = (hlValues.includes(link.value_id) && hlActivities.includes(a.id)) || hlOutcomeActivities.includes(a.id)
          const hov = hoveredNode === a.id
          return (
            <line key={`${a.id}-${link.value_id}`}
              x1={vp.x} y1={vp.y} x2={ap.x} y2={ap.y}
              stroke={hl || hov ? vc.stroke : '#DDD8D0'}
              strokeWidth={hl || hov ? 1.8 : 0.7}
              strokeOpacity={hl || hov ? 0.5 : 0.2}
            />
          )
        })
      })}

      {/* Cross-links (secondary values) */}
      {visibleActivities.filter(a => (a.value_links?.length ?? 0) > 1).map(a => {
        const ap = activityLayout[a.id]
        if (!ap) return null
        return a.value_links?.slice(1).map(link => {
          const vp = valueLayout[link.value_id]
          if (!vp) return null
          const hl = hlActivities.includes(a.id)
          return (
            <line key={`cross-${a.id}-${link.value_id}`}
              x1={ap.x} y1={ap.y} x2={vp.x} y2={vp.y}
              stroke={hl ? '#8A857880' : '#E8E4DC'}
              strokeWidth={hl ? 1.2 : 0.5}
              strokeOpacity={hl ? 0.4 : 0.12}
              strokeDasharray={hl ? 'none' : '3 3'}
            />
          )
        })
      })}

      {/* Dashed lines from activities to their outcome boxes */}
      {visibleActivities.map(a => {
        const ap = activityLayout[a.id]
        if (!ap || !a.big_outcome_id) return null
        const oIdx = outcomes.findIndex(o => o.id === a.big_outcome_id)
        if (oIdx < 0) return null
        const ox = outcomeStartX + oIdx * (outcomeBoxW + 10) + outcomeBoxW / 2
        const oy = outcomeY
        const hl = hlOutcomeActivities.includes(a.id) || hlActivities.includes(a.id)
        return (
          <line key={`ao-${a.id}`}
            x1={ap.x} y1={ap.y} x2={ox} y2={oy}
            stroke={hl ? '#C4725A' : '#E8E4DC'}
            strokeWidth={hl ? 1.2 : 0.5}
            strokeOpacity={hl ? 0.5 : 0.15}
            strokeDasharray="4 4"
          />
        )
      })}

      {/* CENTER NODE */}
      <circle cx={CX} cy={CY} r={52} fill="#FFFFFF" stroke="#E8E4DC" strokeWidth={2} />
      <path d={`M ${CX} ${CY - 42} A 42 42 0 0 0 ${CX} ${CY + 42}`}
        fill="none" stroke="#9E6A46" strokeWidth={5} strokeOpacity={protectAvg / 10} strokeLinecap="round" />
      <path d={`M ${CX} ${CY - 42} A 42 42 0 0 1 ${CX} ${CY + 42}`}
        fill="none" stroke="#4B82AF" strokeWidth={5} strokeOpacity={expandAvg / 10} strokeLinecap="round" />
      <text x={CX} y={CY - 8} textAnchor="middle" fontSize={14} fontWeight={700} fill="#2D2A26">{displayName}</text>
      <text x={CX - 18} y={CY + 10} textAnchor="middle" fontSize={9} fontWeight={600} fill="#9E6A46">{protectAvg.toFixed(1)}</text>
      <text x={CX + 18} y={CY + 10} textAnchor="middle" fontSize={9} fontWeight={600} fill="#4B82AF">{expandAvg.toFixed(1)}</text>
      <text x={CX} y={CY + 26} textAnchor="middle" fontSize={7.5} fontWeight={500} fill="#C4504A" opacity={0.8}>{getHighestLeverage()}</text>

      {/* VALUE NODES */}
      {values.map(v => {
        const vp = valueLayout[v.id]
        if (!vp) return null
        const vc = valueNodeColor(v)
        const r = 26 + (v.score / 10) * 18
        const isSel = selectedValue?.id === v.id
        const isHl = hlValues.includes(v.id)
        const below = v.score < v.sufficiency_mark
        const actCount = visibleActivities.filter(a => a.value_links?.some(l => l.value_id === v.id)).length

        return (
          <g key={v.id}
            onClick={(e) => {
              e.stopPropagation()
              setSelectedValue(selectedValue?.id === v.id ? null : v)
              setSelectedActivity(null)
              setSelectedOutcome(null)
            }}
            onDoubleClick={(e) => { e.stopPropagation(); onEditValue(v) }}
            onMouseDown={(e) => {
              const isRightClick = e.button === 2 || (e.button === 0 && e.ctrlKey)
              if (!isRightClick) return
              e.preventDefault()
              e.stopPropagation()
              const pt = svgPoint(e)
              if (!pt) return
              dragging.current = { id: v.id, ox: pt.x - vp.x, oy: pt.y - vp.y }
            }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation() }}
            onMouseEnter={() => setHoveredNode(`v${v.id}`)}
            onMouseLeave={() => setHoveredNode(null)}
            style={{ cursor: dragging.current?.id === v.id ? 'grabbing' : 'pointer' }}
          >
            {(isSel || isHl) && (
              <circle cx={vp.x} cy={vp.y} r={r + 6} fill="none" stroke={vc.stroke} strokeWidth={1.5} strokeOpacity={0.3} filter="url(#glow)" />
            )}
            <circle cx={vp.x} cy={vp.y} r={r} fill={vc.bg} stroke={vc.stroke} strokeWidth={isSel ? 2.5 : 1.5} strokeOpacity={isSel ? 0.8 : 0.5} />
            <text x={vp.x} y={vp.y - 2} textAnchor="middle" dominantBaseline="central" fontSize={r * 0.55} fontWeight={700} fill={vc.fill} opacity={0.9}>{v.score}</text>
            {Array.from({ length: Math.min(actCount, 6) }, (_, i) => {
              const dotAngle = (Math.PI * 0.6) + (i / Math.max(actCount - 1, 1)) * (Math.PI * 0.8)
              return <circle key={i} cx={vp.x + Math.cos(dotAngle) * (r + 6)} cy={vp.y + Math.sin(dotAngle) * (r + 6)} r={2} fill={vc.fill} opacity={0.4} />
            })}
            <text x={vp.x} y={vp.y + r + 13} textAnchor="middle" fontSize={10} fontWeight={700} fill={below ? '#C4504A' : '#2D2A26'}>{v.name}</text>
            <text x={vp.x} y={vp.y + r + 24} textAnchor="middle" fontSize={7.5} fontWeight={600} fill={below ? '#C4504A' : v.score >= 8 ? '#2D6AA0' : '#4A8B5E'}>
              {below ? 'Needs attention' : v.score >= 8 ? 'Abundant' : 'Handled'}
            </text>
          </g>
        )
      })}

      {/* ACTIVITY NODES */}
      {visibleActivities.map(a => {
        const ap = activityLayout[a.id]
        if (!ap) return null
        const isOverdue = overdueActivityIds.includes(a.id)
        const isHl = hlActivities.includes(a.id) || hlOutcomeActivities.includes(a.id)
        const isSel = selectedActivity?.id === a.id
        const isHov = hoveredNode === a.id

        return (
          <g key={a.id}
            onClick={(e) => {
              e.stopPropagation()
              setSelectedActivity(selectedActivity?.id === a.id ? null : a)
              setSelectedValue(null)
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
              fill={isOverdue ? '#C4504A' : isHl || isSel || isHov ? '#8A8578' : '#C4BFB4'}
              stroke={isSel ? '#2D2A26' : 'none'} strokeWidth={1.5}
              className={isOverdue ? 'overdue-dot' : ''}
            />
            {(isHl || isSel || isHov) && (
              <text x={ap.x} y={ap.y - 10} textAnchor="middle" fontSize={8} fontWeight={isOverdue ? 700 : 500} fill={isOverdue ? '#C4504A' : '#2D2A26'}>
                {a.name}
              </text>
            )}
          </g>
        )
      })}

      {/* Always-visible labels for all activities */}
      {visibleActivities.map(a => {
        const ap = activityLayout[a.id]
        if (!ap) return null
        // Skip if already showing a brighter label from hover/select/highlight
        if (hlActivities.includes(a.id) || hlOutcomeActivities.includes(a.id) || selectedActivity?.id === a.id || hoveredNode === a.id) return null
        const isOverdue = overdueActivityIds.includes(a.id)
        return (
          <text key={`lbl-${a.id}`} x={ap.x} y={ap.y - 10} textAnchor="middle"
            fontSize={7} fontWeight={isOverdue ? 600 : 400}
            fill={isOverdue ? '#C4504A' : '#8A8578'} opacity={isOverdue ? 0.7 : 0.45}
          >
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
            const hasPlan = !!missionsByOutcome[o.id]
            const extraLines = (needsActivities ? 1 : 0) + (hasPlan ? 1 : 0)
            const boxH = outcomeBoxH + extraLines * 12
            return (
              <g key={o.id}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedOutcome(selectedOutcome?.id === o.id ? null : o)
                  setSelectedValue(null)
                  setSelectedActivity(null)
                }}
                onDoubleClick={(e) => { e.stopPropagation(); onEditOutcome(o) }}
                style={{ cursor: 'pointer' }}
              >
                <rect x={ox} y={outcomeY} width={outcomeBoxW} height={boxH} rx={12}
                  fill="#FFFFFF" stroke={isSel ? '#C4725A' : '#E8E4DC'} strokeWidth={isSel ? 1.5 : 1}
                />
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
                {missionsByOutcome[o.id] && (
                  <text
                    x={ox + outcomeBoxW / 2}
                    y={outcomeY + (needsActivities ? 54 : 44)}
                    textAnchor="middle" fontSize={8} fontWeight={600} fill="#C4725A"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); window.location.href = `/plan/${missionsByOutcome[o.id]}` }}
                  >
                    Plan →
                  </text>
                )}
              </g>
            )
          })}
        </>
      )}

      {/* Add buttons */}
      <g onClick={(e) => { e.stopPropagation(); onAddActivity() }} style={{ cursor: 'pointer' }}>
        <circle cx={CX + 310} cy={58} r={12} fill="#F8F7F4" stroke="#E8E4DC" strokeWidth={1} />
        <text x={CX + 310} y={62} textAnchor="middle" fontSize={16} fill="#8A8578" fontWeight={300}>+</text>
        <text x={CX + 310} y={80} textAnchor="middle" fontSize={7} fill="#8A8578">activity</text>
      </g>
      <g onClick={(e) => { e.stopPropagation(); onAddOutcome() }} style={{ cursor: 'pointer' }}>
        <circle cx={CX + 310} cy={98} r={12} fill="#F8F7F4" stroke="#E8E4DC" strokeWidth={1} />
        <text x={CX + 310} y={102} textAnchor="middle" fontSize={16} fill="#8A8578" fontWeight={300}>+</text>
        <text x={CX + 310} y={120} textAnchor="middle" fontSize={7} fill="#8A8578">outcome</text>
      </g>
      <g onClick={(e) => { e.stopPropagation(); onAddValue() }} style={{ cursor: 'pointer' }}>
        <circle cx={CX + 310} cy={138} r={12} fill="#F8F7F4" stroke="#E8E4DC" strokeWidth={1} />
        <text x={CX + 310} y={142} textAnchor="middle" fontSize={16} fill="#8A8578" fontWeight={300}>+</text>
        <text x={CX + 310} y={160} textAnchor="middle" fontSize={7} fill="#8A8578">value</text>
      </g>
    </svg>
  )
}
