import { useState, useMemo } from "react";

const COLORS = {
  bg: "#FAFAF7",
  surface: "#FFFFFF",
  text: "#2D2A26",
  textMuted: "#8A8578",
  textLight: "#B5AFA3",
  border: "#E8E4DC",
  borderLight: "#F0EDE6",
  preventive: "#C4725A",
  promotional: "#5A8F7B",
  warmHot: "#D4704F",
  warmMed: "#D4995A",
  warmCool: "#B5AFA3",
  cold: "#8B9DAF",
  overdue: "#C4504A",
  sufficient: "#6B9E7B",
  partial: "#D4995A",
  insufficient: "#C4504A",
  abundant: "#4A8B6B",
  accent: "#C4725A",
};

const DOMAIN_COLORS = [
  { bg: "#F7F0E8", border: "#E8DBC8" },
  { bg: "#EDF2F0", border: "#D4E0DB" },
  { bg: "#F0EDE6", border: "#E0D9CC" },
  { bg: "#F2EDEB", border: "#E0D5CF" },
  { bg: "#EEF0F5", border: "#D8DCE8" },
  { bg: "#F5F0ED", border: "#E5DCD5" },
  { bg: "#ECF2ED", border: "#D5E0D8" },
  { bg: "#F0EEF2", border: "#DDD8E2" },
  { bg: "#F2F2EE", border: "#E2E2D8" },
  { bg: "#EDF0F2", border: "#D5DCE2" },
];

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

const DOMAINS = [
  { id: 1, name: "Home", activities: [
    { id: "a1", name: "Making dinner", type: "recurring", freq: "daily", preventive: false, overdue: false, values: [1] },
    { id: "a2", name: "Running errands", type: "recurring", freq: "weekly", preventive: true, overdue: false, values: [1, 2] },
  ]},
  { id: 2, name: "Work & Career", activities: [
    { id: "a3", name: "Vibe coding", type: "recurring", freq: "daily", preventive: false, overdue: false, values: [6, 7] },
    { id: "a4", name: "Direct Outcomes meetings", type: "recurring", freq: "weekly", preventive: false, overdue: false, values: [7] },
    { id: "a5", name: "Business trips", type: "recurring", freq: "monthly", preventive: false, overdue: false, values: [7, 5] },
  ]},
  { id: 3, name: "Finances", activities: [
    { id: "a6", name: "Budget & bill pay", type: "recurring", freq: "monthly", preventive: true, overdue: false, values: [2] },
  ]},
  { id: 4, name: "Health", activities: [
    { id: "a7", name: "Health appointments", type: "recurring", freq: "quarterly", preventive: true, overdue: true, values: [3] },
  ]},
  { id: 5, name: "Family", activities: [
    { id: "a8", name: "Outings with Winston", type: "recurring", freq: "weekly", preventive: false, overdue: false, values: [4, 7] },
    { id: "a9", name: "Family legacy meetings", type: "recurring", freq: "monthly", preventive: false, overdue: false, values: [7, 1] },
    { id: "a10", name: "Watching media with Winston", type: "recurring", freq: "weekly", preventive: false, overdue: false, values: [4] },
    { id: "a11", name: "Watching media with Erin", type: "recurring", freq: "weekly", preventive: false, overdue: false, values: [4] },
  ]},
  { id: 6, name: "Friends & Community", activities: [
    { id: "a12", name: "Men's group", type: "recurring", freq: "biweekly", preventive: false, overdue: true, values: [4, 7] },
    { id: "a13", name: "Lunch dates", type: "recurring", freq: "weekly", preventive: false, overdue: true, values: [4, 5] },
  ]},
  { id: 7, name: "Recreation & Play", activities: [
    { id: "a14", name: "Travel planning", type: "one_time", preventive: false, overdue: false, values: [8, 5] },
  ]},
  { id: 8, name: "Inner Life", activities: [] },
  { id: 9, name: "Downtime", activities: [
    { id: "a15", name: "Reading news", type: "recurring", freq: "daily", preventive: false, overdue: false, values: [5] },
  ]},
  { id: 10, name: "Public Life", activities: [] },
];

const BIG_OUTCOMES = [
  { id: "bo1", name: "Launch Pine Creek with Constellation finance", status: "in_progress", target: "~6 months", domain: "Work & Career", values: [2, 7] },
  { id: "bo2", name: "Build Wild Success for personal use", status: "in_progress", target: "~6 months", domain: "Work & Career", values: [6, 7, 5] },
  { id: "bo3", name: "Secure foundation funding for Direct Outcomes", status: "in_progress", target: "~3 months", domain: "Work & Career", values: [7, 2] },
  { id: "bo4", name: "Rent a place part-time in Boulder", status: "aspirational", target: "~6 months", domain: "Home", values: [8, 5] },
  { id: "bo5", name: "Create more financial security for Erin", status: "in_progress", target: "~1 year", domain: "Finances", values: [1, 2, 4] },
];

const ACTION_MODES = [
  { name: "Right Now", desc: "Your most pressing actions based on your values and commitments." },
  { name: "Organizing", desc: "Arrange your week for better flow and less drag." },
  { name: "Planning", desc: "Define what needs to be done and look at the bigger picture." },
  { name: "Communicating", desc: "Respond to commitments, send communications, and follow up." },
  { name: "Spending", desc: "Align your spending with your values." },
  { name: "Activity Review", desc: "Review activities, log completions, and notice patterns." },
];

function scoreColor(score, sufficiencyMark = 4) {
  if (score >= 8) return "#3D8B5E";       // abundant — rich green
  if (score >= sufficiencyMark) return "#5A9E6F"; // above sufficient — green
  if (score >= sufficiencyMark - 1) return "#D4995A"; // just below — amber warning
  return "#C4504A";                         // well below — red
}

function suffBadge(s) {
  const map = {
    abundant: { color: COLORS.abundant, label: "Abundant" },
    sufficient: { color: COLORS.sufficient, label: "Sufficient" },
    partial: { color: COLORS.partial, label: "Partial" },
    insufficient: { color: COLORS.insufficient, label: "Insufficient" },
    unassessed: { color: COLORS.textLight, label: "Unassessed" },
  };
  return map[s] || map.unassessed;
}

function ValueCard({ value, selected, onClick, highlighted }) {
  const isSelected = selected?.id === value.id;
  const belowSufficiency = value.score < value.sufficiencyMark;
  const sm = value.sufficiencyMark;

  // Smooth shade from medium red (segment 0) through to green at sufficiency mark,
  // then progressively darker green into abundance.
  // The transition is continuous — no hard boundary, just a gradient.
  const segmentColors = Array.from({ length: 10 }, (_, i) => {
    // t goes from 0 (first segment) to 1 (last segment)
    // At t corresponding to sufficiency mark, color crosses from amber into light green
    const t = i / 9; // 0 to 1 across all 10
    const suffT = (sm - 0.5) / 9; // where sufficiency falls in the gradient

    if (t < suffT) {
      // Red shading toward amber: interpolate from medium red to amber
      const p = t / suffT; // 0 to 1 within the red zone
      const r = Math.round(196 - p * 36);  // 196 → 160
      const g = Math.round(78 + p * 82);   // 78 → 160
      const b = Math.round(74 + p * 26);   // 74 → 100
      return `rgb(${r}, ${g}, ${b})`;
    }
    // Green zone: light green at sufficiency, progressively richer/darker
    const p = (t - suffT) / (1 - suffT); // 0 to 1 within the green zone
    const r = Math.round(130 - p * 90);   // 130 → 40
    const g = Math.round(190 - p * 40);   // 190 → 150
    const b = Math.round(130 - p * 60);   // 130 → 70
    return `rgb(${r}, ${g}, ${b})`;
  });

  function segColor(i) {
    if (i >= value.score) return COLORS.borderLight;
    return segmentColors[i];
  }

  const labelColor = belowSufficiency ? "#C4504A" : value.score >= 8 ? "#2D7546" : "#5A9E6F";

  return (
    <div
      onClick={() => onClick(value)}
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        background: isSelected ? (belowSufficiency ? "#FDF5F4" : "#F2F8F4") : highlighted ? "#F8F5F0" : COLORS.surface,
        border: `1.5px solid ${isSelected ? labelColor : belowSufficiency ? "#C4504A30" : COLORS.border}`,
        cursor: "pointer",
        minWidth: 140,
        transition: "all 0.2s ease",
        boxShadow: isSelected ? `0 2px 12px ${labelColor}30` : "0 1px 3px rgba(0,0,0,0.04)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{
        fontSize: 11, fontWeight: 600, color: belowSufficiency ? "#C4504A" : COLORS.text,
        letterSpacing: "0.02em", marginBottom: 8,
      }}>
        {value.name}
      </div>
      <div style={{ position: "relative", height: 22, marginBottom: 4 }}>
        <div style={{ display: "flex", gap: 2, height: 10, alignItems: "center", marginTop: 6 }}>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} style={{
              flex: 1,
              height: i < value.score ? 10 : 4,
              borderRadius: 2,
              background: segColor(i),
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>
        {/* Sufficiency marker — prominent: thick line + triangle + label */}
        <div style={{
          position: "absolute",
          left: `${(sm / 10) * 100}%`,
          top: 0,
          bottom: 0,
          transform: "translateX(-50%)",
          display: "flex", flexDirection: "column", alignItems: "center",
          pointerEvents: "none",
        }}>
          <div style={{
            width: 0, height: 0,
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderTop: "6px solid #2D2A26",
          }} />
          <div style={{
            width: 2, flex: 1,
            background: "#2D2A26",
            opacity: 0.7,
            borderRadius: 1,
          }} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: labelColor }}>
          {value.score < sm ? "Needs attention" :
           value.score >= 8 ? "Abundant" : "Handled"}
        </span>
        <span style={{ fontSize: 9, color: COLORS.textMuted, fontVariantNumeric: "tabular-nums" }}>
          {value.score}/10
        </span>
      </div>
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 3,
        background: belowSufficiency
          ? "linear-gradient(90deg, #C4504A00, #C4504A60, #C4504A00)"
          : `linear-gradient(90deg, ${labelColor}00, ${labelColor}60, ${labelColor}00)`,
        opacity: 0.8,
      }} />
    </div>
  );
}

function ActivityCard({ activity, onSelect, isHighlighted }) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(activity); }}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
        borderRadius: 8, cursor: "pointer", transition: "all 0.15s ease",
        background: isHighlighted ? "#FFF8F0" : "transparent",
        border: activity.overdue ? `1.5px solid ${COLORS.overdue}40` : "1.5px solid transparent",
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = "#F8F5F0"}
      onMouseLeave={(e) => e.currentTarget.style.background = isHighlighted ? "#FFF8F0" : "transparent"}
    >
      {activity.overdue && (
        <div style={{
          width: 7, height: 7, borderRadius: "50%", background: COLORS.overdue,
          boxShadow: `0 0 6px ${COLORS.overdue}60`,
          animation: "pulse 2s ease-in-out infinite",
        }} />
      )}
      {activity.preventive && !activity.overdue && (
        <span style={{ fontSize: 10 }}>🛡</span>
      )}
      <span style={{
        fontSize: 12, color: activity.overdue ? COLORS.overdue : COLORS.text,
        fontWeight: activity.overdue ? 600 : 400,
        flex: 1,
      }}>
        {activity.name}
      </span>
      <span style={{ fontSize: 9, color: COLORS.textMuted }}>
        {activity.type === "recurring" ? activity.freq : "one-time"}
      </span>
    </div>
  );
}

function DomainBlob({ domain, colorIdx, selectedValue, onSelectActivity }) {
  const dc = DOMAIN_COLORS[colorIdx % DOMAIN_COLORS.length];
  const highlightedActivities = selectedValue
    ? domain.activities.filter(a => a.values.includes(selectedValue.id)).map(a => a.id)
    : [];
  const hasOverdue = domain.activities.some(a => a.overdue);

  return (
    <div style={{
      background: dc.bg,
      border: `1.5px solid ${hasOverdue ? COLORS.overdue + "40" : dc.border}`,
      borderRadius: 20,
      padding: "14px 16px",
      minHeight: 80,
      position: "relative",
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: COLORS.text, textTransform: "uppercase",
        letterSpacing: "0.06em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
      }}>
        {domain.name}
        {domain.activities.length > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 500, color: COLORS.textMuted, background: COLORS.surface,
            padding: "1px 6px", borderRadius: 8,
          }}>
            {domain.activities.length}
          </span>
        )}
      </div>
      {domain.activities.length === 0 ? (
        <div style={{ fontSize: 11, color: COLORS.textLight, fontStyle: "italic", padding: "4px 0" }}>
          No activities yet
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {domain.activities.map(a => (
            <ActivityCard
              key={a.id}
              activity={a}
              onSelect={onSelectActivity}
              isHighlighted={highlightedActivities.includes(a.id)}
            />
          ))}
        </div>
      )}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", top: 10, right: 12, fontSize: 16, color: COLORS.textLight,
          cursor: "pointer", width: 22, height: 22, display: "flex", alignItems: "center",
          justifyContent: "center", borderRadius: 6,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = COLORS.accent; e.currentTarget.style.background = COLORS.surface; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.textLight; e.currentTarget.style.background = "transparent"; }}
      >
        +
      </div>
    </div>
  );
}

function BigOutcomeCard({ outcome, onSelect }) {
  const statusColors = {
    in_progress: { bg: "#EDF5F0", text: "#4A8B6B", label: "In Progress" },
    aspirational: { bg: "#F0EEF5", text: "#7B6B9E", label: "Aspirational" },
    achieved: { bg: "#F0F5ED", text: "#6B9E4A", label: "Achieved" },
    abandoned: { bg: "#F2F0ED", text: "#8A8578", label: "Abandoned" },
  };
  const sc = statusColors[outcome.status] || statusColors.aspirational;

  return (
    <div
      onClick={() => onSelect(outcome)}
      style={{
        padding: "12px 16px", borderRadius: 14, background: COLORS.surface,
        border: `1.5px solid ${COLORS.border}`, cursor: "pointer",
        transition: "all 0.2s ease", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 6, lineHeight: 1.3 }}>
        {outcome.name}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 9, fontWeight: 600, color: sc.text, background: sc.bg,
          padding: "2px 8px", borderRadius: 6,
        }}>
          {sc.label}
        </span>
        <span style={{ fontSize: 9, color: COLORS.textMuted }}>{outcome.target}</span>
        <div style={{ display: "flex", gap: 3 }}>
          {outcome.values.map(vid => {
            const v = VALUES.find(v => v.id === vid);
            return v ? (
              <span key={vid} style={{
                fontSize: 8, color: v.type === "protect" ? COLORS.preventive : COLORS.promotional,
                background: v.type === "protect" ? COLORS.preventive + "12" : COLORS.promotional + "12",
                padding: "1px 5px", borderRadius: 4, fontWeight: 500,
              }}>
                {v.name.split(" ")[0]}
              </span>
            ) : null;
          })}
        </div>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center",
      justifyContent: "center",
    }}>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0, background: "rgba(45,42,38,0.25)",
        backdropFilter: "blur(2px)",
      }} />
      <div style={{
        position: "relative", background: COLORS.surface, borderRadius: 20,
        padding: "28px 32px", maxWidth: 480, width: "90%", maxHeight: "80vh",
        overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        border: `1px solid ${COLORS.borderLight}`,
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20,
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: COLORS.text }}>{title}</h3>
          <div onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer", color: COLORS.textMuted, fontSize: 18,
          }}
            onMouseEnter={(e) => e.currentTarget.style.background = COLORS.borderLight}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >×</div>
        </div>
        {children}
      </div>
    </div>
  );
}

function ValueDetail({ value, onClose }) {
  const sc = scoreColor(value.score);
  const linkedActivities = DOMAINS.flatMap(d => d.activities).filter(a => a.values.includes(value.id));
  const linkedOutcomes = BIG_OUTCOMES.filter(bo => bo.values.includes(value.id));
  const belowSufficiency = value.score < value.sufficiencyMark;

  return (
    <Modal title={`Edit Value: ${value.name}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Type</label>
          <div style={{
            marginTop: 4, padding: "8px 12px", borderRadius: 8, background: COLORS.bg, fontSize: 13,
            color: value.type === "protect" ? COLORS.preventive : COLORS.promotional, fontWeight: 600,
          }}>
            {value.type === "protect" ? "🛡 Protect" : "✦ Expand"}
          </div>
        </div>

        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Score</label>
          <div style={{ marginTop: 4, position: "relative" }}>
            <div style={{ display: "flex", gap: 3, height: 14, alignItems: "center", marginTop: 6 }}>
              {(() => {
                const sm = value.sufficiencyMark;
                const segmentColors = Array.from({ length: 10 }, (_, i) => {
                  const t = i / 9;
                  const suffT = (sm - 0.5) / 9;
                  if (t < suffT) {
                    const p = t / suffT;
                    return `rgb(${Math.round(196 - p * 36)}, ${Math.round(78 + p * 82)}, ${Math.round(74 + p * 26)})`;
                  }
                  const p = (t - suffT) / (1 - suffT);
                  return `rgb(${Math.round(130 - p * 90)}, ${Math.round(190 - p * 40)}, ${Math.round(130 - p * 60)})`;
                });
                return Array.from({ length: 10 }, (_, i) => {
                  const bg = i < value.score ? segmentColors[i] : COLORS.borderLight;
                  return <div key={i} style={{ flex: 1, height: i < value.score ? 14 : 6, borderRadius: 3, background: bg }} />;
                });
              })()}
            </div>
            <div style={{
              position: "absolute", left: `${(value.sufficiencyMark / 10) * 100}%`,
              top: 0, bottom: 0, transform: "translateX(-50%)",
              display: "flex", flexDirection: "column", alignItems: "center",
              pointerEvents: "none",
            }}>
              <div style={{
                width: 0, height: 0,
                borderLeft: "5px solid transparent", borderRight: "5px solid transparent",
                borderTop: "6px solid #2D2A26",
              }} />
              <div style={{ width: 2, flex: 1, background: "#2D2A26", opacity: 0.7, borderRadius: 1 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: belowSufficiency ? "#C4504A" : value.score >= 8 ? "#2D7546" : "#5A9E6F" }}>
                {value.score < value.sufficiencyMark ? "Needs attention" :
                 value.score >= 8 ? "Abundant" : "Handled"}
              </span>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>{value.score}/10</span>
            </div>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Linked Activities ({linkedActivities.length})
          </label>
          <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
            {linkedActivities.length === 0 ? (
              <span style={{ fontSize: 12, color: COLORS.textLight, fontStyle: "italic" }}>No activities serving this value</span>
            ) : linkedActivities.map(a => (
              <div key={a.id} style={{
                padding: "6px 10px", borderRadius: 8, background: COLORS.bg, fontSize: 12,
                color: a.overdue ? COLORS.overdue : COLORS.text, fontWeight: a.overdue ? 600 : 400,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {a.overdue && <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.overdue }} />}
                {a.name}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Linked Outcomes ({linkedOutcomes.length})
          </label>
          <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
            {linkedOutcomes.length === 0 ? (
              <span style={{ fontSize: 12, color: COLORS.textLight, fontStyle: "italic" }}>No outcomes linked</span>
            ) : linkedOutcomes.map(bo => (
              <div key={bo.id} style={{ padding: "6px 10px", borderRadius: 8, background: COLORS.bg, fontSize: 12, color: COLORS.text }}>
                {bo.name}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button style={{
            flex: 1, padding: "10px 16px", borderRadius: 10, border: "none",
            background: COLORS.accent, color: "#fff", fontSize: 13, fontWeight: 600,
            cursor: "pointer",
          }}>Save</button>
          <button onClick={onClose} style={{
            padding: "10px 16px", borderRadius: 10, border: `1.5px solid ${COLORS.border}`,
            background: "transparent", color: COLORS.textMuted, fontSize: 13, fontWeight: 500,
            cursor: "pointer",
          }}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

function ActivityDetail({ activity, onClose }) {
  const domain = DOMAINS.find(d => d.activities.some(a => a.id === activity.id));
  const linkedValues = VALUES.filter(v => activity.values.includes(v.id));
  const linkedOutcome = BIG_OUTCOMES.find(bo => {
    const domainActivities = DOMAINS.find(d => d.name === bo.domain)?.activities || [];
    return domainActivities.some(a => a.id === activity.id);
  });

  return (
    <Modal title={`Edit Activity: ${activity.name}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Type</label>
            <div style={{ marginTop: 4, padding: "8px 12px", borderRadius: 8, background: COLORS.bg, fontSize: 13 }}>
              {activity.type === "recurring" ? `🔄 Recurring · ${activity.freq}` : "📌 One-time"}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Domain</label>
            <div style={{ marginTop: 4, padding: "8px 12px", borderRadius: 8, background: COLORS.bg, fontSize: 13 }}>
              {domain?.name || "Unassigned"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {activity.preventive && (
            <div style={{
              padding: "6px 10px", borderRadius: 8, background: COLORS.preventive + "12",
              color: COLORS.preventive, fontSize: 11, fontWeight: 600,
            }}>
              🛡 Preventive System
            </div>
          )}
          {activity.overdue && (
            <div style={{
              padding: "6px 10px", borderRadius: 8, background: COLORS.overdue + "15",
              color: COLORS.overdue, fontSize: 11, fontWeight: 600,
            }}>
              ⚠ Overdue
            </div>
          )}
        </div>

        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Serves Values
          </label>
          <div style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {linkedValues.map(v => (
              <span key={v.id} style={{
                padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 500,
                color: v.type === "protect" ? COLORS.preventive : COLORS.promotional,
                background: v.type === "protect" ? COLORS.preventive + "12" : COLORS.promotional + "12",
              }}>
                {v.name}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button style={{
            flex: 1, padding: "10px 16px", borderRadius: 10, border: "none",
            background: COLORS.accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>Save</button>
          <button onClick={onClose} style={{
            padding: "10px 16px", borderRadius: 10, border: `1.5px solid ${COLORS.border}`,
            background: "transparent", color: COLORS.textMuted, fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}>Cancel</button>
          <button style={{
            padding: "10px 16px", borderRadius: 10, border: `1.5px solid ${COLORS.overdue}40`,
            background: "transparent", color: COLORS.overdue, fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}>Delete</button>
        </div>
      </div>
    </Modal>
  );
}

function ComingSoonModal({ mode, onClose }) {
  return (
    <Modal title={mode.name} onClose={onClose}>
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🚧</div>
        <div style={{ fontSize: 14, color: COLORS.text, marginBottom: 8, fontWeight: 500 }}>Coming Soon</div>
        <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.5 }}>{mode.desc}</div>
      </div>
    </Modal>
  );
}

export default function WildSuccessMap() {
  const [selectedValue, setSelectedValue] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [activeMode, setActiveMode] = useState(null);
  const [showValueDetail, setShowValueDetail] = useState(null);

  const preventiveValues = VALUES.filter(v => v.type === "protect");
  const promotionalValues = VALUES.filter(v => v.type === "expand");

  const overdueCount = DOMAINS.flatMap(d => d.activities).filter(a => a.overdue).length;

  return (
    <div style={{
      fontFamily: "'Source Sans 3', 'Source Sans Pro', Georgia, serif",
      background: COLORS.bg, minHeight: "100vh", color: COLORS.text,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&display=swap');
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.borderLight}; border-radius: 3px; }
      `}</style>

      {/* NAV BAR */}
      <div style={{
        padding: "10px 24px", display: "flex", alignItems: "center", gap: 16,
        borderBottom: `1px solid ${COLORS.borderLight}`, background: COLORS.surface,
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.accent, letterSpacing: "-0.02em", marginRight: 8 }}>
          Wild Success
        </div>
        <div style={{ display: "flex", gap: 4, flex: 1, flexWrap: "wrap" }}>
          {ACTION_MODES.map(mode => (
            <button key={mode.name} onClick={() => setActiveMode(mode)} style={{
              padding: "5px 10px", borderRadius: 6, border: `1px solid ${COLORS.borderLight}`,
              background: "transparent", fontSize: 10, fontWeight: 500, color: COLORS.textMuted,
              cursor: "pointer", whiteSpace: "nowrap",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.bg; e.currentTarget.style.color = COLORS.text; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = COLORS.textMuted; }}
            >
              {mode.name}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {overdueCount > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: COLORS.overdue, background: COLORS.overdue + "12",
              padding: "3px 8px", borderRadius: 6,
            }}>
              {overdueCount} overdue
            </span>
          )}
          <button style={{
            padding: "5px 12px", borderRadius: 6, border: `1px solid ${COLORS.borderLight}`,
            background: "transparent", fontSize: 10, fontWeight: 500, color: COLORS.textMuted, cursor: "pointer",
          }}>AI Help</button>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", background: COLORS.accent + "20",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: COLORS.accent, cursor: "pointer",
          }}>N</div>
        </div>
      </div>

      <div style={{ padding: "20px 24px", maxWidth: 1400, margin: "0 auto" }}>

        {/* VALUES BAR */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.preventive, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Protect
            </span>
            <div style={{ flex: 1, height: 1, background: COLORS.borderLight }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.promotional, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Expand
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {preventiveValues.map(v => (
              <ValueCard key={v.id} value={v} selected={selectedValue}
                highlighted={showValueDetail?.id === v.id}
                onClick={(v) => { setSelectedValue(selectedValue?.id === v.id ? null : v); setShowValueDetail(v); }} />
            ))}
            <div style={{ width: 1, background: COLORS.border, margin: "4px 4px", flexShrink: 0 }} />
            {promotionalValues.map(v => (
              <ValueCard key={v.id} value={v} selected={selectedValue}
                highlighted={showValueDetail?.id === v.id}
                onClick={(v) => { setSelectedValue(selectedValue?.id === v.id ? null : v); setShowValueDetail(v); }} />
            ))}
            <div style={{
              minWidth: 40, display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 12, border: `1.5px dashed ${COLORS.borderLight}`, cursor: "pointer",
              color: COLORS.textLight, fontSize: 18,
            }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.accent}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.borderLight}
            >+</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 24 }}>
          {/* DOMAINS CANVAS */}
          <div style={{ flex: 1 }}>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 14,
            }}>
              {DOMAINS.map((domain, idx) => (
                <DomainBlob
                  key={domain.id}
                  domain={domain}
                  colorIdx={idx}
                  selectedValue={selectedValue}
                  onSelectActivity={(a) => setSelectedActivity(a)}
                />
              ))}
            </div>
          </div>

          {/* BIG OUTCOMES SIDEBAR */}
          <div style={{ width: 280, flexShrink: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase",
              letterSpacing: "0.08em", marginBottom: 10,
            }}>
              Big Outcomes
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {BIG_OUTCOMES.map(bo => (
                <BigOutcomeCard key={bo.id} outcome={bo} onSelect={setSelectedOutcome} />
              ))}
              <div style={{
                padding: "12px 16px", borderRadius: 14, border: `1.5px dashed ${COLORS.borderLight}`,
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                color: COLORS.textLight, fontSize: 12, fontWeight: 500,
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.color = COLORS.accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.borderLight; e.currentTarget.style.color = COLORS.textLight; }}
              >
                + Add Outcome
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM ADD BAR */}
        <div style={{
          marginTop: 20, padding: "12px 0", borderTop: `1px solid ${COLORS.borderLight}`,
          display: "flex", gap: 12,
        }}>
          {["Add Value", "Add Domain", "Add Activity", "Add Big Outcome"].map(label => (
            <button key={label} style={{
              padding: "7px 14px", borderRadius: 8, border: `1.5px solid ${COLORS.borderLight}`,
              background: "transparent", fontSize: 11, fontWeight: 500, color: COLORS.textMuted,
              cursor: "pointer",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.color = COLORS.accent; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.borderLight; e.currentTarget.style.color = COLORS.textMuted; }}
            >
              + {label}
            </button>
          ))}
        </div>
      </div>

      {/* MODALS */}
      {showValueDetail && (
        <ValueDetail value={showValueDetail} onClose={() => { setShowValueDetail(null); setSelectedValue(null); }} />
      )}
      {selectedActivity && (
        <ActivityDetail activity={selectedActivity} onClose={() => setSelectedActivity(null)} />
      )}
      {selectedOutcome && (
        <Modal title={selectedOutcome.name} onClose={() => setSelectedOutcome(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</label>
              <div style={{ marginTop: 4, padding: "8px 12px", borderRadius: 8, background: COLORS.bg, fontSize: 13, textTransform: "capitalize" }}>
                {selectedOutcome.status.replace("_", " ")}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Target</label>
              <div style={{ marginTop: 4, padding: "8px 12px", borderRadius: 8, background: COLORS.bg, fontSize: 13 }}>
                {selectedOutcome.target}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Serves Values</label>
              <div style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {selectedOutcome.values.map(vid => {
                  const v = VALUES.find(v => v.id === vid);
                  return v ? (
                    <span key={vid} style={{
                      padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 500,
                      color: v.type === "protect" ? COLORS.preventive : COLORS.promotional,
                      background: v.type === "protect" ? COLORS.preventive + "12" : COLORS.promotional + "12",
                    }}>{v.name}</span>
                  ) : null;
                })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button style={{
                flex: 1, padding: "10px 16px", borderRadius: 10, border: "none",
                background: COLORS.accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>Save</button>
              <button onClick={() => setSelectedOutcome(null)} style={{
                padding: "10px 16px", borderRadius: 10, border: `1.5px solid ${COLORS.border}`,
                background: "transparent", color: COLORS.textMuted, fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
      {activeMode && (
        <ComingSoonModal mode={activeMode} onClose={() => setActiveMode(null)} />
      )}
    </div>
  );
}
