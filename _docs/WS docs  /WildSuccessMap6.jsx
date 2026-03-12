import { useState } from "react";

const VALUES = [
  { id: 1, name: "Safety", type: "protect", score: 7, sufficiencyMark: 4 },
  { id: 2, name: "Finances", type: "protect", score: 9, sufficiencyMark: 4 },
  { id: 3, name: "Health", type: "protect", score: 4, sufficiencyMark: 4 },
  { id: 4, name: "Belonging", type: "protect", score: 2, sufficiencyMark: 4 },
  { id: 5, name: "Freedom", type: "expand", score: 6, sufficiencyMark: 4 },
  { id: 6, name: "Expression", type: "expand", score: 8, sufficiencyMark: 4 },
  { id: 7, name: "Purpose", type: "expand", score: 7, sufficiencyMark: 4 },
  { id: 8, name: "Adventure", type: "expand", score: 3, sufficiencyMark: 4 },
];

const ACTIVITIES = [
  { id: "a1", name: "Making dinner", overdue: false, values: [1] },
  { id: "a2", name: "Running errands", overdue: false, values: [1, 2], preventive: true },
  { id: "a3", name: "Vibe coding", overdue: false, values: [6, 7] },
  { id: "a4", name: "DO meetings", overdue: false, values: [7] },
  { id: "a5", name: "Business trips", overdue: false, values: [7, 5] },
  { id: "a6", name: "Budget & bills", overdue: false, values: [2], preventive: true },
  { id: "a7", name: "Health appts", overdue: true, values: [3], preventive: true },
  { id: "a8", name: "Outings w/ Winston", overdue: false, values: [4, 7] },
  { id: "a9", name: "Legacy meetings", overdue: false, values: [7, 1] },
  { id: "a10", name: "Media w/ Winston", overdue: false, values: [4] },
  { id: "a11", name: "Media w/ Erin", overdue: false, values: [4] },
  { id: "a12", name: "Men's group", overdue: true, values: [4, 7] },
  { id: "a13", name: "Lunch dates", overdue: true, values: [4, 5] },
  { id: "a14", name: "Travel planning", overdue: false, values: [8, 5] },
  { id: "a15", name: "Reading news", overdue: false, values: [5] },
];

const BIG_OUTCOMES = [
  { id: "bo1", name: "Launch Pine Creek", values: [2, 7] },
  { id: "bo2", name: "Build Wild Success", values: [6, 7, 5] },
  { id: "bo3", name: "Secure DO funding", values: [7, 2] },
  { id: "bo4", name: "Place in Boulder", values: [8, 5] },
  { id: "bo5", name: "Security for Erin", values: [1, 2, 4] },
];

// Center of the map
const CX = 580;
const CY = 400;

// Value positions — protect on left, expand on right, arced around center
const VALUE_LAYOUT = (() => {
  const protect = VALUES.filter(v => v.type === "protect");
  const expand = VALUES.filter(v => v.type === "expand");
  const positions = {};
  const radius = 260;

  protect.forEach((v, i) => {
    const angle = (Math.PI * 0.62) + (i / (protect.length - 1)) * (Math.PI * 0.76);
    positions[v.id] = {
      x: CX + Math.cos(angle) * radius,
      y: CY + Math.sin(angle) * radius * 0.78,
    };
  });

  expand.forEach((v, i) => {
    const angle = (Math.PI * -0.38) + (i / (expand.length - 1)) * (Math.PI * 0.76);
    positions[v.id] = {
      x: CX + Math.cos(angle) * radius,
      y: CY + Math.sin(angle) * radius * 0.78,
    };
  });

  return positions;
})();

// Activity positions — branch outward from their primary value
const ACTIVITY_LAYOUT = (() => {
  const positions = {};
  const clusters = {};

  ACTIVITIES.forEach(a => {
    const pv = a.values[0];
    if (!clusters[pv]) clusters[pv] = [];
    clusters[pv].push(a);
  });

  Object.entries(clusters).forEach(([vid, acts]) => {
    const vPos = VALUE_LAYOUT[vid];
    if (!vPos) return;
    const dx = vPos.x - CX;
    const dy = vPos.y - CY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / dist;
    const ny = dy / dist;
    const px = -ny;
    const py = nx;

    const branchDist = 95;
    const spread = 34;

    acts.forEach((a, i) => {
      const offset = (i - (acts.length - 1) / 2) * spread;
      positions[a.id] = {
        x: vPos.x + nx * branchDist + px * offset,
        y: vPos.y + ny * branchDist + py * offset,
      };
    });
  });

  return positions;
})();

function valueNodeColor(v) {
  if (v.score < v.sufficiencyMark) return { fill: "#D4564E", stroke: "#B8443E", bg: "#D4564E18" };
  if (v.score >= 8) return { fill: "#3A7CB8", stroke: "#2D6AA0", bg: "#3A7CB818" };
  return { fill: "#5A9E6F", stroke: "#4A8B5E", bg: "#5A9E6F18" };
}

// Compute highest leverage action
function getHighestLeverage() {
  const below = VALUES.filter(v => v.score < v.sufficiencyMark)
    .sort((a, b) => a.score - b.score);
  if (below.length === 0) return "All values at sufficiency";
  const worst = below[0];
  return `Highest leverage: get ${worst.name} to Sufficiency`;
}

// Curved path between two points
function curvePath(x1, y1, x2, y2, curvature = 0.15) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = mx - dy * curvature;
  const cy = my + dx * curvature;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

export default function WildSuccessMap5() {
  const [selectedValue, setSelectedValue] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  const protectAvg = VALUES.filter(v => v.type === "protect").reduce((s, v) => s + v.score, 0) / 4;
  const expandAvg = VALUES.filter(v => v.type === "expand").reduce((s, v) => s + v.score, 0) / 4;

  // What's highlighted
  const hlValues = selectedActivity ? selectedActivity.values
    : selectedValue ? [selectedValue.id] : [];
  const hlActivities = selectedValue
    ? ACTIVITIES.filter(a => a.values.includes(selectedValue.id)).map(a => a.id)
    : selectedActivity ? [selectedActivity.id] : [];

  const actionModes = [
    { name: "Today" }, { name: "Organize" }, { name: "Plan" },
    { name: "Communicate" }, { name: "Review" }, { name: "Spending" },
  ];

  return (
    <div style={{
      fontFamily: "'Source Sans 3', sans-serif",
      background: "#FAFAF7", minHeight: "100vh", color: "#2D2A26",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      {/* NAV */}
      <div style={{
        padding: "8px 20px", display: "flex", alignItems: "center", gap: 5,
        borderBottom: "1px solid #F0EDE6", background: "#FFFFFF",
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#C4725A", marginRight: 10 }}>
          Wild Success
        </div>
        {actionModes.map(m => (
          <div key={m.name} style={{
            padding: "3px 9px", borderRadius: 5, border: "1px solid #F0EDE6",
            fontSize: 10, fontWeight: 600, color: "#2D2A26", cursor: "pointer",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#F8F7F4"; e.currentTarget.style.borderColor = "#C4725A40"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#F0EDE6"; }}
          >{m.name}</div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 10, color: "#8A8578", cursor: "pointer", marginRight: 6 }}>AI Help</div>
        <div style={{
          width: 24, height: 24, borderRadius: "50%", background: "#C4725A20",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 700, color: "#C4725A",
        }}>N</div>
      </div>

      {/* MIND MAP */}
      <div style={{ display: "flex", justifyContent: "center", padding: "0 8px" }}
        onClick={() => { setSelectedValue(null); setSelectedActivity(null); }}
      >
        <svg viewBox="0 0 1160 820" style={{ width: "100%", height: "auto" }}>
          <defs>
            <filter id="glow"><feGaussianBlur stdDeviation="6" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* PROTECT / EXPAND labels */}
          <text x={CX - 220} y={50} textAnchor="middle"
            fontSize={14} fontWeight={700} fill="#9E6A46" letterSpacing="3" opacity={0.5}>
            PROTECT
          </text>
          <text x={CX + 260} y={60} textAnchor="middle"
            fontSize={14} fontWeight={700} fill="#4B82AF" letterSpacing="3" opacity={0.5}>
            EXPAND
          </text>

          {/* Lines: center → values — PROMINENT */}
          {VALUES.map(v => {
            const vp = VALUE_LAYOUT[v.id];
            const vc = valueNodeColor(v);
            const hl = hlValues.includes(v.id);
            return (
              <path key={`c-${v.id}`}
                d={curvePath(CX, CY, vp.x, vp.y, v.type === "protect" ? 0.08 : -0.08)}
                fill="none"
                stroke={hl ? vc.stroke : v.type === "protect" ? "#C4A882" : "#82ABC4"}
                strokeWidth={hl ? 3.5 : 2.5}
                strokeOpacity={hl ? 0.7 : 0.3}
              />
            );
          })}

          {/* Lines: values → activities */}
          {ACTIVITIES.map(a => {
            const ap = ACTIVITY_LAYOUT[a.id];
            if (!ap) return null;
            return a.values.map(vid => {
              const vp = VALUE_LAYOUT[vid];
              if (!vp) return null;
              const vc = valueNodeColor(VALUES.find(v => v.id === vid));
              const hl = hlValues.includes(vid) && hlActivities.includes(a.id);
              const hov = hoveredNode === a.id;
              return (
                <line key={`${a.id}-${vid}`}
                  x1={vp.x} y1={vp.y} x2={ap.x} y2={ap.y}
                  stroke={hl || hov ? vc.stroke : "#DDD8D0"}
                  strokeWidth={hl || hov ? 1.8 : 0.7}
                  strokeOpacity={hl || hov ? 0.5 : 0.2}
                />
              );
            });
          })}

          {/* Cross-links: activities that serve multiple values */}
          {ACTIVITIES.filter(a => a.values.length > 1).map(a => {
            const ap = ACTIVITY_LAYOUT[a.id];
            if (!ap) return null;
            return a.values.slice(1).map(vid => {
              const vp = VALUE_LAYOUT[vid];
              if (!vp) return null;
              const hl = hlActivities.includes(a.id);
              return (
                <line key={`cross-${a.id}-${vid}`}
                  x1={ap.x} y1={ap.y} x2={vp.x} y2={vp.y}
                  stroke={hl ? "#8A857880" : "#E8E4DC"}
                  strokeWidth={hl ? 1.2 : 0.5}
                  strokeOpacity={hl ? 0.4 : 0.12}
                  strokeDasharray={hl ? "none" : "3 3"}
                />
              );
            });
          })}

          {/* CENTER NODE — Nathan */}
          <circle cx={CX} cy={CY} r={85} fill="#FFFFFF"
            stroke="#E8E4DC" strokeWidth={3} />
          {/* Protect arc (left half) */}
          <path
            d={`M ${CX} ${CY - 72} A 72 72 0 0 0 ${CX} ${CY + 72}`}
            fill="none" stroke="#9E6A46" strokeWidth={8}
            strokeOpacity={protectAvg / 10} strokeLinecap="round"
          />
          {/* Expand arc (right half) */}
          <path
            d={`M ${CX} ${CY - 72} A 72 72 0 0 1 ${CX} ${CY + 72}`}
            fill="none" stroke="#4B82AF" strokeWidth={8}
            strokeOpacity={expandAvg / 10} strokeLinecap="round"
          />
          <text x={CX} y={CY - 16} textAnchor="middle" fontSize={28} fontWeight={700} fill="#2D2A26">
            Nathan
          </text>
          <text x={CX - 28} y={CY + 14} textAnchor="middle" fontSize={15} fontWeight={600} fill="#9E6A46">
            {protectAvg.toFixed(1)}
          </text>
          <text x={CX + 28} y={CY + 14} textAnchor="middle" fontSize={15} fontWeight={600} fill="#4B82AF">
            {expandAvg.toFixed(1)}
          </text>
          {/* Highest leverage text */}
          <text x={CX} y={CY + 36} textAnchor="middle" fontSize={10} fontWeight={600}
            fill="#C4504A" opacity={0.85}>
            {getHighestLeverage()}
          </text>

          {/* VALUE NODES */}
          {VALUES.map(v => {
            const vp = VALUE_LAYOUT[v.id];
            const vc = valueNodeColor(v);
            const r = 32 + (v.score / 10) * 20;
            const isSel = selectedValue?.id === v.id;
            const isHl = hlValues.includes(v.id);
            const below = v.score < v.sufficiencyMark;
            const actCount = ACTIVITIES.filter(a => a.values.includes(v.id)).length;

            return (
              <g key={v.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedValue(selectedValue?.id === v.id ? null : v);
                  setSelectedActivity(null);
                }}
                onMouseEnter={() => setHoveredNode(`v${v.id}`)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: "pointer" }}
              >
                {(isSel || isHl) && (
                  <circle cx={vp.x} cy={vp.y} r={r + 8}
                    fill="none" stroke={vc.stroke} strokeWidth={2}
                    strokeOpacity={0.3} filter="url(#glow)" />
                )}
                <circle cx={vp.x} cy={vp.y} r={r}
                  fill={vc.bg} stroke={vc.stroke}
                  strokeWidth={isSel ? 3 : 2}
                  strokeOpacity={isSel ? 0.8 : 0.5}
                />
                {/* Score */}
                <text x={vp.x} y={vp.y - 2} textAnchor="middle" dominantBaseline="central"
                  fontSize={r * 0.55} fontWeight={700} fill={vc.fill} opacity={0.9}>
                  {v.score}
                </text>
                {/* Activity count indicator — small dots */}
                {Array.from({ length: Math.min(actCount, 6) }, (_, i) => {
                  const dotAngle = (Math.PI * 0.6) + (i / Math.max(actCount - 1, 1)) * (Math.PI * 0.8);
                  return (
                    <circle key={i}
                      cx={vp.x + Math.cos(dotAngle) * (r + 7)}
                      cy={vp.y + Math.sin(dotAngle) * (r + 7)}
                      r={2.5} fill={vc.fill} opacity={0.4}
                    />
                  );
                })}
                {/* Name */}
                <text x={vp.x} y={vp.y + r + 16} textAnchor="middle"
                  fontSize={13} fontWeight={700}
                  fill={below ? "#C4504A" : "#2D2A26"}>
                  {v.name}
                </text>
                {/* Status */}
                <text x={vp.x} y={vp.y + r + 30} textAnchor="middle"
                  fontSize={10} fontWeight={600}
                  fill={below ? "#C4504A" : v.score >= 8 ? "#2D6AA0" : "#4A8B5E"}>
                  {below ? "Needs attention" : v.score >= 8 ? "Abundant" : "Handled"}
                </text>
              </g>
            );
          })}

          {/* ACTIVITY NODES */}
          {ACTIVITIES.map(a => {
            const ap = ACTIVITY_LAYOUT[a.id];
            if (!ap) return null;
            const isHl = hlActivities.includes(a.id);
            const isSel = selectedActivity?.id === a.id;
            const isHov = hoveredNode === a.id;

            return (
              <g key={a.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedActivity(selectedActivity?.id === a.id ? null : a);
                  setSelectedValue(null);
                }}
                onMouseEnter={() => setHoveredNode(a.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: "pointer" }}
              >
                <circle cx={ap.x} cy={ap.y}
                  r={a.overdue ? 8 : 6}
                  fill={a.overdue ? "#C4504A" : isHl || isSel || isHov ? "#8A8578" : "#C4BFB4"}
                  stroke={isSel ? "#2D2A26" : "none"} strokeWidth={2}
                >
                  {a.overdue && (
                    <animate attributeName="r" values="8;10;8" dur="2s" repeatCount="indefinite" />
                  )}
                </circle>
                {(isHl || isSel || isHov) && (
                  <text x={ap.x} y={ap.y - 14} textAnchor="middle"
                    fontSize={11} fontWeight={a.overdue ? 700 : 500}
                    fill={a.overdue ? "#C4504A" : "#2D2A26"}>
                    {a.name}
                  </text>
                )}
              </g>
            );
          })}

          {/* Always-visible labels for overdue activities */}
          {ACTIVITIES.filter(a => a.overdue).map(a => {
            const ap = ACTIVITY_LAYOUT[a.id];
            if (!ap) return null;
            if (hlActivities.includes(a.id) || selectedActivity?.id === a.id || hoveredNode === a.id) return null;
            return (
              <text key={`lbl-${a.id}`} x={ap.x} y={ap.y - 14} textAnchor="middle"
                fontSize={10} fontWeight={600} fill="#C4504A" opacity={0.8}>
                {a.name}
              </text>
            );
          })}

        </svg>
      </div>

      {/* BELOW THE MAP */}
      <div style={{ padding: "8px 28px 36px", maxWidth: 800, margin: "0 auto" }}>
        <div style={{
          border: "1.5px solid #E8E4DC",
          borderRadius: 16,
          padding: "18px 22px",
          background: "#FFFFFF",
        }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: "#2D2A26", marginBottom: 14,
          }}>
            Take Action
          </div>

          {/* Suggestions */}
          {(() => {
            const below = VALUES.filter(v => v.score < v.sufficiencyMark);
            const suggestions = below.flatMap(v => {
              const items = [];
              const serving = ACTIVITIES.filter(a => a.values.includes(v.id));
              const overdue = serving.filter(a => a.overdue);
              if (overdue.length > 0) {
                items.push({ value: v, type: "overdue", text: `Schedule ${overdue.map(a => a.name).join(", ")}` });
              }
              if (serving.length <= 2) {
                items.push({ value: v, type: "new", text: `Add activities for ${v.name}` });
              }
              return items;
            });
            if (suggestions.length === 0) return null;
            return (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#2D2A26", marginBottom: 8 }}>
                  To move toward sufficiency
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {suggestions.map((s, i) => (
                    <div key={i} style={{
                      padding: "6px 12px", borderRadius: 8,
                      background: s.type === "overdue" ? "#FDF5F4" : "#F8F7F4",
                      border: `1px solid ${s.type === "overdue" ? "#C4504A20" : "#E8E4DC"}`,
                      display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 10,
                    }}>
                      <span>{s.type === "overdue" ? "📅" : "✦"}</span>
                      <span style={{ fontWeight: 600 }}>{s.text}</span>
                      <span style={{ color: "#8A8578" }}>→ {s.value.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Big outcomes */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#2D2A26", marginBottom: 6 }}>
              Big outcomes
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {BIG_OUTCOMES.map(bo => (
                <div key={bo.id} style={{
                  padding: "4px 10px", borderRadius: 8,
                  background: "#FFF", border: "1px solid #E8E4DC",
                  fontSize: 10, fontWeight: 500, cursor: "pointer",
                }}>
                  {bo.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
