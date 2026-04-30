// Today — proposed redesign.
// Same data shape as today-current.jsx, same scale, but applies:
//  - Bounded aging (recently-captured slightly heavier; old items don't keep fading)
//  - Equal-weight columns (no center divider; spacing only)
//  - Vision-board treatment for week intent
//  - Promoted "Next up" with terracotta left rule above columns
//  - In-progress items glow (warm tint + weight bump)
//  - Stats line removed
//  - THIS WEEK kept faded with hairline above
//  - Yesterday's-unfinished surfaced when present
//  - Close-the-day affordance at bottom (always available, quiet)

const todayProposedStyles = {
  page: {
    fontFamily: "'Source Sans 3', system-ui, sans-serif",
    background: "#FAFAF7",
    color: "#2D2A26",
    minHeight: "100%",
    padding: "0 32px 24px",
    boxSizing: "border-box",
  },
  navbar: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "10px 0", borderBottom: "1px solid #F0EDE6",
    fontSize: 13, fontWeight: 600,
    marginBottom: 16,
  },
  brand: { color: "#C4725A", marginRight: 12, fontWeight: 700 },
  tab: { padding: "4px 10px", borderRadius: 5, color: "#8A8578", cursor: "default", fontSize: 13, fontWeight: 600 },
  tabActive: { padding: "4px 10px", borderRadius: 5, color: "#C4725A", background: "#FDF6F3", border: "1px solid #C4725A40", fontSize: 13, fontWeight: 600 },
  admin: { marginLeft: "auto", color: "#C4725A", fontWeight: 700, fontSize: 13 },

  dateStrip: { display: "flex", gap: 28, paddingTop: 12, paddingBottom: 4 },
  dayCol: { display: "flex", flexDirection: "column" },
  dayLabel: { fontSize: 14, color: "#B5B0A8" },
  dayLabelActive: { fontSize: 14, color: "#2D2A26", fontWeight: 700 },
  daySub: { fontSize: 11, color: "#B5B0A8" },

  // Vision-board intent: full text, warm left rule, indented, not italic
  intent: {
    margin: "20px 0 18px",
    padding: "2px 0 2px 14px",
    borderLeft: "2px solid #C4725A",
    fontSize: 14,
    lineHeight: 1.55,
    color: "#3D3933",
    maxWidth: 820,
    textWrap: "pretty",
  },

  // Yesterday's unfinished prompt
  yesterdayCard: {
    margin: "0 0 14px",
    padding: "10px 14px",
    background: "#F8F7F4",
    border: "1px solid #F0EDE6",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "#5C5750",
  },
  yesterdayActions: { marginLeft: "auto", display: "flex", gap: 14 },
  yesterdayBtn: { color: "#C4725A", fontWeight: 600, cursor: "pointer", fontSize: 13 },
  yesterdayDismiss: { color: "#B5B0A8", cursor: "pointer", fontSize: 13 },

  // Capture row — more breathing room
  capture: {
    fontSize: 13, color: "#B5B0A8",
    padding: "12px 0 8px",
  },

  // Promoted Next-up
  nextUp: {
    margin: "8px 0 22px",
    padding: "8px 0 8px 14px",
    borderLeft: "2px solid #C4725A",
    display: "flex",
    alignItems: "baseline",
    gap: 10,
  },
  nextUpEyebrow: {
    fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#C4725A", textTransform: "uppercase",
  },
  nextUpTime: { fontSize: 13, color: "#8A8578", fontVariantNumeric: "tabular-nums" },
  nextUpName: { fontSize: 15, color: "#2D2A26", fontWeight: 600 },

  // Equal-weight columns, no divider
  cols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginTop: 4 },

  rowSched: {
    display: "grid", gridTemplateColumns: "44px 18px 1fr",
    alignItems: "start", padding: "5px 0", gap: 8,
    fontSize: 14,
  },
  rowTodo: {
    display: "grid", gridTemplateColumns: "18px 1fr",
    alignItems: "start", padding: "5px 0", gap: 8,
    fontSize: 14,
    borderRadius: 4,
  },
  rowInProgress: {
    background: "rgba(253, 246, 243, 0.6)",
    boxShadow: "inset 2px 0 0 #C4725A",
    paddingLeft: 8,
    marginLeft: -8,
  },
  time: { fontSize: 12, color: "#8A8578", paddingTop: 2, fontVariantNumeric: "tabular-nums" },
  itemDone: { color: "#B5B0A8", textDecoration: "line-through" },
  itemActive: { color: "#2D2A26" },
  itemInProgress: { color: "#2D2A26", fontWeight: 500 },
  itemFresh: { color: "#2D2A26" }, // captured today — stays full-weight
  itemSettled: { color: "#5C5750" }, // older but bounded — never below this

  cursorRule: {
    position: "relative",
    margin: "10px 0",
    height: 1,
    background: "#C4725A",
    opacity: 0.6,
  },
  cursorLabel: {
    position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)",
    background: "#FAFAF7", padding: "0 8px",
    fontSize: 11, color: "#C4725A", fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },

  // Hairline rule above THIS WEEK
  hairline: {
    height: 1, background: "#F0EDE6", margin: "32px 0 0",
  },
  thisWeekHead: {
    fontSize: 11, fontWeight: 600, letterSpacing: 0.6,
    color: "#B5B0A8", textTransform: "uppercase",
    marginTop: 18, marginBottom: 6,
  },
  thisWeekRow: {
    display: "grid", gridTemplateColumns: "18px 1fr 24px",
    alignItems: "start", padding: "8px 0", gap: 8,
    fontSize: 14, color: "#B5B0A8",
    borderBottom: "1px solid #F0EDE6",
  },
  lookingForward: {
    fontSize: 11, fontWeight: 600, letterSpacing: 0.6,
    color: "#8A8578", textTransform: "uppercase",
    padding: "16px 0 8px",
    cursor: "pointer",
  },

  // Quiet close-the-day affordance
  closeDay: {
    marginTop: 28,
    padding: "12px 0",
    borderTop: "1px solid #F0EDE6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontSize: 13,
    color: "#8A8578",
    cursor: "pointer",
  },
  closeDayMoon: {
    width: 14, height: 14, borderRadius: "50%",
    background: "radial-gradient(circle at 65% 35%, #FAFAF7 0 50%, #C4BFB4 50% 100%)",
  },
};

function CheckProposed({ status }) {
  const base = {
    width: 14, height: 14, border: "1.5px solid",
    borderRadius: 2, display: "inline-flex",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0, marginTop: 2,
  };
  if (status === "completed") return <span style={{ ...base, borderColor: "#8A857D", background: "#8A857D", color: "white", fontSize: 10 }}>✓</span>;
  if (status === "in_progress") return <span style={{ ...base, borderColor: "#C4725A" }}><span style={{ width: 6, height: 6, background: "#C4725A" }} /></span>;
  return <span style={{ ...base, borderColor: "#B5B0A8" }} />;
}

function PlanChipP() {
  return <span style={{ fontSize: 11, color: "#C4725A", marginLeft: 6, fontWeight: 500 }}>plan ▶</span>;
}

// Bounded contrast for to-do items based on capturedAgo days.
// 0-1 days = fresh (full weight, full color)
// 2-6 days = settled (slightly muted but legible)
// 7+ days = floor (same as settled — no further fading; aging is bounded)
function todoStyle(item) {
  if (item.status === "completed") return todayProposedStyles.itemDone;
  if (item.status === "in_progress") return todayProposedStyles.itemInProgress;
  const age = item.capturedAgo ?? 0;
  if (age <= 1) return todayProposedStyles.itemFresh;
  return todayProposedStyles.itemSettled; // bounded floor
}

function fmtP(t) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "a" : "p";
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hh}:${String(m).padStart(2, "0")}${ampm}`;
}

function TodayProposed() {
  const D = window.TODAY_DATA;
  // Mark t1 as in-progress for demo (Nathan: "I mark [x] in progress to draw my eye")
  const todoWithProgress = D.todo.map((t, i) => i === 0 ? { ...t, status: "in_progress" } : t);
  const completedSched = D.scheduled.filter(s => s.status === "completed");
  const upcomingSched  = D.scheduled.filter(s => s.status !== "completed");

  return (
    <div style={todayProposedStyles.page}>
      {/* Navbar */}
      <div style={todayProposedStyles.navbar}>
        <span style={todayProposedStyles.brand}>Wild Success</span>
        <span style={todayProposedStyles.tab}>Map</span>
        <span style={todayProposedStyles.tabActive}>Today</span>
        <span style={todayProposedStyles.tab}>Organize</span>
        <span style={todayProposedStyles.tab}>Plan</span>
        <span style={todayProposedStyles.tab}>Communicate</span>
        <span style={todayProposedStyles.tab}>Review</span>
        <span style={todayProposedStyles.tab}>Spending</span>
        <span style={todayProposedStyles.admin}>Admin</span>
      </div>

      {/* Date strip */}
      <div style={todayProposedStyles.dateStrip}>
        <div style={todayProposedStyles.dayCol}>
          <span style={todayProposedStyles.dayLabel}>Yesterday</span>
          <span style={todayProposedStyles.daySub}>Wed, Apr 29</span>
        </div>
        <div style={todayProposedStyles.dayCol}>
          <span style={todayProposedStyles.dayLabelActive}>Today</span>
          <span style={todayProposedStyles.daySub}>Thu, Apr 30</span>
        </div>
        <div style={todayProposedStyles.dayCol}>
          <span style={todayProposedStyles.dayLabel}>Tomorrow</span>
          <span style={todayProposedStyles.daySub}>Fri, May 1</span>
        </div>
      </div>

      {/* Vision-board intent — full text, warm rule */}
      <div style={todayProposedStyles.intent}>{D.weekIntent}</div>

      {/* Capture */}
      <div style={todayProposedStyles.capture}>capture...</div>

      {/* Promoted Next-up */}
      <div style={todayProposedStyles.nextUp}>
        <span style={todayProposedStyles.nextUpEyebrow}>Next up</span>
        <span style={todayProposedStyles.nextUpTime}>2:00p</span>
        <span style={todayProposedStyles.nextUpName}>{D.nextUp.name}</span>
      </div>

      {/* Two equal-weight columns */}
      <div style={todayProposedStyles.cols}>
        {/* Left: schedule */}
        <div>
          {completedSched.map(s => (
            <div key={s.id} style={todayProposedStyles.rowSched}>
              <span style={todayProposedStyles.time}>{fmtP(s.time)}</span>
              <CheckProposed status="completed" />
              <span style={todayProposedStyles.itemDone}>{s.name}{s.hasPlan && <PlanChipP />}</span>
            </div>
          ))}
          <div style={todayProposedStyles.cursorRule}>
            <span style={todayProposedStyles.cursorLabel}>11:16a</span>
          </div>
          {upcomingSched.map(s => (
            <div key={s.id} style={todayProposedStyles.rowSched}>
              <span style={todayProposedStyles.time}>{fmtP(s.time)}</span>
              <CheckProposed status="committed" />
              <span style={todayProposedStyles.itemActive}>{s.name}{s.hasPlan && <PlanChipP />}</span>
            </div>
          ))}
        </div>

        {/* Right: to-do pool — equal weight, bounded aging, in-progress glow */}
        <div>
          {todoWithProgress.map(t => {
            const isInProgress = t.status === "in_progress";
            return (
              <div
                key={t.id}
                style={{
                  ...todayProposedStyles.rowTodo,
                  ...(isInProgress ? todayProposedStyles.rowInProgress : {}),
                }}
              >
                <CheckProposed status={t.status} />
                <span style={todoStyle(t)}>
                  {t.name}{t.hasPlan && <PlanChipP />}
                </span>
              </div>
            );
          })}
          <div style={todayProposedStyles.lookingForward}>▶ LOOKING FORWARD</div>
        </div>
      </div>

      {/* Hairline + THIS WEEK */}
      <div style={todayProposedStyles.hairline} />
      <div style={todayProposedStyles.thisWeekHead}>THIS WEEK</div>
      {D.thisWeek.map(w => (
        <div key={w.id} style={todayProposedStyles.thisWeekRow}>
          <CheckProposed status="committed" />
          <span>{w.name}</span>
          <span style={{ color: "#C8C3BB", textAlign: "right" }}>···</span>
        </div>
      ))}

      {/* Quiet close-the-day affordance */}
      <div style={todayProposedStyles.closeDay}>
        <span style={todayProposedStyles.closeDayMoon} />
        <span>Close the day</span>
      </div>
    </div>
  );
}

window.TodayProposed = TodayProposed;
