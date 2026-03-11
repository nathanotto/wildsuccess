import { useState, useEffect, useRef } from "react";

/*
  Norma's Perspective View — Wild Success
  
  This is an orientation layer, not an action screen.
  Norma sees her life as a landscape. She clicks to dive into action views.
  
  Aesthetic: warm, organic, watercolor-adjacent. Not clinical.
  The mood is "a thoughtful friend drew this map of your life on good paper."
*/

const NORMA = {
  name: "Norma",
  greeting: "Tuesday morning",
  role: "Healthcare Administrator",
  family: ["Joe (husband)", "Maya (14)", "Sam (11)", "Leo (9)"],
};

// Life areas as organic territories
const LIFE_AREAS = [
  {
    id: "family",
    label: "Family",
    color: "#e07850",
    bgColor: "#fef0e8",
    type: "preventive",
    icon: "◈",
    sufficiency: 0.78,
    attention: 1.4,
    x: 0.22, y: 0.38,
    status: "Maya's field trip permission due Thursday",
    items: 6,
    mood: "steady",
  },
  {
    id: "finances",
    label: "Financial Security",
    color: "#2a9d6e",
    bgColor: "#e8f5ef",
    type: "preventive",
    icon: "▣",
    sufficiency: 0.65,
    attention: 1.0,
    x: 0.14, y: 0.62,
    status: "Tax prep started · Emergency fund at 4.2 months",
    items: 3,
    mood: "attention needed",
  },
  {
    id: "health",
    label: "Health",
    color: "#d4564e",
    bgColor: "#fde8e7",
    type: "preventive",
    icon: "◉",
    sufficiency: 0.55,
    attention: 0.9,
    x: 0.38, y: 0.22,
    status: "Missed 2 workouts this week · Annual physical overdue",
    items: 4,
    mood: "drifting",
  },
  {
    id: "work",
    label: "Hospital Admin",
    color: "#5b7fb5",
    bgColor: "#eaf0f8",
    type: "mixed",
    icon: "◆",
    sufficiency: 0.72,
    attention: 1.3,
    x: 0.58, y: 0.30,
    status: "Dr. Chen coverage request pending · Q2 schedules due",
    items: 9,
    mood: "busy",
  },
  {
    id: "travel",
    label: "Travel",
    color: "#8b6cc1",
    bgColor: "#f0ecf8",
    type: "promotional",
    icon: "✦",
    sufficiency: 0.30,
    attention: 0.5,
    x: 0.78, y: 0.25,
    status: "Summer trip not yet planned · Portugal idea saved",
    items: 2,
    mood: "dreaming",
  },
  {
    id: "art",
    label: "Art",
    color: "#c9567a",
    bgColor: "#f8e8ee",
    type: "promotional",
    icon: "◇",
    sufficiency: 0.20,
    attention: 0.4,
    x: 0.82, y: 0.50,
    status: "Haven't painted in 3 weeks",
    items: 1,
    mood: "neglected",
  },
  {
    id: "volunteering",
    label: "Community",
    color: "#d4943a",
    bgColor: "#faf0e0",
    type: "promotional",
    icon: "★",
    sufficiency: 0.45,
    attention: 0.6,
    x: 0.72, y: 0.68,
    status: "Food bank shift Saturday · Board meeting next week",
    items: 3,
    mood: "engaged",
  },
];

const COMMITMENTS = [
  { id: 1, text: "Send Dr. Chen the coverage options", to: "Dr. Chen", due: "Today", area: "work", urgency: "high" },
  { id: 2, text: "Sign Maya's field trip form", to: "Maya's school", due: "Thursday", area: "family", urgency: "medium" },
  { id: 3, text: "Schedule annual physical", to: "Self", due: "This week", area: "health", urgency: "medium" },
  { id: 4, text: "Review tax documents Joe gathered", to: "Joe", due: "Saturday", area: "finances", urgency: "low" },
  { id: 5, text: "Confirm food bank shift", to: "Food Bank", due: "Friday", area: "volunteering", urgency: "low" },
  { id: 6, text: "Q2 physician schedules draft", to: "Department", due: "Next Tuesday", area: "work", urgency: "high" },
];

const SAFETY_SYSTEMS = [
  { label: "Health insurance", status: "active", ok: true },
  { label: "Life insurance", status: "active", ok: true },
  { label: "Emergency fund", status: "4.2 mo", ok: false },
  { label: "Car insurance", status: "renews Apr", ok: true },
  { label: "Tax filing", status: "in progress", ok: false },
  { label: "Kids' medical", status: "up to date", ok: true },
  { label: "Retirement (403b)", status: "on track", ok: true },
  { label: "Home maintenance", status: "furnace check due", ok: false },
];

function SufficiencyBar({ value, color, width = 80 }) {
  const sufficient = value >= 0.7;
  const warning = value < 0.5;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{
        width,
        height: 5,
        borderRadius: 3,
        background: "#e8e4df",
        overflow: "hidden",
      }}>
        <div style={{
          width: `${value * 100}%`,
          height: "100%",
          borderRadius: 3,
          background: warning ? "#d4564e" : sufficient ? color : color + "aa",
          transition: "width 0.6s ease",
        }} />
      </div>
      <span style={{
        fontSize: 9,
        color: warning ? "#d4564e" : "#8a8078",
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {sufficient ? "sufficient" : warning ? "needs attention" : "growing"}
      </span>
    </div>
  );
}

function LifeAreaBlob({ area, isActive, onClick, onHover, onLeave, containerW, containerH }) {
  const cx = area.x * containerW;
  const cy = area.y * containerH;
  const baseR = 48 * area.attention;
  const r = isActive ? baseR * 1.12 : baseR;
  const isPreventive = area.type === "preventive";

  return (
    <g
      onClick={() => onClick(area.id)}
      onMouseEnter={(e) => onHover(area.id, e)}
      onMouseLeave={onLeave}
      style={{ cursor: "pointer" }}
    >
      {/* Soft background blob */}
      <ellipse
        cx={cx} cy={cy}
        rx={r * 1.3} ry={r * 1.1}
        fill={area.bgColor}
        opacity={isActive ? 0.9 : 0.6}
        style={{ transition: "all 0.4s ease" }}
      />
      {/* Border */}
      <ellipse
        cx={cx} cy={cy}
        rx={r * 1.15} ry={r * 0.95}
        fill="none"
        stroke={area.color}
        strokeWidth={isActive ? 2.5 : 1.2}
        opacity={isActive ? 0.8 : 0.4}
        strokeDasharray={isPreventive ? "none" : "6 4"}
        style={{ transition: "all 0.3s ease" }}
      />
      {/* Sufficiency ring */}
      <circle
        cx={cx} cy={cy}
        r={r * 0.35}
        fill="none"
        stroke={area.color}
        strokeWidth={3}
        strokeDasharray={`${area.sufficiency * 2 * Math.PI * r * 0.35} ${(1 - area.sufficiency) * 2 * Math.PI * r * 0.35}`}
        strokeDashoffset={2 * Math.PI * r * 0.35 * 0.25}
        opacity={0.5}
        strokeLinecap="round"
      />
      {/* Icon */}
      <text x={cx} y={cy - 8} fill={area.color} fontSize={14} textAnchor="middle" opacity={0.6}>
        {area.icon}
      </text>
      {/* Label */}
      <text x={cx} y={cy + 10} fill={area.color} fontSize={isActive ? 13 : 11} textAnchor="middle" fontFamily="'Libre Franklin', sans-serif" fontWeight={isActive ? 700 : 500}>
        {area.label}
      </text>
      {/* Item count */}
      {area.items > 0 && (
        <g>
          <circle cx={cx + r * 0.7} cy={cy - r * 0.5} r={9} fill={area.urgency === "high" ? "#d4564e" : area.color} opacity={0.85} />
          <text x={cx + r * 0.7} y={cy - r * 0.5 + 3.5} fill="white" fontSize={9} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontWeight={700}>
            {area.items}
          </text>
        </g>
      )}
      {/* Mood indicator */}
      <text x={cx} y={cy + 24} fill={area.color} fontSize={8} textAnchor="middle" fontFamily="'Libre Franklin', sans-serif" opacity={0.5} fontStyle="italic">
        {area.mood}
      </text>
    </g>
  );
}

export default function NormaPerspective() {
  const [activeArea, setActiveArea] = useState(null);
  const [selectedArea, setSelectedArea] = useState(null);
  const [time, setTime] = useState(0);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 1100, h: 700 });

  useEffect(() => {
    const interval = setInterval(() => setTime((t) => t + 1), 80);
    return () => clearInterval(interval);
  }, []);

  const activeAreaData = LIFE_AREAS.find((a) => a.id === (selectedArea || activeArea));

  const W = 1100;
  const H = 700;
  const mapH = 500;

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "#faf8f5",
        fontFamily: "'Libre Franklin', sans-serif",
        color: "#2c2825",
        position: "relative",
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Fraunces:wght@400;600;700&display=swap" rel="stylesheet" />

      {/* === HEADER === */}
      <div style={{
        padding: "20px 32px 12px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        borderBottom: "1px solid #e8e4df",
      }}>
        <div>
          <div style={{
            fontSize: 11,
            color: "#8a8078",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: 2,
            marginBottom: 4,
          }}>
            WILD SUCCESS · PERSPECTIVE VIEW
          </div>
          <div style={{
            fontSize: 26,
            fontFamily: "'Fraunces', serif",
            fontWeight: 600,
            color: "#2c2825",
          }}>
            Good {NORMA.greeting}, Norma
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#8a8078" }}>
            {COMMITMENTS.filter((c) => c.urgency === "high").length} urgent · {COMMITMENTS.length} total commitments
          </div>
          <div style={{ fontSize: 11, color: "#b0a898", marginTop: 2 }}>
            March 10, 2026
          </div>
        </div>
      </div>

      {/* === PREVENTIVE / PROMOTIONAL AXIS LABELS === */}
      <div style={{
        padding: "10px 32px 0",
        display: "flex",
        justifyContent: "space-between",
      }}>
        <div style={{
          fontSize: 10,
          fontFamily: "'JetBrains Mono', monospace",
          color: "#2a9d6e",
          letterSpacing: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          <div style={{ width: 20, height: 2, background: "#2a9d6e", borderRadius: 1 }} />
          PREVENTIVE · protect what matters
        </div>
        <div style={{
          fontSize: 10,
          fontFamily: "'JetBrains Mono', monospace",
          color: "#8b6cc1",
          letterSpacing: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          PROMOTIONAL · pursue what calls
          <div style={{ width: 20, height: 2, background: "#8b6cc1", borderRadius: 1, strokeDasharray: "4 3" }} />
        </div>
      </div>

      {/* === MAP AREA === */}
      <div style={{ position: "relative", margin: "0 16px" }}>
        <svg width="100%" viewBox={`0 0 ${W} ${mapH}`} style={{ display: "block" }}>
          {/* Subtle grid */}
          {Array.from({ length: 20 }).map((_, i) => (
            <line key={`vg${i}`} x1={i * (W / 20)} y1={0} x2={i * (W / 20)} y2={mapH} stroke="#e8e4df" strokeWidth={0.3} opacity={0.4} />
          ))}
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={`hg${i}`} x1={0} y1={i * (mapH / 12)} x2={W} y2={i * (mapH / 12)} stroke="#e8e4df" strokeWidth={0.3} opacity={0.4} />
          ))}

          {/* Preventive / promotional gradient zones */}
          <rect x={0} y={0} width={W * 0.45} height={mapH} fill="#2a9d6e" opacity={0.02} />
          <rect x={W * 0.55} y={0} width={W * 0.45} height={mapH} fill="#8b6cc1" opacity={0.02} />
          <line x1={W * 0.5} y1={20} x2={W * 0.5} y2={mapH - 20} stroke="#d4cfc8" strokeWidth={0.5} strokeDasharray="4 8" opacity={0.3} />
          <text x={W * 0.5} y={mapH - 8} fill="#b0a898" fontSize={8} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" opacity={0.4}>
            sufficiency boundary
          </text>

          {/* Connection lines between related areas */}
          {[
            ["family", "finances"],
            ["family", "health"],
            ["work", "health"],
            ["volunteering", "art"],
            ["travel", "art"],
            ["family", "volunteering"],
          ].map(([a, b]) => {
            const areaA = LIFE_AREAS.find((la) => la.id === a);
            const areaB = LIFE_AREAS.find((la) => la.id === b);
            const ax = areaA.x * W, ay = areaA.y * mapH;
            const bx = areaB.x * W, by = areaB.y * mapH;
            const mx = (ax + bx) / 2 + (Math.random() - 0.5) * 30;
            const my = (ay + by) / 2 + (Math.random() - 0.5) * 20;
            return (
              <path
                key={`${a}-${b}`}
                d={`M ${ax} ${ay} Q ${mx} ${my} ${bx} ${by}`}
                fill="none"
                stroke="#d4cfc8"
                strokeWidth={0.8}
                opacity={0.3}
              />
            );
          })}

          {/* Life area blobs */}
          {LIFE_AREAS.map((area) => (
            <LifeAreaBlob
              key={area.id}
              area={area}
              isActive={activeArea === area.id || selectedArea === area.id}
              onClick={(id) => setSelectedArea(selectedArea === id ? null : id)}
              onHover={(id) => setActiveArea(id)}
              onLeave={() => setActiveArea(null)}
              containerW={W}
              containerH={mapH}
            />
          ))}

          {/* "Now" gravity indicator at center */}
          <g opacity={0.3}>
            <circle cx={W * 0.48} cy={mapH * 0.48} r={16} fill="none" stroke="#c4a35a" strokeWidth={1} opacity={0.4 + Math.sin(time * 0.08) * 0.15} />
            <circle cx={W * 0.48} cy={mapH * 0.48} r={4} fill="#c4a35a" opacity={0.5} />
            <text x={W * 0.48} y={mapH * 0.48 + 28} fill="#c4a35a" fontSize={8} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" opacity={0.5}>
              now
            </text>
          </g>
        </svg>
      </div>

      {/* === BOTTOM PANEL === */}
      <div style={{
        display: "grid",
        gridTemplateColumns: selectedArea ? "1fr 1fr 1fr" : "1fr 1fr 1fr",
        gap: 16,
        padding: "0 32px 24px",
        marginTop: 4,
      }}>
        {/* COMMITMENTS STREAM */}
        <div style={{
          background: "white",
          borderRadius: 12,
          padding: "16px 20px",
          border: "1px solid #e8e4df",
        }}>
          <div style={{
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            color: "#8a8078",
            letterSpacing: 1.5,
            marginBottom: 10,
          }}>
            COMMITMENTS
          </div>
          {COMMITMENTS
            .filter((c) => !selectedArea || c.area === selectedArea)
            .slice(0, 5)
            .map((c) => {
              const area = LIFE_AREAS.find((a) => a.id === c.area);
              return (
                <div
                  key={c.id}
                  style={{
                    padding: "8px 0",
                    borderBottom: "1px solid #f0ece8",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    cursor: "pointer",
                  }}
                >
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: area?.color || "#999",
                    marginTop: 5, flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#2c2825", lineHeight: 1.4 }}>{c.text}</div>
                    <div style={{ fontSize: 10, color: "#8a8078", marginTop: 2 }}>
                      {c.to} · <span style={{ color: c.urgency === "high" ? "#d4564e" : "#b0a898" }}>{c.due}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          <div style={{
            marginTop: 10,
            fontSize: 10,
            color: "#8b6cc1",
            cursor: "pointer",
            fontWeight: 500,
          }}>
            → Enter action view
          </div>
        </div>

        {/* SUFFICIENCY OVERVIEW */}
        <div style={{
          background: "white",
          borderRadius: 12,
          padding: "16px 20px",
          border: "1px solid #e8e4df",
        }}>
          <div style={{
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            color: "#8a8078",
            letterSpacing: 1.5,
            marginBottom: 10,
          }}>
            SUFFICIENCY
          </div>
          {LIFE_AREAS.map((area) => (
            <div
              key={area.id}
              style={{
                padding: "6px 0",
                display: "flex",
                alignItems: "center",
                gap: 10,
                opacity: selectedArea && selectedArea !== area.id ? 0.3 : 1,
                transition: "opacity 0.3s ease",
              }}
            >
              <div style={{
                width: 70,
                fontSize: 10,
                color: area.color,
                fontWeight: 500,
                textAlign: "right",
              }}>
                {area.label}
              </div>
              <SufficiencyBar value={area.sufficiency} color={area.color} width={100} />
            </div>
          ))}
          <div style={{
            marginTop: 10,
            padding: "8px 10px",
            background: "#fef0e8",
            borderRadius: 6,
            fontSize: 10,
            color: "#e07850",
            lineHeight: 1.5,
          }}>
            Art and Travel are below your threshold. These feed your spirit — small steps count.
          </div>
        </div>

        {/* SAFETY SYSTEMS or SELECTED AREA DETAIL */}
        <div style={{
          background: "white",
          borderRadius: 12,
          padding: "16px 20px",
          border: "1px solid #e8e4df",
        }}>
          {selectedArea && activeAreaData ? (
            <>
              <div style={{
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                color: activeAreaData.color,
                letterSpacing: 1.5,
                marginBottom: 10,
              }}>
                {activeAreaData.label.toUpperCase()}
              </div>
              <div style={{
                fontSize: 13,
                color: "#2c2825",
                lineHeight: 1.5,
                marginBottom: 12,
              }}>
                {activeAreaData.status}
              </div>
              <SufficiencyBar value={activeAreaData.sufficiency} color={activeAreaData.color} width={140} />
              <div style={{
                marginTop: 14,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}>
                {["Plan", "Organize", "Communicate", "Review"].map((action) => (
                  <div
                    key={action}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${activeAreaData.color}33`,
                      fontSize: 11,
                      color: activeAreaData.color,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = activeAreaData.bgColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    → {action} · {activeAreaData.label}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                color: "#8a8078",
                letterSpacing: 1.5,
                marginBottom: 10,
              }}>
                SAFETY SYSTEMS
              </div>
              {SAFETY_SYSTEMS.map((sys) => (
                <div
                  key={sys.label}
                  style={{
                    padding: "5px 0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid #f5f0ec",
                  }}
                >
                  <span style={{ fontSize: 11, color: "#2c2825" }}>{sys.label}</span>
                  <span style={{
                    fontSize: 9,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: sys.ok ? "#2a9d6e" : "#d4564e",
                    fontWeight: 500,
                  }}>
                    {sys.status}
                  </span>
                </div>
              ))}
              <div style={{
                marginTop: 8,
                fontSize: 9,
                color: "#b0a898",
                fontStyle: "italic",
              }}>
                3 of 8 systems need attention
              </div>
            </>
          )}
        </div>
      </div>

      {/* === BOTTOM BAR === */}
      <div style={{
        padding: "8px 32px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 9,
        color: "#b0a898",
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: 1,
      }}>
        <span>Click any life area to focus · Preventive values always take priority</span>
        <span style={{ cursor: "pointer", color: "#8a8078" }}>
          Switch to Action View →
        </span>
      </div>
    </div>
  );
}
