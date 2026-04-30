// Today — current state. Matches the screenshot as closely as possible
// using values from components/today/TodayPage.tsx.

const todayCurrentStyles = {
  page: {
    fontFamily: "'Source Sans 3', system-ui, sans-serif",
    background: "#FAFAF7",
    color: "#2D2A26",
    minHeight: "100%",
    padding: "0 32px 80px",
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

  intent: {
    fontStyle: "italic",
    fontSize: 13,
    color: "#8A8578",
    margin: "16px 0 12px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  capture: {
    fontSize: 13, color: "#B5B0A8",
    padding: "8px 0",
  },
  nextUp: {
    fontSize: 13, color: "#2D2A26",
    marginTop: 4,
  },
  stats: {
    fontSize: 12, color: "#8A8578", marginTop: 2, marginBottom: 12,
  },

  cols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36, marginTop: 8 },
  colDivider: { borderRight: "1px solid #F0EDE6" },

  rowSched: {
    display: "grid", gridTemplateColumns: "44px 18px 1fr",
    alignItems: "start", padding: "5px 0", gap: 8,
    fontSize: 14,
  },
  rowTodo: {
    display: "grid", gridTemplateColumns: "18px 1fr",
    alignItems: "start", padding: "5px 0", gap: 8,
    fontSize: 14,
  },
  time: { fontSize: 12, color: "#8A8578", paddingTop: 2 },
  itemDone: { color: "#B5B0A8", textDecoration: "line-through" },
  itemActive: { color: "#2D2A26" },

  cursorRule: {
    position: "relative",
    margin: "8px 0",
    height: 1,
    background: "#C4725A",
  },
  cursorLabel: {
    position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)",
    background: "#FAFAF7", padding: "0 8px",
    fontSize: 11, color: "#C4725A", fontWeight: 600,
  },

  thisWeekHead: { fontSize: 11, fontWeight: 600, letterSpacing: 0.6, color: "#B5B0A8", textTransform: "uppercase", marginTop: 36, marginBottom: 6 },
  thisWeekRow: {
    display: "grid", gridTemplateColumns: "18px 1fr 24px",
    alignItems: "start", padding: "8px 0", gap: 8,
    fontSize: 14, color: "#B5B0A8",
    borderBottom: "1px solid #F0EDE6",
  },
  lookingForward: { fontSize: 11, fontWeight: 600, letterSpacing: 0.6, color: "#8A8578", textTransform: "uppercase", padding: "12px 0" },
};

function CheckCurrent({ status }) {
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

function PlanChip() {
  return <span style={{ fontSize: 11, color: "#C4725A", marginLeft: 6, fontWeight: 500 }}>plan ▶</span>;
}

function TodayCurrent() {
  const D = window.TODAY_DATA;
  const completedSched = D.scheduled.filter(s => s.status === "completed");
  const upcomingSched  = D.scheduled.filter(s => s.status !== "completed");

  return (
    <div style={todayCurrentStyles.page}>
      {/* Navbar */}
      <div style={todayCurrentStyles.navbar}>
        <span style={todayCurrentStyles.brand}>Wild Success</span>
        <span style={todayCurrentStyles.tab}>Map</span>
        <span style={todayCurrentStyles.tabActive}>Today</span>
        <span style={todayCurrentStyles.tab}>Organize</span>
        <span style={todayCurrentStyles.tab}>Plan</span>
        <span style={todayCurrentStyles.tab}>Communicate</span>
        <span style={todayCurrentStyles.tab}>Review</span>
        <span style={todayCurrentStyles.tab}>Spending</span>
        <span style={todayCurrentStyles.admin}>Admin</span>
      </div>

      {/* Date strip */}
      <div style={todayCurrentStyles.dateStrip}>
        <div style={todayCurrentStyles.dayCol}>
          <span style={todayCurrentStyles.dayLabel}>Yesterday</span>
          <span style={todayCurrentStyles.daySub}>Wed, Apr 29</span>
        </div>
        <div style={todayCurrentStyles.dayCol}>
          <span style={todayCurrentStyles.dayLabelActive}>Today</span>
          <span style={todayCurrentStyles.daySub}>Thu, Apr 30</span>
        </div>
        <div style={todayCurrentStyles.dayCol}>
          <span style={todayCurrentStyles.dayLabel}>Tomorrow</span>
          <span style={todayCurrentStyles.daySub}>Fri, May 1</span>
        </div>
      </div>

      {/* Intent (truncated, as in screenshot) */}
      <div style={todayCurrentStyles.intent}>{D.weekIntent.slice(0, 80) + "..."}</div>

      {/* Capture / Next up / Stats */}
      <div style={todayCurrentStyles.capture}>capture...</div>
      <div style={todayCurrentStyles.nextUp}>Next up: {D.nextUp.name} at 2:00p</div>
      <div style={todayCurrentStyles.stats}>{D.stats.done} done · {D.stats.scheduled} scheduled · {D.stats.todo} to-do</div>

      {/* Two columns */}
      <div style={todayCurrentStyles.cols}>
        {/* Left: schedule */}
        <div>
          {completedSched.map(s => (
            <div key={s.id} style={todayCurrentStyles.rowSched}>
              <span style={todayCurrentStyles.time}>{fmt(s.time)}</span>
              <CheckCurrent status="completed" />
              <span style={todayCurrentStyles.itemDone}>{s.name}{s.hasPlan && <PlanChip />}</span>
            </div>
          ))}
          {/* Time cursor */}
          <div style={todayCurrentStyles.cursorRule}>
            <span style={todayCurrentStyles.cursorLabel}>11:16a</span>
          </div>
          {upcomingSched.map(s => (
            <div key={s.id} style={todayCurrentStyles.rowSched}>
              <span style={todayCurrentStyles.time}>{fmt(s.time)}</span>
              <CheckCurrent status="committed" />
              <span style={todayCurrentStyles.itemActive}>{s.name}{s.hasPlan && <PlanChip />}</span>
            </div>
          ))}
        </div>

        {/* Right: to-do pool */}
        <div>
          {D.todo.map(t => (
            <div key={t.id} style={todayCurrentStyles.rowTodo}>
              <CheckCurrent status={t.status} />
              <span style={t.status === "completed" ? todayCurrentStyles.itemDone : todayCurrentStyles.itemActive}>
                {t.name}{t.hasPlan && <PlanChip />}
              </span>
            </div>
          ))}
          <div style={todayCurrentStyles.lookingForward}>▶ LOOKING FORWARD ({D.lookingForwardCount})</div>
        </div>
      </div>

      {/* This week */}
      <div style={todayCurrentStyles.thisWeekHead}>THIS WEEK</div>
      {D.thisWeek.map(w => (
        <div key={w.id} style={todayCurrentStyles.thisWeekRow}>
          <CheckCurrent status="committed" />
          <span>{w.name}</span>
          <span style={{ color: "#C8C3BB", textAlign: "right" }}>···</span>
        </div>
      ))}
    </div>
  );
}

function fmt(t) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "a" : "p";
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hh}:${String(m).padStart(2, "0")}${ampm}`;
}

window.TodayCurrent = TodayCurrent;
