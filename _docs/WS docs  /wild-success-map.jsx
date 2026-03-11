import { useState, useEffect, useRef } from "react";

const COLORS = {
  bg: "#ffffff",
  bgGlow: "#f8f9fa",
  preventive: "#2dd4a8",
  promotional: "#f472b6",
  safety: "#22d3ee",
  dream: "#c084fc",
  now: "#fbbf24",
  past: "#64748b",
  future: "#818cf8",
  commitment: "#f97316",
  text: "#e2e8f0",
  textMuted: "#94a3b8",
  textDim: "#475569",
  accent1: "#34d399",
  accent2: "#fb923c",
  accent3: "#a78bfa",
  accent4: "#f87171",
  accent5: "#38bdf8",
};

const LIFE_AREAS = [
  { id: "health", label: "Health", color: "#34d399", size: 1.1, preventive: 0.7, x: -80, y: -20 },
  { id: "work", label: "Work", color: "#fb923c", size: 1.3, preventive: 0.3, x: 60, y: -40 },
  { id: "family", label: "Family", color: "#f87171", size: 1.2, preventive: 0.8, x: -40, y: 50 },
  { id: "finances", label: "Finances", color: "#fbbf24", size: 1.0, preventive: 0.9, x: -120, y: 30 },
  { id: "relationship", label: "Relationship", color: "#f472b6", size: 1.15, preventive: 0.5, x: 30, y: 60 },
  { id: "recreation", label: "Recreation", color: "#a78bfa", size: 0.85, preventive: 0.1, x: 110, y: 20 },
  { id: "home", label: "Home", color: "#22d3ee", size: 0.95, preventive: 0.85, x: -100, y: -50 },
];

const ACTION_ZONES = [
  { id: "plan", label: "Plan", icon: "◇", angle: -45, desc: "Define objectives, see the big picture" },
  { id: "review", label: "Review", icon: "◈", angle: -135, desc: "Completion cycles, what got done" },
  { id: "organize", label: "Organize", icon: "▣", angle: 45, desc: "To-dos, calendar, immediate flow" },
  { id: "coach", label: "AI Coach", icon: "◉", angle: 135, desc: "Suggestions, nudges, inner work" },
];

const SAFETY_ITEMS = ["Savings", "Insurance", "Taxes", "Medical", "Emergency Fund", "Retirement", "Home Safety"];
const DREAM_ITEMS = ["Career Vision", "Creative Projects", "Travel", "Learning", "Legacy", "Community Impact"];

// Animated flowing particles along commitment paths
function CommitmentParticle({ path, delay, color }) {
  const [pos, setPos] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setPos((p) => (p + 0.005) % 1);
    }, 16);
    return () => clearInterval(interval);
  }, []);

  const t = (pos + delay) % 1;
  const idx = Math.floor(t * (path.length - 1));
  const frac = t * (path.length - 1) - idx;
  const p1 = path[Math.min(idx, path.length - 1)];
  const p2 = path[Math.min(idx + 1, path.length - 1)];
  const x = p1[0] + (p2[0] - p1[0]) * frac;
  const y = p1[1] + (p2[1] - p1[1]) * frac;

  return (
    <circle cx={x} cy={y} r={3} fill={color} opacity={0.8}>
      <animate attributeName="opacity" values="0.3;0.9;0.3" dur="2s" repeatCount="indefinite" />
    </circle>
  );
}

function Tooltip({ content, x, y, visible }) {
  if (!visible) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -120%)",
        background: "rgba(15, 23, 42, 0.95)",
        border: `1px solid ${COLORS.textDim}`,
        borderRadius: 8,
        padding: "8px 14px",
        color: COLORS.text,
        fontSize: 13,
        fontFamily: "'DM Sans', sans-serif",
        pointerEvents: "none",
        zIndex: 100,
        maxWidth: 220,
        backdropFilter: "blur(8px)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      }}
    >
      {content}
    </div>
  );
}

export default function WildSuccessMap() {
  const [activeZone, setActiveZone] = useState(null);
  const [activeLifeArea, setActiveLifeArea] = useState(null);
  const [hoveredSafety, setHoveredSafety] = useState(null);
  const [hoveredDream, setHoveredDream] = useState(null);
  const [tooltip, setTooltip] = useState({ visible: false, content: "", x: 0, y: 0 });
  const [time, setTime] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => setTime((t) => t + 1), 50);
    return () => clearInterval(interval);
  }, []);

  const W = 1200;
  const H = 800;
  const CX = W / 2;
  const CY = H / 2;

  const showTooltip = (e, content) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        visible: true,
        content,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const hideTooltip = () => setTooltip({ ...tooltip, visible: false });

  // Commitment flow paths (arteries)
  const commitPaths = [
    // Values → Center (top down)
    { path: [[CX, 60], [CX - 30, 150], [CX - 10, 250], [CX, CY - 80]], color: COLORS.preventive },
    { path: [[CX + 80, 80], [CX + 50, 160], [CX + 20, 260], [CX + 10, CY - 70]], color: COLORS.promotional },
    // Center → Past (completion)
    { path: [[CX - 80, CY], [CX - 180, CY - 20], [CX - 280, CY - 10], [120, CY + 30]], color: COLORS.past },
    // Future → Center (planning)
    { path: [[W - 120, CY - 40], [CX + 280, CY - 30], [CX + 180, CY - 10], [CX + 80, CY]], color: COLORS.future },
    // Safety → Center
    { path: [[160, CY + 160], [250, CY + 100], [CX - 100, CY + 40], [CX - 40, CY + 10]], color: COLORS.safety },
    // Dream → Center
    { path: [[W - 160, 180], [W - 260, 230], [CX + 120, CY - 60], [CX + 40, CY - 20]], color: COLORS.dream },
  ];

  const pulse = Math.sin(time * 0.1) * 0.15 + 0.85;

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100vh",
        background: `radial-gradient(ellipse at 50% 50%, ${COLORS.bgGlow} 0%, ${COLORS.bg} 70%)`,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      <Tooltip {...tooltip} />

      {/* Title */}
      <div style={{ position: "absolute", top: 16, left: 24, zIndex: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.now, fontFamily: "'Space Mono', monospace", letterSpacing: 2 }}>
          WILD SUCCESS
        </div>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2, letterSpacing: 1 }}>
          CONCEPTUAL MAP
        </div>
      </div>

      {/* Legend */}
      <div style={{ position: "absolute", top: 16, right: 24, zIndex: 10, display: "flex", gap: 16, fontSize: 11, color: COLORS.textMuted }}>
        {[
          { color: COLORS.preventive, label: "Preventive" },
          { color: COLORS.promotional, label: "Promotional" },
          { color: COLORS.commitment, label: "Commitments" },
          { color: COLORS.now, label: "Now" },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>

      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", top: 0, left: 0 }}>
        <defs>
          {/* Glow filters */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glowStrong">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glowSoft">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* Radial gradient for center */}
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={COLORS.now} stopOpacity="0.25" />
            <stop offset="60%" stopColor={COLORS.now} stopOpacity="0.05" />
            <stop offset="100%" stopColor={COLORS.now} stopOpacity="0" />
          </radialGradient>

          <radialGradient id="safetyGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={COLORS.safety} stopOpacity="0.15" />
            <stop offset="100%" stopColor={COLORS.safety} stopOpacity="0" />
          </radialGradient>

          <radialGradient id="dreamGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={COLORS.dream} stopOpacity="0.15" />
            <stop offset="100%" stopColor={COLORS.dream} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* === TIME AXIS === */}
        <line x1={40} y1={CY} x2={W - 40} y2={CY} stroke={COLORS.textDim} strokeWidth={0.5} strokeDasharray="4 8" opacity={0.3} />
        
        {/* Past label */}
        <text x={60} y={CY - 20} fill={COLORS.past} fontSize={14} fontFamily="'Space Mono', monospace" opacity={0.7} fontWeight="700" letterSpacing="3">
          ← PAST
        </text>
        <text x={60} y={CY + 0} fill={COLORS.textDim} fontSize={10} fontFamily="'DM Sans', sans-serif" opacity={0.5}>
          Completion records
        </text>
        <text x={60} y={CY + 14} fill={COLORS.textDim} fontSize={10} fontFamily="'DM Sans', sans-serif" opacity={0.5}>
          What got done
        </text>

        {/* Future label */}
        <text x={W - 180} y={CY - 20} fill={COLORS.future} fontSize={14} fontFamily="'Space Mono', monospace" opacity={0.7} fontWeight="700" letterSpacing="3" textAnchor="end">
          FUTURE →
        </text>
        <text x={W - 180} y={CY + 0} fill={COLORS.textDim} fontSize={10} fontFamily="'DM Sans', sans-serif" opacity={0.5} textAnchor="end">
          Plans, missions
        </text>
        <text x={W - 180} y={CY + 14} fill={COLORS.textDim} fontSize={10} fontFamily="'DM Sans', sans-serif" opacity={0.5} textAnchor="end">
          Desired outcomes
        </text>

        {/* === VALUES LAYER (top) === */}
        <text x={CX} y={40} fill={COLORS.text} fontSize={13} fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="700" letterSpacing="4" opacity={0.9}>
          VALUES
        </text>
        
        {/* Preventive values */}
        <g opacity={0.85}>
          <rect x={CX - 220} y={58} width={180} height={36} rx={18} fill="none" stroke={COLORS.preventive} strokeWidth={1.5} />
          <text x={CX - 130} y={81} fill={COLORS.preventive} fontSize={12} fontFamily="'DM Sans', sans-serif" textAnchor="middle" fontWeight="500">
            Safety · Sufficiency
          </text>
          <text x={CX - 220 + 14} y={81} fill={COLORS.preventive} fontSize={10} opacity={0.6}>▲</text>
        </g>

        {/* Promotional values */}
        <g opacity={0.85}>
          <rect x={CX + 40} y={58} width={180} height={36} rx={18} fill="none" stroke={COLORS.promotional} strokeWidth={1.5} />
          <text x={CX + 130} y={81} fill={COLORS.promotional} fontSize={12} fontFamily="'DM Sans', sans-serif" textAnchor="middle" fontWeight="500">
            Freedom · Opportunity
          </text>
          <text x={CX + 40 + 14} y={81} fill={COLORS.promotional} fontSize={10} opacity={0.6}>★</text>
        </g>

        {/* Sufficiency boundary marker */}
        <line x1={CX} y1={60} x2={CX} y2={92} stroke={COLORS.now} strokeWidth={1} strokeDasharray="2 3" opacity={0.4} />
        <text x={CX} y={108} fill={COLORS.now} fontSize={9} textAnchor="middle" fontFamily="'DM Sans', sans-serif" opacity={0.6}>
          enough
        </text>

        {/* === VISION / PROJECTS BAND === */}
        <text x={CX} y={140} fill={COLORS.textMuted} fontSize={11} fontFamily="'Space Mono', monospace" textAnchor="middle" letterSpacing="3" opacity={0.6}>
          VISION · PROJECTS · LIFE AREAS
        </text>

        {/* === COMMITMENT FLOW ARTERIES === */}
        {commitPaths.map((cp, i) => {
          const d = `M ${cp.path[0][0]} ${cp.path[0][1]} C ${cp.path[1][0]} ${cp.path[1][1]}, ${cp.path[2][0]} ${cp.path[2][1]}, ${cp.path[3][0]} ${cp.path[3][1]}`;
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={cp.color} strokeWidth={2} opacity={0.15} />
              <path d={d} fill="none" stroke={cp.color} strokeWidth={1} opacity={0.3} strokeDasharray="6 8">
                <animate attributeName="stroke-dashoffset" from="0" to="-28" dur="2s" repeatCount="indefinite" />
              </path>
            </g>
          );
        })}

        {/* Commitment label */}
        <text x={CX - 200} y={CY - 120} fill={COLORS.commitment} fontSize={9} fontFamily="'Space Mono', monospace" opacity={0.5} letterSpacing="2" transform={`rotate(-30, ${CX - 200}, ${CY - 120})`}>
          COMMITMENT FLOW
        </text>

        {/* === SAFETY ZONE (lower left) === */}
        <ellipse cx={150} cy={CY + 180} rx={140} ry={100} fill="url(#safetyGlow)" />
        <ellipse
          cx={150} cy={CY + 180} rx={130} ry={90}
          fill="none" stroke={COLORS.safety} strokeWidth={1} opacity={0.3}
          strokeDasharray="4 6"
        />
        <text x={150} y={CY + 130} fill={COLORS.safety} fontSize={11} fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="700" letterSpacing="2">
          SAFETY SYSTEMS
        </text>
        {SAFETY_ITEMS.map((item, i) => {
          const angle = (i / SAFETY_ITEMS.length) * Math.PI * 1.4 - Math.PI * 0.2;
          const rx = 85 + (i % 2) * 20;
          const ry = 55 + (i % 2) * 15;
          const ix = 150 + Math.cos(angle) * rx;
          const iy = CY + 185 + Math.sin(angle) * ry;
          return (
            <g key={item}
              onMouseEnter={(e) => { setHoveredSafety(item); showTooltip(e, `Preventive system: ${item}`); }}
              onMouseLeave={() => { setHoveredSafety(null); hideTooltip(); }}
              style={{ cursor: "pointer" }}
            >
              <circle cx={ix} cy={iy} r={hoveredSafety === item ? 22 : 18} fill={COLORS.bg} stroke={COLORS.safety} strokeWidth={hoveredSafety === item ? 1.5 : 0.8} opacity={hoveredSafety === item ? 1 : 0.6} />
              <text x={ix} y={iy + 3} fill={COLORS.safety} fontSize={7} textAnchor="middle" fontFamily="'DM Sans', sans-serif" fontWeight="500" opacity={hoveredSafety === item ? 1 : 0.7}>
                {item}
              </text>
            </g>
          );
        })}
        <text x={150} y={CY + 290} fill={COLORS.textDim} fontSize={9} textAnchor="middle" fontFamily="'DM Sans', sans-serif" opacity={0.5}>
          Vigilance → Systems
        </text>

        {/* === DREAM ZONE (upper right) === */}
        <ellipse cx={W - 150} cy={200} rx={140} ry={100} fill="url(#dreamGlow)" />
        <ellipse
          cx={W - 150} cy={200} rx={130} ry={90}
          fill="none" stroke={COLORS.dream} strokeWidth={1} opacity={0.3}
          strokeDasharray="4 6"
        />
        <text x={W - 150} y={145} fill={COLORS.dream} fontSize={11} fontFamily="'Space Mono', monospace" textAnchor="middle" fontWeight="700" letterSpacing="2">
          DREAM BIG
        </text>
        {DREAM_ITEMS.map((item, i) => {
          const angle = (i / DREAM_ITEMS.length) * Math.PI * 1.4 + Math.PI * 0.8;
          const rx = 85 + (i % 2) * 20;
          const ry = 55 + (i % 2) * 15;
          const ix = W - 150 + Math.cos(angle) * rx;
          const iy = 205 + Math.sin(angle) * ry;
          return (
            <g key={item}
              onMouseEnter={(e) => { setHoveredDream(item); showTooltip(e, `Promotional aspiration: ${item}`); }}
              onMouseLeave={() => { setHoveredDream(null); hideTooltip(); }}
              style={{ cursor: "pointer" }}
            >
              <circle cx={ix} cy={iy} r={hoveredDream === item ? 22 : 18} fill={COLORS.bg} stroke={COLORS.dream} strokeWidth={hoveredDream === item ? 1.5 : 0.8} opacity={hoveredDream === item ? 1 : 0.6} />
              <text x={ix} y={iy + 3} fill={COLORS.dream} fontSize={7} textAnchor="middle" fontFamily="'DM Sans', sans-serif" fontWeight="500" opacity={hoveredDream === item ? 1 : 0.7}>
                {item}
              </text>
            </g>
          );
        })}
        <text x={W - 150} y={310} fill={COLORS.textDim} fontSize={9} textAnchor="middle" fontFamily="'DM Sans', sans-serif" opacity={0.5}>
          Desired futures
        </text>

        {/* === CENTER: NOW GRAVITATIONAL WELL === */}
        <circle cx={CX} cy={CY} r={160} fill="url(#centerGlow)" />
        <circle cx={CX} cy={CY} r={140} fill="none" stroke={COLORS.now} strokeWidth={0.5} opacity={0.15 * pulse} />
        <circle cx={CX} cy={CY} r={100} fill="none" stroke={COLORS.now} strokeWidth={0.8} opacity={0.2 * pulse} />
        <circle cx={CX} cy={CY} r={55} fill="none" stroke={COLORS.now} strokeWidth={1.2} opacity={0.35 * pulse} />

        {/* Pulsing center */}
        <circle cx={CX} cy={CY} r={20} fill={COLORS.now} opacity={0.15 * pulse} filter="url(#glowSoft)" />
        <circle cx={CX} cy={CY} r={8} fill={COLORS.now} opacity={0.6} filter="url(#glow)" />

        <text x={CX} y={CY + 3} fill={COLORS.bg} fontSize={8} textAnchor="middle" fontFamily="'Space Mono', monospace" fontWeight="700">
          NOW
        </text>

        {/* === LIFE AREA BLOBS === */}
        {LIFE_AREAS.map((area) => {
          const bx = CX + area.x;
          const by = CY + area.y;
          const isActive = activeLifeArea === area.id;
          const r = (isActive ? 32 : 26) * area.size;
          const preventiveRatio = area.preventive;

          return (
            <g key={area.id}
              onMouseEnter={(e) => {
                setActiveLifeArea(area.id);
                showTooltip(e, `${area.label}: ${Math.round(preventiveRatio * 100)}% preventive, ${Math.round((1 - preventiveRatio) * 100)}% promotional`);
              }}
              onMouseLeave={() => { setActiveLifeArea(null); hideTooltip(); }}
              style={{ cursor: "pointer" }}
            >
              {/* Blob background */}
              <ellipse
                cx={bx} cy={by}
                rx={r * 1.1} ry={r * 0.9}
                fill={area.color}
                opacity={isActive ? 0.2 : 0.08}
                filter="url(#glowSoft)"
              />
              {/* Preventive/promotional split indicator */}
              <ellipse
                cx={bx} cy={by}
                rx={r} ry={r * 0.8}
                fill="none"
                stroke={area.color}
                strokeWidth={isActive ? 2 : 1}
                opacity={isActive ? 0.8 : 0.4}
              />
              {/* Preventive fill (bottom arc) */}
              <ellipse
                cx={bx} cy={by + r * 0.15}
                rx={r * preventiveRatio} ry={r * 0.3}
                fill={COLORS.preventive}
                opacity={isActive ? 0.3 : 0.1}
              />
              <text x={bx} y={by + 4} fill={area.color} fontSize={isActive ? 11 : 10} textAnchor="middle" fontFamily="'DM Sans', sans-serif" fontWeight={isActive ? 700 : 500} opacity={isActive ? 1 : 0.7}>
                {area.label}
              </text>
            </g>
          );
        })}

        {/* === ACTION ZONES (ring around center) === */}
        {ACTION_ZONES.map((zone) => {
          const rad = (zone.angle * Math.PI) / 180;
          const dist = 110;
          const zx = CX + Math.cos(rad) * dist;
          const zy = CY + Math.sin(rad) * dist;
          const isActive = activeZone === zone.id;

          return (
            <g key={zone.id}
              onMouseEnter={(e) => { setActiveZone(zone.id); showTooltip(e, zone.desc); }}
              onMouseLeave={() => { setActiveZone(null); hideTooltip(); }}
              onClick={() => setActiveZone(isActive ? null : zone.id)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={zx - 40} y={zy - 16}
                width={80} height={32}
                rx={16}
                fill={isActive ? COLORS.now : COLORS.bg}
                stroke={COLORS.now}
                strokeWidth={isActive ? 2 : 1}
                opacity={isActive ? 0.9 : 0.5}
              />
              <text x={zx} y={zy + 4} fill={isActive ? COLORS.bg : COLORS.now} fontSize={11} textAnchor="middle" fontFamily="'DM Sans', sans-serif" fontWeight={600}>
                {zone.icon} {zone.label}
              </text>
            </g>
          );
        })}

        {/* === INTERRUPTION ARROWS from sides === */}
        {/* Left interruption */}
        <g opacity={0.4}>
          <path d={`M 30 ${CY - 80} Q 120 ${CY - 60} ${CX - 160} ${CY - 30}`} fill="none" stroke={COLORS.accent4} strokeWidth={1} strokeDasharray="3 5">
            <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="3s" repeatCount="indefinite" />
          </path>
          <text x={40} y={CY - 90} fill={COLORS.accent4} fontSize={8} fontFamily="'DM Sans', sans-serif" opacity={0.7}>
            Life interruptions
          </text>
        </g>

        {/* Right interruption */}
        <g opacity={0.4}>
          <path d={`M ${W - 30} ${CY + 80} Q ${W - 120} ${CY + 60} ${CX + 160} ${CY + 30}`} fill="none" stroke={COLORS.accent5} strokeWidth={1} strokeDasharray="3 5">
            <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="3s" repeatCount="indefinite" />
          </path>
          <text x={W - 160} y={CY + 100} fill={COLORS.accent5} fontSize={8} fontFamily="'DM Sans', sans-serif" textAnchor="end" opacity={0.7}>
            Collaborator requests
          </text>
        </g>

        {/* === FIVE ACTION MODES (bottom band) === */}
        <text x={CX} y={H - 85} fill={COLORS.textMuted} fontSize={10} fontFamily="'Space Mono', monospace" textAnchor="middle" letterSpacing="3" opacity={0.5}>
          ACTION MODES
        </text>
        {["Right Now", "Organizing", "Planning", "Communicating", "Spending"].map((mode, i) => {
          const mx = CX - 280 + i * 140;
          const modeColors = [COLORS.now, COLORS.accent1, COLORS.future, COLORS.accent2, COLORS.safety];
          return (
            <g key={mode}
              onMouseEnter={(e) => showTooltip(e, `${mode}: a way of directing attention`)}
              onMouseLeave={hideTooltip}
              style={{ cursor: "pointer" }}
            >
              <rect x={mx - 55} y={H - 72} width={110} height={28} rx={14} fill="none" stroke={modeColors[i]} strokeWidth={1} opacity={0.5} />
              <text x={mx} y={H - 54} fill={modeColors[i]} fontSize={10} textAnchor="middle" fontFamily="'DM Sans', sans-serif" fontWeight="500" opacity={0.8}>
                {mode}
              </text>
            </g>
          );
        })}

        {/* === INPUT CHANNELS (left edge) === */}
        <text x={20} y={160} fill={COLORS.textDim} fontSize={9} fontFamily="'Space Mono', monospace" letterSpacing="2" opacity={0.5}>
          INPUTS
        </text>
        {["Email", "Voice", "Calendar", "Texts", "Slack", "Bank Data", "Patterns"].map((input, i) => (
          <g key={input} opacity={0.4}>
            <text x={24} y={185 + i * 22} fill={COLORS.textMuted} fontSize={9} fontFamily="'DM Sans', sans-serif">
              › {input}
            </text>
            <line x1={90} y1={181 + i * 22} x2={CX - 170} y2={CY - 40 + i * 12} stroke={COLORS.textDim} strokeWidth={0.3} opacity={0.2} />
          </g>
        ))}

        {/* === OUTPUT CHANNELS (right edge) === */}
        <text x={W - 20} y={H - 210} fill={COLORS.textDim} fontSize={9} fontFamily="'Space Mono', monospace" letterSpacing="2" opacity={0.5} textAnchor="end">
          OUTPUTS
        </text>
        {["To-do Lists", "Calendar", "Commitments", "Comms", "Reminders", "Reports"].map((output, i) => (
          <g key={output} opacity={0.4}>
            <text x={W - 24} y={H - 185 + i * 22} fill={COLORS.textMuted} fontSize={9} fontFamily="'DM Sans', sans-serif" textAnchor="end">
              {output} ›
            </text>
            <line x1={W - 100} y1={H - 189 + i * 22} x2={CX + 170} y2={CY + 20 + i * 10} stroke={COLORS.textDim} strokeWidth={0.3} opacity={0.2} />
          </g>
        ))}

        {/* === PRINCIPLES ring (very subtle, outer edge) === */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const pr = 370;
          const px = CX + Math.cos(angle) * pr;
          const py = CY + Math.sin(angle) * pr;
          return (
            <g key={i}
              onMouseEnter={(e) => showTooltip(e, `Principle ${i + 1}`)}
              onMouseLeave={hideTooltip}
              style={{ cursor: "pointer" }}
            >
              <circle cx={px} cy={py} r={4} fill="none" stroke={COLORS.textDim} strokeWidth={0.5} opacity={0.25} />
              <text x={px} y={py + 3} fill={COLORS.textDim} fontSize={6} textAnchor="middle" opacity={0.3}>
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Bottom info bar */}
      <div style={{
        position: "absolute",
        bottom: 8,
        left: 24,
        right: 24,
        display: "flex",
        justifyContent: "space-between",
        fontSize: 9,
        color: COLORS.textDim,
        fontFamily: "'Space Mono', monospace",
        letterSpacing: 1,
      }}>
        <span>Preventive values always take priority over promotional values</span>
        <span>Hover to explore · Click action zones</span>
      </div>
    </div>
  );
}
