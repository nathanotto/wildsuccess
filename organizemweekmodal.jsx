import { useState } from "react";

// ── Week Data ──────────────────────────────────────────────────────────
const DAYS_OF_WEEK = [
  { key: "mon", label: "Mon", date: "Mar 9" },
  { key: "tue", label: "Tue", date: "Mar 10" },
  { key: "wed", label: "Wed", date: "Mar 11" },
  { key: "thu", label: "Thu", date: "Mar 12" },
  { key: "fri", label: "Fri", date: "Mar 13" },
  { key: "sat", label: "Sat", date: "Mar 14" },
  { key: "sun", label: "Sun", date: "Mar 15" },
];

const TODAY_KEY = "fri";

const INITIAL_BLOCKS = {
  mon: [
    { id: "m1", label: "Morning Focus", start: "8:00", end: "10:00", energyLevel: "A", items: [
      { id: "mi1", name: "Pine Creek financials review", energyLevel: "A", emotionalWeight: "normal", durationMin: 60, durationMax: 90, values: ["Purpose", "Finances"], isHard: false },
    ]},
    { id: "m2", label: "Team Standup", start: "10:00", end: "10:30", energyLevel: "B", isHard: true, items: [
      { id: "mi2", name: "Team standup", energyLevel: "B", emotionalWeight: "normal", durationMin: 30, durationMax: 30, values: ["Purpose"], isHard: true, scheduledTime: "10:00 AM", endTime: "10:30 AM" },
    ]},
    { id: "m3", label: "Deep Work", start: "10:30", end: "12:30", energyLevel: "A", items: [] },
    { id: "m4", label: "Lunch & Errands", start: "12:30", end: "2:00", energyLevel: "C", items: [] },
    { id: "m5", label: "Computer Time", start: "2:00", end: "4:30", energyLevel: "B", items: [
      { id: "mi3", name: "Pay bills", energyLevel: "B", emotionalWeight: "light", durationMin: 15, durationMax: 20, values: ["Financial Sufficiency"], isHard: false },
    ]},
  ],
  tue: [
    { id: "t1", label: "Morning Focus", start: "8:00", end: "10:00", energyLevel: "A", items: [
      { id: "ti1", name: "Write session prompt", energyLevel: "A", emotionalWeight: "normal", durationMin: 60, durationMax: 90, values: ["Purpose", "Creative Expression"], isHard: false },
    ]},
    { id: "t2", label: "Comms", start: "10:00", end: "11:00", energyLevel: "B", items: [] },
    { id: "t3", label: "Deep Work", start: "11:00", end: "12:30", energyLevel: "A", items: [] },
    { id: "t4", label: "Lunch", start: "12:30", end: "1:30", energyLevel: "C", items: [] },
    { id: "t5", label: "Guitar Lesson", start: "7:00", end: "8:00", energyLevel: "B", isHard: true, items: [
      { id: "ti2", name: "Guitar lesson", energyLevel: "B", emotionalWeight: "light", durationMin: 60, durationMax: 60, values: ["Creative Expression"], isHard: true, scheduledTime: "7:00 PM", endTime: "8:00 PM" },
    ]},
  ],
  wed: [
    { id: "w1", label: "Morning Run", start: "6:30", end: "7:30", energyLevel: "A", items: [
      { id: "wi1", name: "Morning run", energyLevel: "A", emotionalWeight: "normal", durationMin: 30, durationMax: 45, values: ["Health"], isHard: false },
    ]},
    { id: "w2", label: "Morning Focus", start: "8:00", end: "10:00", energyLevel: "A", items: [] },
    { id: "w3", label: "Comms & Calls", start: "10:00", end: "11:00", energyLevel: "B", items: [
      { id: "wi2", name: "Call Mom", energyLevel: "B", emotionalWeight: "heavy", durationMin: 15, durationMax: 30, values: ["Belonging"], isHard: false },
    ]},
    { id: "w4", label: "Deep Work", start: "11:00", end: "12:30", energyLevel: "A", items: [] },
    { id: "w5", label: "Lunch & Errands", start: "12:30", end: "2:00", energyLevel: "C", items: [
      { id: "wi3", name: "Grocery run", energyLevel: "C", emotionalWeight: "light", durationMin: 30, durationMax: 45, values: ["Safety"], isHard: false },
    ]},
    { id: "w6", label: "Men's Group", start: "6:00", end: "8:00", energyLevel: "B", isHard: true, items: [
      { id: "wi4", name: "Men's group", energyLevel: "B", emotionalWeight: "normal", durationMin: 120, durationMax: 120, values: ["Belonging", "Purpose"], isHard: true, scheduledTime: "6:00 PM", endTime: "8:00 PM" },
    ]},
  ],
  thu: [
    { id: "th1", label: "Morning Focus", start: "8:00", end: "10:00", energyLevel: "A", items: [] },
    { id: "th2", label: "Therapy", start: "2:00", end: "3:00", energyLevel: "A", isHard: true, items: [
      { id: "thi1", name: "Therapy session", energyLevel: "A", emotionalWeight: "heavy", durationMin: 60, durationMax: 60, values: ["Health", "Belonging"], isHard: true, scheduledTime: "2:00 PM", endTime: "3:00 PM" },
    ]},
    { id: "th3", label: "Computer Time", start: "3:00", end: "5:00", energyLevel: "B", items: [] },
  ],
  fri: [
    { id: "f1", label: "Morning Focus", start: "8:00", end: "10:00", energyLevel: "A", items: [
      { id: "fi1", name: "Review Pine Creek proposal", energyLevel: "A", emotionalWeight: "normal", durationMin: 45, durationMax: 60, values: ["Purpose", "Finances"], isHard: false },
    ]},
    { id: "f2", label: "Comms", start: "10:00", end: "11:00", energyLevel: "B", items: [
      { id: "fi2", name: "Men's group check-in text", energyLevel: "B", emotionalWeight: "normal", durationMin: 5, durationMax: 10, values: ["Belonging"], isHard: false },
    ]},
    { id: "f3", label: "Computer Time", start: "11:00", end: "1:00", energyLevel: "B", items: [] },
    { id: "f4", label: "Drive to Boulder", start: "4:30", end: "5:45", energyLevel: "C", isHard: true, items: [
      { id: "fi3", name: "Drive to Boulder with Erin", energyLevel: "C", emotionalWeight: "normal", durationMin: 75, durationMax: 75, values: ["Belonging"], isHard: true, scheduledTime: "4:30 PM", endTime: "5:45 PM" },
    ]},
    { id: "f5", label: "Dinner", start: "6:00", end: "8:00", energyLevel: "B", isHard: true, items: [
      { id: "fi4", name: "Dinner with Eric and Jenaye", energyLevel: "B", emotionalWeight: "normal", durationMin: 120, durationMax: 120, values: ["Belonging", "Adventure"], isHard: true, scheduledTime: "6:00 PM", endTime: "8:00 PM" },
    ]},
  ],
  sat: [
    { id: "s1", label: "Farmers Market", start: "8:00", end: "10:00", energyLevel: "C", items: [
      { id: "si1", name: "Farmers market", energyLevel: "C", emotionalWeight: "light", durationMin: 60, durationMax: 90, values: ["Safety", "Adventure"], isHard: false },
    ]},
    { id: "s2", label: "Open", start: "10:00", end: "12:00", energyLevel: "C", items: [] },
    { id: "s3", label: "Family Time", start: "12:00", end: "5:00", energyLevel: "C", items: [] },
  ],
  sun: [
    { id: "su1", label: "Reflective Morning", start: "8:00", end: "10:00", energyLevel: "C", items: [] },
    { id: "su2", label: "Family Dinner", start: "5:00", end: "7:00", energyLevel: "B", isHard: true, items: [
      { id: "sui1", name: "Family dinner", energyLevel: "B", emotionalWeight: "normal", durationMin: 120, durationMax: 120, values: ["Belonging"], isHard: true, scheduledTime: "5:00 PM", endTime: "7:00 PM" },
    ]},
    { id: "su3", label: "Week Review & Plan", start: "7:30", end: "8:30", energyLevel: "B", items: [] },
  ],
};

const HOPPER_ITEMS = [
  { id: "wh1", name: "Oil change — overdue", source: "template_proposal", energyLevel: "B", emotionalWeight: "normal", durationMin: 30, durationMax: 60, values: ["Safety"], flexibility: "anytime_this_week" },
  { id: "wh2", name: "Schedule dentist appointment", source: "template_proposal", energyLevel: "B", emotionalWeight: "heavy", durationMin: 5, durationMax: 10, values: ["Safety", "Health"], flexibility: "anytime_this_week" },
  { id: "wh3", name: "Guitar practice (2 more this week)", source: "template_proposal", energyLevel: "B", emotionalWeight: "light", durationMin: 20, durationMax: 40, values: ["Creative Expression"], flexibility: "anytime_this_week" },
  { id: "wh4", name: "Run (2 more this week)", source: "template_proposal", energyLevel: "A", emotionalWeight: "normal", durationMin: 30, durationMax: 45, values: ["Health"], flexibility: "anytime_this_week" },
  { id: "wh5", name: "Read 30 min", source: "template_proposal", energyLevel: "C", emotionalWeight: "light", durationMin: 30, durationMax: 30, values: ["Learning"], flexibility: "anytime_this_week" },
  { id: "wh6", name: "Lunch with Karen", source: "outside_request", energyLevel: "B", emotionalWeight: "normal", durationMin: 60, durationMax: 90, values: ["Belonging"], flexibility: "soft_scheduled", meta: { requestedBy: "Karen" } },
  { id: "wh7", name: "Send article to Karen", source: "outside_request", energyLevel: "B", emotionalWeight: "light", durationMin: 5, durationMax: 10, values: ["Belonging"], flexibility: "anytime_this_week", meta: { requestedBy: "Self — promised Karen" } },
];

const COMPLETED_ITEMS = [
  { id: "c1", name: "Pine Creek financials review", day: "Mon", values: ["Purpose", "Finances"], energyLevel: "A" },
  { id: "c2", name: "Pay bills", day: "Mon", values: ["Financial Sufficiency"], energyLevel: "B" },
  { id: "c3", name: "Team standup", day: "Mon", values: ["Purpose"], energyLevel: "B" },
  { id: "c4", name: "Write session prompt", day: "Tue", values: ["Purpose", "Creative Expression"], energyLevel: "A" },
  { id: "c5", name: "Guitar lesson", day: "Tue", values: ["Creative Expression"], energyLevel: "B" },
  { id: "c6", name: "Morning run", day: "Wed", values: ["Health"], energyLevel: "A" },
  { id: "c7", name: "Call Mom", day: "Wed", values: ["Belonging"], energyLevel: "B" },
  { id: "c8", name: "Grocery run", day: "Wed", values: ["Safety"], energyLevel: "C" },
  { id: "c9", name: "Men's group", day: "Wed", values: ["Belonging", "Purpose"], energyLevel: "B" },
  { id: "c10", name: "Therapy session", day: "Thu", values: ["Health", "Belonging"], energyLevel: "A" },
];

const EC = { A: "#C4725A", B: "#4B82AF", C: "#7A9E82" };
const EL = { A: "Focus", B: "Routine", C: "Easy" };
const SL = { template_proposal: "Suggested", outside_request: "Request", quick_capture: "Captured" };
const SI = { template_proposal: "◈", outside_request: "↗", quick_capture: "✎" };
const WI = { light: "", normal: "", heavy: "◆" };

export default function OrganizeWeekModal() {
  const [isOpen, setIsOpen] = useState(true);
  const [blocks, setBlocks] = useState(INITIAL_BLOCKS);
  const [hopper, setHopper] = useState(HOPPER_ITEMS);
  const [completed] = useState(COMPLETED_ITEMS);
  const [dragItem, setDragItem] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [hopperFilter, setHopperFilter] = useState("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [rightPanel, setRightPanel] = useState("summary"); // summary | completed
  const [showTemplate, setShowTemplate] = useState(true);

  const weekLabel = "March 9 – 15, 2026";

  // ── Drag handlers ──
  const handleDragStart = (item, from) => { setDragItem({ ...item, fromSection: from }); };
  const handleDragEnd = () => { setDragItem(null); setDragOver(null); };

  const dropOnBlock = (dayKey, blockId) => {
    if (!dragItem || dragItem.isHard) return;
    // Remove from source
    if (dragItem.fromSection === "hopper") {
      setHopper(h => h.filter(i => i.id !== dragItem.id));
    } else if (dragItem.fromSection) {
      const [, srcDay, srcBlock] = dragItem.fromSection.match(/^block-(\w+)-(.+)$/) || [];
      if (srcDay && srcBlock) {
        setBlocks(bs => ({
          ...bs,
          [srcDay]: bs[srcDay].map(b => b.id === srcBlock ? { ...b, items: b.items.filter(i => i.id !== dragItem.id) } : b)
        }));
      }
    }
    // Add to target
    setBlocks(bs => ({
      ...bs,
      [dayKey]: bs[dayKey].map(b => b.id === blockId ? { ...b, items: [...b.items, dragItem] } : b)
    }));
    setDragOver(null); setDragItem(null);
  };

  const dropOnHopper = () => {
    if (!dragItem || dragItem.isHard || dragItem.fromSection === "hopper") return;
    const [, srcDay, srcBlock] = dragItem.fromSection?.match(/^block-(\w+)-(.+)$/) || [];
    if (srcDay && srcBlock) {
      setBlocks(bs => ({
        ...bs,
        [srcDay]: bs[srcDay].map(b => b.id === srcBlock ? { ...b, items: b.items.filter(i => i.id !== dragItem.id) } : b)
      }));
    }
    setHopper(h => [dragItem, ...h]);
    setDragOver(null); setDragItem(null);
  };

  const dismiss = (id) => { setHopper(h => h.filter(i => i.id !== id)); };

  const returnToHopper = (item, dayKey, blockId) => {
    if (item.isHard) return;
    setBlocks(bs => ({
      ...bs,
      [dayKey]: bs[dayKey].map(b => b.id === blockId ? { ...b, items: b.items.filter(i => i.id !== item.id) } : b)
    }));
    setHopper(h => [item, ...h]);
  };

  const fh = hopperFilter === "all" ? hopper : hopper.filter(h => h.energyLevel === hopperFilter);

  // ── Week stats ──
  const allScheduled = Object.values(blocks).flat().flatMap(b => b.items);
  const weekValueCounts = {};
  [...allScheduled, ...completed].forEach(i => i.values?.forEach(v => { weekValueCounts[v] = (weekValueCounts[v] || 0) + 1; }));
  const weekEnergyCounts = { A: 0, B: 0, C: 0 };
  allScheduled.forEach(i => { if (weekEnergyCounts[i.energyLevel] !== undefined) weekEnergyCounts[i.energyLevel]++; });
  const dayItemCounts = {};
  DAYS_OF_WEEK.forEach(d => {
    dayItemCounts[d.key] = (blocks[d.key] || []).reduce((s, b) => s + b.items.length, 0);
  });

  if (!isOpen) return (
    <button onClick={() => setIsOpen(true)} style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 1000, background: "#C4725A", color: "white",
      border: "none", borderRadius: 12, padding: "14px 28px", fontSize: 15,
      fontFamily: "'Source Sans 3', sans-serif", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 16px rgba(196,114,90,0.3)",
    }}>Organize Week</button>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999, background: "rgba(45,42,38,0.25)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Source Sans 3', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;600;700&display=swap" rel="stylesheet" />
      <div style={{
        width: "97vw", height: "95vh", maxWidth: 1600, background: "#FAFAF7", borderRadius: 16,
        boxShadow: "0 24px 80px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 24px", borderBottom: "1px solid #E8E4DC", background: "white",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#2D2A26", letterSpacing: -0.3 }}>Organize Week</span>
            <span style={{ fontSize: 14, color: "#8A857D" }}>{weekLabel}</span>
            <button style={{
              padding: "4px 12px", borderRadius: 6, border: "1px solid #E8E4DC", background: "transparent",
              color: "#8A857D", fontSize: 12, cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif",
            }}>← Prev</button>
            <button style={{
              padding: "4px 12px", borderRadius: 6, border: "1px solid #E8E4DC", background: "transparent",
              color: "#8A857D", fontSize: 12, cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif",
            }}>Next →</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={showTemplate} onChange={e => setShowTemplate(e.target.checked)} style={{ accentColor: "#C4BFB4" }} />
              <span style={{ fontSize: 11, color: "#B5B0A8" }}>Template</span>
            </label>
            <button onClick={() => setIsOpen(false)} style={{
              width: 32, height: 32, borderRadius: 8, border: "1.5px solid #E8E4DC", background: "transparent",
              cursor: "pointer", fontSize: 16, color: "#8A857D", display: "flex", alignItems: "center", justifyContent: "center",
            }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* LEFT: Hopper */}
          <div
            onDragOver={(e) => { e.preventDefault(); if (dragItem && dragItem.fromSection !== "hopper") setDragOver("hopper"); }}
            onDragLeave={() => { if (dragOver === "hopper") setDragOver(null); }}
            onDrop={dropOnHopper}
            style={{
              width: 280, borderRight: "1px solid #E8E4DC", display: "flex", flexDirection: "column",
              background: dragOver === "hopper" ? "#F0EDE8" : "white", transition: "background 0.15s",
            }}
          >
            <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid #E8E4DC" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#2D2A26" }}>This Week</span>
                <span style={{ fontSize: 11, color: "#8A857D" }}>{hopper.length}</span>
              </div>
              <div style={{ display: "flex", gap: 3 }}>
                {["all", "A", "B", "C"].map(f => (
                  <button key={f} onClick={() => setHopperFilter(f)} style={{
                    padding: "2px 8px", borderRadius: 5, border: "1px solid",
                    borderColor: hopperFilter === f ? (f === "all" ? "#2D2A26" : EC[f]) : "#E8E4DC",
                    background: hopperFilter === f ? (f === "all" ? "#2D2A2608" : EC[f] + "10") : "transparent",
                    color: hopperFilter === f ? (f === "all" ? "#2D2A26" : EC[f]) : "#8A857D",
                    fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif",
                  }}>{f === "all" ? "All" : EL[f]}</button>
                ))}
              </div>
              {dragItem && dragItem.fromSection !== "hopper" && (
                <div style={{
                  marginTop: 6, padding: "6px 8px", borderRadius: 5,
                  background: "#4B82AF10", border: "1.5px dashed #4B82AF",
                  fontSize: 11, color: "#4B82AF", textAlign: "center", fontWeight: 600,
                }}>← Drop to unschedule</div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "6px 10px" }}>
              {fh.map(item => (
                <div key={item.id} draggable
                  onDragStart={() => handleDragStart(item, "hopper")}
                  onDragEnd={handleDragEnd}
                  style={{
                    padding: "8px 10px", marginBottom: 5, background: "white", borderRadius: 8,
                    border: "1.5px solid #E8E4DC", cursor: "grab", transition: "all 0.12s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = EC[item.energyLevel]}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#E8E4DC"}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: EC[item.energyLevel], flexShrink: 0, display: "inline-block" }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#2D2A26", lineHeight: 1.2 }}>
                          {item.name}
                          {WI[item.emotionalWeight] && <span style={{ color: "#C4725A", marginLeft: 3, fontSize: 9 }}>{WI[item.emotionalWeight]}</span>}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 9, color: "#8A857D", background: "#F5F3EF", padding: "0px 5px", borderRadius: 3 }}>{SI[item.source]} {SL[item.source]}</span>
                        <span style={{ fontSize: 9, color: "#8A857D" }}>{item.durationMin}–{item.durationMax}m</span>
                      </div>
                      {item.meta?.requestedBy && (
                        <div style={{ fontSize: 10, color: "#C4725A", marginTop: 2, fontStyle: "italic" }}>↗ {item.meta.requestedBy}</div>
                      )}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); dismiss(item.id); }}
                      style={{ width: 18, height: 18, borderRadius: 4, border: "1px solid #E8E4DC", background: "transparent", cursor: "pointer", fontSize: 10, color: "#B5B0A8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
                  </div>
                </div>
              ))}
              {fh.length === 0 && <div style={{ padding: 16, textAlign: "center", color: "#B5B0A8", fontSize: 12 }}>All set for the week</div>}
            </div>

            <div style={{ padding: "10px 12px", borderTop: "1px solid #E8E4DC" }}>
              <input type="text" placeholder="Capture something..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.target.value.trim()) {
                    setHopper(h => [{ id: "wh" + Date.now(), name: e.target.value.trim(), source: "quick_capture", energyLevel: "B", emotionalWeight: "normal", durationMin: 15, durationMax: 30, values: [], flexibility: "anytime_this_week" }, ...h]);
                    e.target.value = "";
                  }
                }}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1.5px solid #E8E4DC", fontSize: 12, fontFamily: "'Source Sans 3', sans-serif", background: "#FAFAF7", outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>

          {/* CENTER: 7-Column Calendar */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Day headers */}
            <div style={{ display: "flex", borderBottom: "1px solid #E8E4DC", background: "white", flexShrink: 0 }}>
              {DAYS_OF_WEEK.map(d => (
                <div key={d.key} style={{
                  flex: 1, padding: "8px 4px", textAlign: "center",
                  borderRight: d.key !== "sun" ? "1px solid #F0EDE8" : "none",
                  background: d.key === TODAY_KEY ? "#C4725A06" : "transparent",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: d.key === TODAY_KEY ? "#C4725A" : "#2D2A26" }}>{d.label}</div>
                  <div style={{ fontSize: 10, color: d.key === TODAY_KEY ? "#C4725A" : "#8A857D" }}>{d.date}</div>
                  <div style={{ fontSize: 9, color: "#B5B0A8", marginTop: 2 }}>
                    {dayItemCounts[d.key]} items
                  </div>
                </div>
              ))}
            </div>

            {/* Day columns */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
              {DAYS_OF_WEEK.map(d => (
                <div key={d.key} style={{
                  flex: 1, overflowY: "auto", padding: "6px 4px",
                  borderRight: d.key !== "sun" ? "1px solid #F0EDE8" : "none",
                  background: d.key === TODAY_KEY ? "#C4725A03" : "transparent",
                }}>
                  {(blocks[d.key] || []).map(block => (
                    <div key={block.id}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(`${d.key}-${block.id}`); }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={() => dropOnBlock(d.key, block.id)}
                      style={{
                        marginBottom: 6, borderRadius: 8, overflow: "hidden",
                        border: "1px solid",
                        borderColor: dragOver === `${d.key}-${block.id}` ? EC[block.energyLevel] : "#E8E4DC",
                        background: dragOver === `${d.key}-${block.id}` ? EC[block.energyLevel] + "08" : "white",
                        transition: "all 0.12s",
                      }}
                    >
                      {/* Block header — compact */}
                      <div style={{
                        padding: "5px 8px", display: "flex", alignItems: "center", gap: 4,
                        borderBottom: block.items.length > 0 ? "1px solid #F0EDE8" : "none",
                      }}>
                        <div style={{ width: 3, height: 16, borderRadius: 1, background: block.isHard ? "#9E6A46" : EC[block.energyLevel], flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "#2D2A26", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{block.label}</div>
                          <div style={{ fontSize: 9, color: "#8A857D" }}>{block.start}–{block.end}</div>
                        </div>
                      </div>

                      {/* Items */}
                      {block.items.map(item => (
                        <div key={item.id}
                          draggable={!item.isHard}
                          onDragStart={(e) => { if (item.isHard) return; e.stopPropagation(); handleDragStart(item, `block-${d.key}-${block.id}`); }}
                          onDragEnd={handleDragEnd}
                          style={{
                            padding: "4px 8px", display: "flex", alignItems: "center", gap: 4,
                            background: item.isHard ? "#9E6A4606" : "#FAFAF7",
                            cursor: item.isHard ? "default" : "grab",
                            borderBottom: "1px solid #F5F3EF",
                          }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: item.isHard ? "#9E6A46" : EC[item.energyLevel], flexShrink: 0 }} />
                          <span style={{ fontSize: 10, fontWeight: 500, color: "#2D2A26", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {item.name}
                            {WI[item.emotionalWeight] && <span style={{ color: "#C4725A", fontSize: 8, marginLeft: 2 }}>{WI[item.emotionalWeight]}</span>}
                          </span>
                          {!item.isHard && (
                            <button onClick={(e) => { e.stopPropagation(); returnToHopper(item, d.key, block.id); }}
                              style={{ width: 14, height: 14, borderRadius: 3, border: "1px solid #E8E4DC", background: "transparent", cursor: "pointer", fontSize: 8, color: "#C4BFB4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>←</button>
                          )}
                        </div>
                      ))}

                      {/* Empty drop zone */}
                      {block.items.length === 0 && !block.isHard && (
                        <div style={{ padding: "6px 8px", textAlign: "center", color: "#D0CBC3", fontSize: 9, fontStyle: "italic" }}>
                          Drop here
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Summary / Completed */}
          <div style={{
            width: 240, borderLeft: "1px solid #E8E4DC", background: "white",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            {/* Tab toggle */}
            <div style={{ display: "flex", borderBottom: "1px solid #E8E4DC", flexShrink: 0 }}>
              {[{ key: "summary", label: "Week View" }, { key: "completed", label: "Done ✓" }].map(t => (
                <button key={t.key} onClick={() => setRightPanel(t.key)} style={{
                  flex: 1, padding: "10px 0", border: "none", borderBottom: "2px solid",
                  borderBottomColor: rightPanel === t.key ? "#C4725A" : "transparent",
                  background: "transparent", color: rightPanel === t.key ? "#C4725A" : "#8A857D",
                  fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif",
                }}>{t.label}</button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
              {rightPanel === "summary" ? (<>
                {/* Energy flow */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#2D2A26", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Energy This Week</div>
                  {["A", "B", "C"].map(level => (
                    <div key={level} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: EC[level], width: 44 }}>{EL[level]}</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#F5F3EF" }}>
                        <div style={{ width: `${Math.min(weekEnergyCounts[level] * 8, 100)}%`, height: "100%", borderRadius: 3, background: EC[level], transition: "width 0.3s" }} />
                      </div>
                      <span style={{ fontSize: 10, color: "#8A857D", width: 14, textAlign: "right" }}>{weekEnergyCounts[level]}</span>
                    </div>
                  ))}
                </div>

                {/* Values coverage */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#2D2A26", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Values This Week</div>
                  {Object.entries(weekValueCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                    <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "#2D2A26", marginBottom: 3 }}>
                      <span>{name}</span>
                      <span style={{ background: "#9E6A4612", color: "#9E6A46", padding: "0px 5px", borderRadius: 3, fontSize: 9, fontWeight: 600 }}>{count}</span>
                    </div>
                  ))}
                </div>

                {/* Day balance */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#2D2A26", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Items Per Day</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 60 }}>
                    {DAYS_OF_WEEK.map(d => {
                      const count = dayItemCounts[d.key];
                      const maxCount = Math.max(...Object.values(dayItemCounts), 1);
                      return (
                        <div key={d.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                          <div style={{
                            width: "100%", borderRadius: 3,
                            height: Math.max(4, (count / maxCount) * 48),
                            background: d.key === TODAY_KEY ? "#C4725A" : "#4B82AF40",
                            transition: "height 0.3s",
                          }} />
                          <span style={{ fontSize: 8, color: d.key === TODAY_KEY ? "#C4725A" : "#8A857D", fontWeight: 600 }}>{d.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Hopper remaining */}
                <div style={{ padding: "10px", borderRadius: 8, background: "#F5F3EF", border: "1px solid #E8E4DC" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#8A857D", marginBottom: 3 }}>Unscheduled</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: hopper.length > 0 ? "#C4725A" : "#5A9E6F" }}>{hopper.length}</div>
                  <div style={{ fontSize: 10, color: "#B5B0A8" }}>{hopper.length > 0 ? "items still in hopper" : "everything placed"}</div>
                </div>
              </>) : (<>
                {/* Completed this week — the happy place */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#5A9E6F", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Completed This Week
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#5A9E6F", marginBottom: 2 }}>{completed.length}</div>
                  <div style={{ fontSize: 11, color: "#8A857D", marginBottom: 12 }}>things done</div>
                </div>

                {/* Completed by day */}
                {DAYS_OF_WEEK.map(d => {
                  const dayCompleted = completed.filter(c => c.day === d.label);
                  if (dayCompleted.length === 0) return null;
                  return (
                    <div key={d.key} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#8A857D", marginBottom: 4 }}>{d.label} {d.date}</div>
                      {dayCompleted.map(item => (
                        <div key={item.id} style={{
                          display: "flex", alignItems: "center", gap: 6, padding: "5px 8px",
                          background: "#5A9E6F08", borderRadius: 6, marginBottom: 3,
                          border: "1px solid #5A9E6F15",
                        }}>
                          <span style={{ color: "#5A9E6F", fontSize: 12, flexShrink: 0 }}>✓</span>
                          <span style={{ fontSize: 11, color: "#2D2A26", flex: 1 }}>{item.name}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {/* Values served by completed items */}
                <div style={{ marginTop: 12, padding: "10px", borderRadius: 8, background: "#5A9E6F08", border: "1px solid #5A9E6F15" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#5A9E6F", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Values Expressed</div>
                  {(() => {
                    const vc = {};
                    completed.forEach(i => i.values?.forEach(v => { vc[v] = (vc[v] || 0) + 1; }));
                    return Object.entries(vc).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                      <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "#2D2A26", marginBottom: 2 }}>
                        <span>{name}</span>
                        <span style={{ background: "#5A9E6F18", color: "#5A9E6F", padding: "0px 5px", borderRadius: 3, fontSize: 9, fontWeight: 600 }}>{count}</span>
                      </div>
                    ));
                  })()}
                </div>

                {/* Integrity stub */}
                <div style={{ marginTop: 12, padding: "10px", borderRadius: 8, background: "#F5F3EF", border: "1px solid #E8E4DC" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#8A857D", marginBottom: 3 }}>Integrity Score</div>
                  <div style={{ fontSize: 10, color: "#B5B0A8", fontStyle: "italic" }}>Coming soon — committed vs. completed</div>
                </div>
              </>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}