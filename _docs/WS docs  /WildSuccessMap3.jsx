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
  { id: "a1", name: "Making dinner", freq: "daily", domain: "Home", overdue: false, values: [1] },
  { id: "a2", name: "Running errands", freq: "weekly", domain: "Home", overdue: false, values: [1, 2], preventive: true },
  { id: "a3", name: "Vibe coding", freq: "daily", domain: "Work", overdue: false, values: [6, 7] },
  { id: "a4", name: "Direct Outcomes meetings", freq: "weekly", domain: "Work", overdue: false, values: [7] },
  { id: "a5", name: "Business trips", freq: "monthly", domain: "Work", overdue: false, values: [7, 5] },
  { id: "a6", name: "Budget & bill pay", freq: "monthly", domain: "Finances", overdue: false, values: [2], preventive: true },
  { id: "a7", name: "Health appointments", freq: "quarterly", domain: "Health", overdue: true, values: [3], preventive: true },
  { id: "a8", name: "Outings with Winston", freq: "weekly", domain: "Family", overdue: false, values: [4, 7] },
  { id: "a9", name: "Family legacy meetings", freq: "monthly", domain: "Family", overdue: false, values: [7, 1] },
  { id: "a10", name: "Media with Winston", freq: "weekly", domain: "Family", overdue: false, values: [4] },
  { id: "a11", name: "Media with Erin", freq: "weekly", domain: "Family", overdue: false, values: [4] },
  { id: "a12", name: "Men's group", freq: "biweekly", domain: "Community", overdue: true, values: [4, 7] },
  { id: "a13", name: "Lunch dates", freq: "weekly", domain: "Community", overdue: true, values: [4, 5] },
  { id: "a14", name: "Travel planning", freq: "one-time", domain: "Recreation", overdue: false, values: [8, 5] },
  { id: "a15", name: "Reading news", freq: "daily", domain: "Downtime", overdue: false, values: [5] },
];

const BIG_OUTCOMES = [
  { id: "bo1", name: "Launch Pine Creek", status: "in_progress", values: [2, 7] },
  { id: "bo2", name: "Build Wild Success", status: "in_progress", values: [6, 7, 5] },
  { id: "bo3", name: "Secure DO funding", status: "in_progress", values: [7, 2] },
  { id: "bo4", name: "Place in Boulder", status: "aspirational", values: [8, 5] },
  { id: "bo5", name: "Security for Erin", status: "in_progress", values: [1, 2, 4] },
];

function segColors(sm) {
  return Array.from({ length: 10 }, (_, i) => {
    const t = i / 9;
    const suffT = (sm - 0.5) / 9;
    if (t < suffT) {
      const p = t / suffT;
      return `rgb(${Math.round(196 - p * 36)}, ${Math.round(78 + p * 82)}, ${Math.round(74 + p * 26)})`;
    }
    const p = (t - suffT) / (1 - suffT);
    return `rgb(${Math.round(130 - p * 90)}, ${Math.round(190 - p * 40)}, ${Math.round(130 - p * 60)})`;
  });
}

// Value orb — organic circle whose fill, glow, and size communicate status
function ValueOrb({ value, isSelected, onClick, size = 1 }) {
  const sm = value.sufficiencyMark;
  const below = value.score < sm;
  const abundant = value.score >= 8;
  const colors = segColors(sm);
  const fillColor = colors[Math.min(value.score - 1, 9)] || colors[0];
  const baseSize = 110 * size;

  // Glow ring: green if handled, red if needs attention, gold if abundant
  const glowColor = below ? "rgba(196, 80, 74, 0.25)" :
    abundant ? "rgba(45, 117, 70, 0.3)" : "rgba(90, 158, 111, 0.2)";
  const labelColor = below ? "#C4504A" : abundant ? "#2D7546" : "#5A9E6F";

  // Fill proportion of the orb based on score
  const fillPct = (value.score / 10) * 100;

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        cursor: "pointer", transition: "transform 0.2s ease",
        transform: isSelected ? "scale(1.08)" : "scale(1)",
      }}
    >
      {/* The orb */}
      <div style={{
        width: baseSize, height: baseSize,
        borderRadius: "50%",
        position: "relative",
        boxShadow: isSelected
          ? `0 0 0 3px ${labelColor}40, 0 0 24px ${glowColor}`
          : `0 0 16px ${glowColor}`,
        transition: "all 0.3s ease",
        overflow: "hidden",
        background: "#F0EDE6",
      }}>
        {/* Fill from bottom */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: `${fillPct}%`,
          background: `linear-gradient(to top, ${colors[0]}, ${fillColor})`,
          transition: "height 0.6s ease, background 0.6s ease",
          borderRadius: "0 0 50% 50%",
        }} />
        {/* Sufficiency line */}
        <div style={{
          position: "absolute",
          bottom: `${(sm / 10) * 100}%`,
          left: "10%", right: "10%",
          height: 2,
          background: "#2D2A26",
          opacity: 0.4,
          borderRadius: 1,
        }} />
        {/* Score number */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: baseSize * 0.28, fontWeight: 700,
          color: value.score >= sm ? "#fff" : "#2D2A26",
          textShadow: value.score >= sm ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
          opacity: 0.9,
        }}>
          {value.score}
        </div>
      </div>
      {/* Name */}
      <div style={{
        fontSize: 12, fontWeight: 700, color: below ? "#C4504A" : "#2D2A26",
        textAlign: "center",
      }}>
        {value.name}
      </div>
      {/* Status label */}
      <div style={{
        fontSize: 9, fontWeight: 600, color: labelColor,
        background: labelColor + "14", padding: "2px 8px", borderRadius: 4,
      }}>
        {below ? "Needs attention" : abundant ? "Abundant" : "Handled"}
      </div>
    </div>
  );
}

function ConnectionLine({ from, to, color, label }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, padding: "4px 10px",
      fontSize: 10, color: "#8A8578",
    }}>
      <span style={{ fontWeight: 600, color }}>{from}</span>
      <span style={{ flex: 1, height: 1, background: color + "40" }} />
      <span>{label}</span>
      <span style={{ flex: 1, height: 1, background: color + "40" }} />
      <span style={{ fontWeight: 600, color }}>{to}</span>
    </div>
  );
}

export default function WildSuccessMap3() {
  const [selectedValue, setSelectedValue] = useState(null);
  const [hoveredAction, setHoveredAction] = useState(null);

  const protectValues = VALUES.filter(v => v.type === "protect");
  const expandValues = VALUES.filter(v => v.type === "expand");
  const overdueActivities = ACTIVITIES.filter(a => a.overdue);
  const belowSufficiency = VALUES.filter(v => v.score < v.sufficiencyMark);

  // Activities serving the selected value
  const selectedActivities = selectedValue
    ? ACTIVITIES.filter(a => a.values.includes(selectedValue.id))
    : [];
  const selectedOutcomes = selectedValue
    ? BIG_OUTCOMES.filter(bo => bo.values.includes(selectedValue.id))
    : [];

  // Suggestions for values below sufficiency
  const suggestions = belowSufficiency.flatMap(v => {
    const items = [];
    const serving = ACTIVITIES.filter(a => a.values.includes(v.id));
    const overdue = serving.filter(a => a.overdue);
    if (overdue.length > 0) {
      items.push({ value: v, type: "overdue", activities: overdue,
        text: `Schedule ${overdue.map(a => a.name).join(", ")}` });
    }
    if (serving.length < 2) {
      items.push({ value: v, type: "new",
        text: `Find a new activity for ${v.name}` });
    }
    return items;
  });

  const actionModes = [
    { key: "rightnow", name: "Right Now", icon: "⚡", desc: "What to do next, based on your values and what's pressing" },
    { key: "organize", name: "Organize", icon: "🔄", desc: "Arrange your week for flow and less drag" },
    { key: "plan", name: "Plan", icon: "🗺", desc: "Look at the bigger picture and define what's next" },
    { key: "communicate", name: "Communicate", icon: "💬", desc: "Respond, follow up, send, and connect" },
    { key: "review", name: "Activity Review", icon: "📋", desc: "Review, log completions, notice patterns" },
    { key: "spend", name: "Spending", icon: "💰", desc: "Align spending with values" },
  ];

  return (
    <div style={{
      fontFamily: "'Source Sans 3', 'Source Sans Pro', Georgia, serif",
      background: "#FAFAF7", minHeight: "100vh", color: "#2D2A26",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      {/* TOP BAR — minimal */}
      <div style={{
        padding: "12px 28px", display: "flex", alignItems: "center",
        borderBottom: "1px solid #F0EDE6", background: "#FFFFFF",
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#C4725A", letterSpacing: "-0.02em" }}>
          Wild Success
        </div>
        <div style={{ flex: 1 }} />
        {overdueActivities.length > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 600, color: "#C4504A", background: "#C4504A12",
            padding: "3px 10px", borderRadius: 6, marginRight: 12,
          }}>
            {overdueActivities.length} overdue
          </span>
        )}
        <div style={{
          fontSize: 12, color: "#8A8578", cursor: "pointer", marginRight: 12,
        }}>AI Help</div>
        <div style={{
          width: 30, height: 30, borderRadius: "50%", background: "#C4725A20",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: "#C4725A",
        }}>N</div>
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 1: THE MAP — "How am I doing?"
          Life at a glance. Organic. Contemplative.
          ═══════════════════════════════════════════ */}
      <div style={{
        padding: "32px 28px 24px",
        background: "linear-gradient(180deg, #FFFFFF 0%, #FAFAF7 100%)",
      }}>
        {/* Overall status line */}
        <div style={{
          textAlign: "center", marginBottom: 28,
        }}>
          <div style={{ fontSize: 13, color: "#8A8578", fontWeight: 400 }}>
            {belowSufficiency.length === 0
              ? "All values are at or above sufficiency"
              : `${belowSufficiency.length} value${belowSufficiency.length > 1 ? "s" : ""} need${belowSufficiency.length === 1 ? "s" : ""} attention`
            }
            {overdueActivities.length > 0 && ` · ${overdueActivities.length} overdue`}
          </div>
        </div>

        {/* Value orbs — organic layout */}
        <div style={{
          display: "flex", justifyContent: "center", gap: 8,
          marginBottom: 12,
        }}>
          {/* Protect cluster */}
          <div style={{
            display: "flex", alignItems: "flex-end", gap: 20,
            padding: "16px 24px 12px",
            borderRadius: 28,
            background: "rgba(196, 114, 90, 0.04)",
          }}>
            <div style={{
              fontSize: 9, fontWeight: 700, color: "#C4725A", textTransform: "uppercase",
              letterSpacing: "0.1em", writingMode: "vertical-rl", transform: "rotate(180deg)",
              marginBottom: 20,
            }}>Protect</div>
            {protectValues.map(v => (
              <ValueOrb
                key={v.id} value={v}
                isSelected={selectedValue?.id === v.id}
                onClick={() => setSelectedValue(selectedValue?.id === v.id ? null : v)}
                size={0.9 + (v.score / 10) * 0.3}
              />
            ))}
          </div>

          {/* Divider */}
          <div style={{
            width: 1, background: "#E8E4DC", margin: "20px 8px",
            alignSelf: "stretch",
          }} />

          {/* Expand cluster */}
          <div style={{
            display: "flex", alignItems: "flex-end", gap: 20,
            padding: "16px 24px 12px",
            borderRadius: 28,
            background: "rgba(90, 143, 123, 0.04)",
          }}>
            {expandValues.map(v => (
              <ValueOrb
                key={v.id} value={v}
                isSelected={selectedValue?.id === v.id}
                onClick={() => setSelectedValue(selectedValue?.id === v.id ? null : v)}
                size={0.9 + (v.score / 10) * 0.3}
              />
            ))}
            <div style={{
              fontSize: 9, fontWeight: 700, color: "#5A8F7B", textTransform: "uppercase",
              letterSpacing: "0.1em", writingMode: "vertical-rl",
              marginBottom: 20,
            }}>Expand</div>
          </div>
        </div>

        {/* Selected value detail — what feeds this value */}
        {selectedValue && (
          <div style={{
            maxWidth: 700, margin: "20px auto 0", padding: "18px 24px",
            borderRadius: 16, background: "#FFFFFF",
            border: "1px solid #E8E4DC",
            boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
          }}>
            <div style={{
              fontSize: 13, fontWeight: 700, marginBottom: 12,
              color: selectedValue.score < selectedValue.sufficiencyMark ? "#C4504A" : "#2D2A26",
            }}>
              What feeds {selectedValue.name}
            </div>

            {selectedActivities.length === 0 && selectedOutcomes.length === 0 ? (
              <div style={{ fontSize: 12, color: "#B5AFA3", fontStyle: "italic", padding: "8px 0" }}>
                Nothing on your Map serves this value yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {selectedActivities.map(a => (
                  <div key={a.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                    borderRadius: 10,
                    background: a.overdue ? "#C4504A08" : "#F8F7F4",
                    border: a.overdue ? "1px solid #C4504A20" : "1px solid transparent",
                  }}>
                    {a.overdue && <div style={{
                      width: 7, height: 7, borderRadius: "50%", background: "#C4504A",
                      boxShadow: "0 0 6px rgba(196,80,74,0.4)",
                    }} />}
                    <span style={{
                      fontSize: 12, fontWeight: a.overdue ? 600 : 400,
                      color: a.overdue ? "#C4504A" : "#2D2A26", flex: 1,
                    }}>
                      {a.name}
                    </span>
                    <span style={{ fontSize: 10, color: "#B5AFA3" }}>{a.freq}</span>
                    <span style={{ fontSize: 10, color: "#B5AFA3" }}>{a.domain}</span>
                  </div>
                ))}
                {selectedOutcomes.map(bo => (
                  <div key={bo.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                    borderRadius: 10, background: "#EDF0F8",
                  }}>
                    <span style={{ fontSize: 11, color: "#5A6B8F" }}>◆</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#2D2A26", flex: 1 }}>
                      {bo.name}
                    </span>
                    <span style={{
                      fontSize: 9, color: "#5A6B8F", background: "#5A6B8F14",
                      padding: "2px 6px", borderRadius: 4, fontWeight: 500,
                      textTransform: "capitalize",
                    }}>
                      {bo.status.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════
          DIVIDER — transition from contemplation to action
          ═══════════════════════════════════════════ */}
      <div style={{
        height: 1, background: "linear-gradient(90deg, transparent, #E8E4DC, transparent)",
        margin: "0 60px",
      }} />

      {/* ═══════════════════════════════════════════
          SECTION 2: "What can I do to improve this picture?"
          Suggestions + action modes
          ═══════════════════════════════════════════ */}
      <div style={{ padding: "24px 28px 40px", maxWidth: 1100, margin: "0 auto" }}>

        {/* Suggestions — only if something needs attention */}
        {suggestions.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: "#2D2A26", marginBottom: 12,
            }}>
              To move toward sufficiency
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {suggestions.map((s, i) => (
                <div key={i} style={{
                  padding: "10px 16px", borderRadius: 12,
                  background: s.type === "overdue" ? "#FDF5F4" : "#F8F7F4",
                  border: `1px solid ${s.type === "overdue" ? "#C4504A20" : "#E8E4DC"}`,
                  display: "flex", alignItems: "center", gap: 10,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
                >
                  <span style={{ fontSize: 14 }}>{s.type === "overdue" ? "📅" : "✦"}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#2D2A26" }}>{s.text}</div>
                    <div style={{ fontSize: 10, color: "#8A8578" }}>
                      → {s.value.name} ({s.value.score}/{s.value.sufficiencyMark} needed)
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action modes — the doorways to doing */}
        <div style={{
          fontSize: 12, fontWeight: 600, color: "#2D2A26", marginBottom: 12,
        }}>
          What would you like to do?
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10,
        }}>
          {actionModes.map(mode => (
            <div
              key={mode.key}
              onMouseEnter={() => setHoveredAction(mode.key)}
              onMouseLeave={() => setHoveredAction(null)}
              style={{
                padding: "16px 20px", borderRadius: 14,
                background: hoveredAction === mode.key ? "#FFFFFF" : "#FAFAF7",
                border: `1.5px solid ${hoveredAction === mode.key ? "#C4725A40" : "#F0EDE6"}`,
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: hoveredAction === mode.key ? "0 4px 16px rgba(0,0,0,0.06)" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>{mode.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#2D2A26" }}>{mode.name}</span>
              </div>
              <div style={{ fontSize: 11, color: "#8A8578", lineHeight: 1.4 }}>
                {mode.desc}
              </div>
              <div style={{
                fontSize: 9, color: "#B5AFA3", marginTop: 8,
                fontStyle: "italic",
              }}>
                Coming soon
              </div>
            </div>
          ))}
        </div>

        {/* Big Outcomes — visible context */}
        <div style={{ marginTop: 28 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: "#2D2A26", marginBottom: 10,
          }}>
            Big outcomes you're working toward
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {BIG_OUTCOMES.map(bo => (
              <div key={bo.id} style={{
                padding: "10px 16px", borderRadius: 12,
                background: "#FFFFFF", border: "1px solid #E8E4DC",
                display: "flex", alignItems: "center", gap: 10,
                cursor: "pointer",
              }}>
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                  background: bo.status === "aspirational" ? "#7B6B9E14" : "#5A9E6F14",
                  color: bo.status === "aspirational" ? "#7B6B9E" : "#5A9E6F",
                  textTransform: "capitalize",
                }}>
                  {bo.status.replace("_", " ")}
                </span>
                <span style={{ fontSize: 12, fontWeight: 500, color: "#2D2A26" }}>{bo.name}</span>
                <div style={{ display: "flex", gap: 3 }}>
                  {bo.values.map(vid => {
                    const v = VALUES.find(v => v.id === vid);
                    if (!v) return null;
                    const c = v.score < v.sufficiencyMark ? "#C4504A" : "#5A9E6F";
                    return <div key={vid} style={{
                      width: 6, height: 6, borderRadius: "50%", background: c,
                      opacity: 0.6,
                    }} />;
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
