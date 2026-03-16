import { useState } from "react";

const INITIAL_HOPPER = [
  { id: "h1", name: "Morning run", source: "template_proposal", activity: "Exercise", energyLevel: "A", context: "errand-out", emotionalWeight: "normal", durationMin: 30, durationMax: 45, flexibility: "soft_scheduled", values: ["Health"], domains: ["Health / Body"] },
  { id: "h2", name: "Call Mom back", source: "outside_request", activity: null, energyLevel: "B", context: "phone-anywhere", emotionalWeight: "heavy", durationMin: 15, durationMax: 30, flexibility: "anytime_today", values: ["Belonging"], domains: ["Family"], meta: { requestedBy: "Sister", note: "She called yesterday" } },
  { id: "h3", name: "Review Pine Creek proposal", source: "template_proposal", activity: "Business Development", energyLevel: "A", context: "focused-quiet", emotionalWeight: "normal", durationMin: 45, durationMax: 60, flexibility: "soft_scheduled", values: ["Purpose", "Finances"], domains: ["Work / Livelihood"] },
  { id: "h4", name: "Pay electric bill", source: "template_proposal", activity: "Budget & Bills", energyLevel: "B", context: "computer-home", emotionalWeight: "light", durationMin: 5, durationMax: 10, flexibility: "anytime_this_week", values: ["Financial Sufficiency"], domains: ["Finances"] },
  { id: "h5", name: "Schedule dentist appointment", source: "template_proposal", activity: "Health Maintenance", energyLevel: "B", context: "phone-anywhere", emotionalWeight: "heavy", durationMin: 5, durationMax: 10, flexibility: "anytime_this_week", values: ["Safety", "Health"], domains: ["Health / Body"] },
  { id: "h6", name: "Guitar practice", source: "template_proposal", activity: "Creative Practice", energyLevel: "B", context: "home", emotionalWeight: "light", durationMin: 20, durationMax: 40, flexibility: "anytime_today", values: ["Creative Expression"], domains: ["Creative Life"] },
  { id: "h7", name: "Write Wild Success session prompt", source: "quick_capture", activity: null, energyLevel: "A", context: "focused-quiet", emotionalWeight: "normal", durationMin: 60, durationMax: 90, flexibility: "soft_scheduled", values: ["Purpose", "Creative Expression"], domains: ["Work / Livelihood"] },
  { id: "h8", name: "Grocery run", source: "template_proposal", activity: "Household Errands", energyLevel: "C", context: "errand-out", emotionalWeight: "light", durationMin: 30, durationMax: 45, flexibility: "anytime_today", values: ["Safety"], domains: ["Home / Household"] },
  { id: "h9", name: "Men's group check-in text", source: "template_proposal", activity: "Men's Group", energyLevel: "B", context: "phone-anywhere", emotionalWeight: "normal", durationMin: 5, durationMax: 10, flexibility: "anytime_today", values: ["Belonging"], domains: ["Friendships / Social"] },
  { id: "h10", name: "Oil change — overdue", source: "template_proposal", activity: "Car Maintenance", energyLevel: "B", context: "errand-out", emotionalWeight: "normal", durationMin: 30, durationMax: 60, flexibility: "anytime_this_week", values: ["Safety"], domains: ["Home / Household"] },
];

const HARD_COMMITMENTS = [
  { id: "hc1", name: "Drive to Boulder with Erin", isHard: true, energyLevel: "C", emotionalWeight: "normal", scheduledTime: "4:30 PM", endTime: "5:45 PM", values: ["Belonging"], durationMin: 75, durationMax: 75 },
  { id: "hc2", name: "Dinner with Eric and Jenaye", isHard: true, energyLevel: "B", emotionalWeight: "normal", scheduledTime: "6:00 PM", endTime: "8:00 PM", values: ["Belonging", "Adventure"], durationMin: 120, durationMax: 120 },
];

const TIME_TEMPLATE = [
  { label: "Morning Focus", start: "8:00", end: "10:00", energyLevel: "A" },
  { label: "Comms & Calls", start: "10:00", end: "11:00", energyLevel: "B" },
  { label: "Deep Work", start: "11:00", end: "12:30", energyLevel: "A" },
  { label: "Lunch & Errands", start: "12:30", end: "2:00", energyLevel: "C" },
  { label: "Computer Time", start: "2:00", end: "4:00", energyLevel: "B" },
  { label: "Open / Buffer", start: "4:00", end: "5:00", energyLevel: "C" },
];

const INITIAL_BLOCKS = [
  { id: "tb1", label: "Morning Focus", start: "8:00", end: "10:00", context: "focused-quiet", energyLevel: "A", items: [] },
  { id: "tb2", label: "Comms & Calls", start: "10:00", end: "11:00", context: "comms-any", energyLevel: "B", items: [] },
  { id: "tb3", label: "Deep Work", start: "11:00", end: "12:30", context: "focused-quiet", energyLevel: "A", items: [] },
  { id: "tb4", label: "Lunch & Errands", start: "12:30", end: "2:00", context: "errand-out", energyLevel: "C", items: [] },
  { id: "tb5", label: "Computer Time", start: "2:00", end: "4:00", context: "computer-home", energyLevel: "B", items: [] },
  { id: "tb6", label: "Drive to Boulder + Dinner", start: "4:30", end: "8:00", context: "out", energyLevel: "B", items: [...HARD_COMMITMENTS], isHardBlock: true },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EC = { A: "#C4725A", B: "#4B82AF", C: "#7A9E82" };
const EL = { A: "Focus", B: "Routine", C: "Easy" };
const SL = { template_proposal: "Suggested", outside_request: "Request", quick_capture: "Captured", planning_function: "From Plan" };
const SI = { template_proposal: "◈", outside_request: "↗", quick_capture: "✎", planning_function: "◎" };
const WI = { light: "", normal: "", heavy: "◆" };

export default function OrganizeModal() {
  const [isOpen, setIsOpen] = useState(true);
  const [mode, setMode] = useState("setup");
  const [selectedDay, setSelectedDay] = useState("Wed");
  const [hopper, setHopper] = useState(INITIAL_HOPPER);
  const [timeBlocks, setTimeBlocks] = useState(INITIAL_BLOCKS);
  const [unscheduledTasks, setUnscheduledTasks] = useState([]);
  const [dragItem, setDragItem] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [dragBlock, setDragBlock] = useState(null);
  const [dragBlockOver, setDragBlockOver] = useState(null);
  const [hopperDrag, setHopperDrag] = useState(null);
  const [hopperDragOver, setHopperDragOver] = useState(null);
  const [completions, setCompletions] = useState({});
  const [committed, setCommitted] = useState(false);
  const [reflection, setReflection] = useState("");
  const [moodEnergy, setMoodEnergy] = useState(3);
  const [hopperFilter, setHopperFilter] = useState("all");
  const [showTemplate, setShowTemplate] = useState(true);
  const [addingBlock, setAddingBlock] = useState(false);
  const [newBlock, setNewBlock] = useState({ label: "", start: "", end: "", energyLevel: "B" });

  const today = "Wednesday, March 13";

  // ── Cross-panel drag ──
  const handleDragStart = (item, from) => { setDragItem({ ...item, fromSection: from }); };
  const handleDragEnd = () => { setDragItem(null); setDragOver(null); };
  const removeFromSource = (item) => {
    if (item.fromSection === "hopper") setHopper(h => h.filter(i => i.id !== item.id));
    else if (item.fromSection === "unscheduled") setUnscheduledTasks(t => t.filter(i => i.id !== item.id));
    else if (item.fromSection?.startsWith("block-")) {
      const bid = item.fromSection.replace("block-", "");
      setTimeBlocks(bs => bs.map(b => b.id === bid ? { ...b, items: b.items.filter(i => i.id !== item.id) } : b));
    }
  };
  const dropOnBlock = (bid) => { if (!dragItem || dragItem.isHard) return; removeFromSource(dragItem); setTimeBlocks(bs => bs.map(b => b.id === bid ? { ...b, items: [...b.items, dragItem] } : b)); setDragOver(null); setDragItem(null); };
  const dropOnUnsched = () => { if (!dragItem || dragItem.isHard) return; removeFromSource(dragItem); setUnscheduledTasks(t => [...t, dragItem]); setDragOver(null); setDragItem(null); };
  const dropOnHopper = () => { if (!dragItem || dragItem.isHard || dragItem.fromSection === "hopper") return; removeFromSource(dragItem); setHopper(h => [dragItem, ...h]); setDragOver(null); setDragItem(null); };
  const returnToHopper = (item, from) => {
    if (item.isHard) return;
    if (from === "unscheduled") setUnscheduledTasks(t => t.filter(i => i.id !== item.id));
    else if (from?.startsWith("block-")) { const bid = from.replace("block-", ""); setTimeBlocks(bs => bs.map(b => b.id === bid ? { ...b, items: b.items.filter(i => i.id !== item.id) } : b)); }
    setHopper(h => [item, ...h]);
  };
  const dismiss = (id) => { setHopper(h => h.filter(i => i.id !== id)); };

  // ── Block reorder ──
  const blockDragStart = (bid) => { if (timeBlocks.find(b => b.id === bid)?.isHardBlock) return; setDragBlock(bid); };
  const blockDrop = (tid) => {
    if (!dragBlock || dragBlock === tid) { setDragBlock(null); setDragBlockOver(null); return; }
    setTimeBlocks(bs => { const n = [...bs]; const fi = n.findIndex(b => b.id === dragBlock); const ti = n.findIndex(b => b.id === tid); const [m] = n.splice(fi, 1); n.splice(ti, 0, m); return n; });
    setDragBlock(null); setDragBlockOver(null);
  };

  // ── Hopper reorder ──
  const hopperReorderStart = (id) => { setHopperDrag(id); };
  const hopperReorderOver = (e, id) => { e.preventDefault(); if (hopperDrag && hopperDrag !== id) setHopperDragOver(id); };
  const hopperReorderDrop = (tid) => {
    if (!hopperDrag || hopperDrag === tid) { setHopperDrag(null); setHopperDragOver(null); return; }
    setHopper(h => { const n = [...h]; const fi = n.findIndex(i => i.id === hopperDrag); const ti = n.findIndex(i => i.id === tid); const [m] = n.splice(fi, 1); n.splice(ti, 0, m); return n; });
    setHopperDrag(null); setHopperDragOver(null);
  };
  const hopperReorderEnd = () => { setHopperDrag(null); setHopperDragOver(null); };

  // ── Inline item creation ──
  const addItemToBlock = (blockId, name) => {
    const item = { id: "new-" + Date.now(), name, source: "quick_capture", energyLevel: timeBlocks.find(b => b.id === blockId)?.energyLevel || "B", emotionalWeight: "normal", durationMin: 15, durationMax: 30, values: [], domains: [] };
    setTimeBlocks(bs => bs.map(b => b.id === blockId ? { ...b, items: [...b.items, item] } : b));
  };
  const addItemToUnsched = (name) => {
    const item = { id: "new-" + Date.now(), name, source: "quick_capture", energyLevel: "B", emotionalWeight: "normal", durationMin: 15, durationMax: 30, values: [], domains: [] };
    setUnscheduledTasks(t => [...t, item]);
  };

  // ── Add time block ──
  const createBlock = () => {
    if (!newBlock.label.trim()) return;
    const block = { id: "tb-" + Date.now(), label: newBlock.label.trim(), start: newBlock.start || "?", end: newBlock.end || "?", context: "", energyLevel: newBlock.energyLevel, items: [] };
    setTimeBlocks(bs => [...bs.filter(b => !b.isHardBlock), block, ...bs.filter(b => b.isHardBlock)]);
    setNewBlock({ label: "", start: "", end: "", energyLevel: "B" });
    setAddingBlock(false);
  };

  const toggleDone = (id) => { setCompletions(c => ({ ...c, [id]: c[id] === "done" ? undefined : "done" })); };
  const toggleSkip = (id) => { setCompletions(c => ({ ...c, [id]: c[id] === "skipped" ? undefined : "skipped" })); };

  const allSched = () => [
    ...timeBlocks.flatMap(b => b.items.map(i => ({ ...i, block: b.label, blockTime: b.start }))),
    ...unscheduledTasks.map(i => ({ ...i, block: "Anytime today", blockTime: null })),
  ];

  const fh = hopperFilter === "all" ? hopper : hopper.filter(h => h.energyLevel === hopperFilter);
  const totalSched = timeBlocks.reduce((s, b) => s + b.items.length, 0) + unscheduledTasks.length;

  // ── Inline add input component ──
  const InlineAdd = ({ placeholder, onAdd }) => {
    const [val, setVal] = useState("");
    return (
      <div style={{ padding: "4px 10px 6px", display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ color: "#C4BFB4", fontSize: 14 }}>+</span>
        <input type="text" value={val} onChange={e => setVal(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => { if (e.key === "Enter" && val.trim()) { onAdd(val.trim()); setVal(""); } }}
          style={{
            flex: 1, border: "none", background: "transparent", outline: "none",
            fontSize: 12, color: "#2D2A26", fontFamily: "'Source Sans 3', sans-serif",
            padding: "3px 0",
          }}
        />
      </div>
    );
  };

  const renderSchedItem = (item, from) => (
    <div key={item.id} draggable={!item.isHard}
      onDragStart={(e) => { if (item.isHard) return; e.stopPropagation(); handleDragStart(item, from); }}
      onDragEnd={handleDragEnd}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", marginBottom: 3,
        background: item.isHard ? "#9E6A4608" : "#FAFAF7", borderRadius: 8,
        border: item.isHard ? "1px solid #9E6A4620" : "1px solid transparent",
        cursor: item.isHard ? "default" : "grab", fontSize: 13, color: "#2D2A26",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.isHard ? "#9E6A46" : EC[item.energyLevel], flexShrink: 0 }} />
      <span style={{ flex: 1, fontWeight: 500 }}>
        {item.name}
        {item.isHard && <span style={{ fontSize: 10, color: "#9E6A46", marginLeft: 6 }}>{item.scheduledTime} – {item.endTime}</span>}
        {WI[item.emotionalWeight] && <span style={{ color: "#C4725A", marginLeft: 4, fontSize: 10 }}>{WI[item.emotionalWeight]}</span>}
      </span>
      {!item.isHard && <>
        <span style={{ fontSize: 11, color: "#B5B0A8" }}>{item.durationMin}–{item.durationMax}m</span>
        <button onClick={(e) => { e.stopPropagation(); returnToHopper(item, from); }} title="Return to hopper"
          style={{ width: 20, height: 20, borderRadius: 5, border: "1px solid #E8E4DC", background: "transparent", cursor: "pointer", fontSize: 11, color: "#B5B0A8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>←</button>
      </>}
    </div>
  );

  if (!isOpen) return (
    <button onClick={() => setIsOpen(true)} style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 1000, background: "#C4725A", color: "white",
      border: "none", borderRadius: 12, padding: "14px 28px", fontSize: 15,
      fontFamily: "'Source Sans 3', sans-serif", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 16px rgba(196,114,90,0.3)",
    }}>Organize</button>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999, background: "rgba(45,42,38,0.25)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Source Sans 3', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;600;700&display=swap" rel="stylesheet" />
      <div style={{
        width: "96vw", height: "93vh", maxWidth: 1500, background: "#FAFAF7", borderRadius: 16,
        boxShadow: "0 24px 80px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: "1px solid #E8E4DC", background: "white" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#2D2A26", letterSpacing: -0.3 }}>Organize</span>
            <span style={{ fontSize: 14, color: "#8A857D" }}>{today}</span>
            <div style={{ display: "flex", gap: 4, marginLeft: 12 }}>
              {[{ key: "setup", label: "Setup" }, { key: "reorg", label: "Reorg" }, { key: "capture", label: "Capture" }].map(m => (
                <button key={m.key} onClick={() => setMode(m.key)} style={{
                  padding: "6px 16px", borderRadius: 8, border: "1.5px solid",
                  borderColor: mode === m.key ? "#C4725A" : "#E8E4DC",
                  background: mode === m.key ? "#C4725A10" : "transparent",
                  color: mode === m.key ? "#C4725A" : "#8A857D",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif",
                }}>{m.label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {mode !== "capture" && !committed && totalSched > 0 && (
              <button onClick={() => setCommitted(true)} style={{
                padding: "8px 20px", borderRadius: 8, border: "none", background: "#C4725A", color: "white",
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif",
              }}>Commit Plan ({totalSched} items)</button>
            )}
            {committed && mode !== "capture" && <span style={{ fontSize: 13, color: "#5A9E6F", fontWeight: 600 }}>✓ Plan committed</span>}
            <button onClick={() => setIsOpen(false)} style={{
              width: 32, height: 32, borderRadius: 8, border: "1.5px solid #E8E4DC", background: "transparent",
              cursor: "pointer", fontSize: 16, color: "#8A857D", display: "flex", alignItems: "center", justifyContent: "center",
            }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* LEFT: Hopper */}
          {mode !== "capture" && (
            <div
              onDragOver={(e) => { e.preventDefault(); if (dragItem && dragItem.fromSection !== "hopper") setDragOver("hopper"); }}
              onDragLeave={() => { if (dragOver === "hopper") setDragOver(null); }}
              onDrop={dropOnHopper}
              style={{
                width: 340, borderRight: "1px solid #E8E4DC", display: "flex", flexDirection: "column",
                background: dragOver === "hopper" ? "#F0EDE8" : "white", transition: "background 0.15s",
              }}
            >
              <div style={{ padding: "14px 20px 10px", borderBottom: "1px solid #E8E4DC" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#2D2A26" }}>Hopper</span>
                  <span style={{ fontSize: 12, color: "#8A857D" }}>{hopper.length} items</span>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {["all", "A", "B", "C"].map(f => (
                    <button key={f} onClick={() => setHopperFilter(f)} style={{
                      padding: "3px 10px", borderRadius: 6, border: "1px solid",
                      borderColor: hopperFilter === f ? (f === "all" ? "#2D2A26" : EC[f]) : "#E8E4DC",
                      background: hopperFilter === f ? (f === "all" ? "#2D2A2608" : EC[f] + "10") : "transparent",
                      color: hopperFilter === f ? (f === "all" ? "#2D2A26" : EC[f]) : "#8A857D",
                      fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif",
                    }}>{f === "all" ? "All" : EL[f]}</button>
                  ))}
                </div>
                {dragItem && dragItem.fromSection !== "hopper" && (
                  <div style={{
                    marginTop: 8, padding: "8px 10px", borderRadius: 6,
                    background: "#4B82AF10", border: "1.5px dashed #4B82AF",
                    fontSize: 12, color: "#4B82AF", textAlign: "center", fontWeight: 600,
                  }}>← Drop here to unschedule</div>
                )}
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
                {fh.map(item => (
                  <div key={item.id} draggable
                    onDragStart={() => handleDragStart(item, "hopper")}
                    onDragEnd={() => { handleDragEnd(); hopperReorderEnd(); }}
                    onDragOver={(e) => hopperReorderOver(e, item.id)}
                    onDrop={(e) => { e.stopPropagation(); hopperReorderDrop(item.id); }}
                    style={{
                      padding: "10px 12px", marginBottom: 6, background: "white", borderRadius: 10,
                      border: "1.5px solid", borderColor: hopperDragOver === item.id ? "#C4725A" : "#E8E4DC",
                      cursor: "grab", transition: "all 0.15s", opacity: hopperDrag === item.id ? 0.4 : 1,
                    }}
                    onMouseEnter={e => { if (!hopperDragOver) e.currentTarget.style.borderColor = EC[item.energyLevel]; }}
                    onMouseLeave={e => { if (hopperDragOver !== item.id) e.currentTarget.style.borderColor = "#E8E4DC"; }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <div draggable onDragStart={(e) => { e.stopPropagation(); hopperReorderStart(item.id); }} onDragEnd={hopperReorderEnd}
                        style={{ cursor: "grab", color: "#D0CBC3", fontSize: 14, lineHeight: 1, userSelect: "none", flexShrink: 0, paddingTop: 1 }}
                        title="Drag to reorder">⠿</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: EC[item.energyLevel] }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#2D2A26", lineHeight: 1.2 }}>
                            {item.name}
                            {WI[item.emotionalWeight] && <span style={{ color: "#C4725A", marginLeft: 4, fontSize: 10 }}>{WI[item.emotionalWeight]}</span>}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10, color: "#8A857D", background: "#F5F3EF", padding: "1px 6px", borderRadius: 4 }}>{SI[item.source]} {SL[item.source]}</span>
                          <span style={{ fontSize: 10, color: "#8A857D" }}>{item.durationMin}–{item.durationMax}m</span>
                          {item.values.map(v => (
                            <span key={v} style={{ fontSize: 10, color: "#9E6A46", background: "#9E6A4610", padding: "1px 6px", borderRadius: 4 }}>{v}</span>
                          ))}
                        </div>
                        {item.meta?.requestedBy && (
                          <div style={{ fontSize: 11, color: "#C4725A", marginTop: 4, fontStyle: "italic" }}>↗ {item.meta.requestedBy}: {item.meta.note}</div>
                        )}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); dismiss(item.id); }} title="Dismiss for today"
                        style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid #E8E4DC", background: "transparent", cursor: "pointer", fontSize: 12, color: "#B5B0A8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
                    </div>
                  </div>
                ))}
                {fh.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "#B5B0A8", fontSize: 13 }}>{hopperFilter === "all" ? "Hopper is clear" : `No ${EL[hopperFilter].toLowerCase()} items`}</div>}
              </div>

              <div style={{ padding: "12px 16px", borderTop: "1px solid #E8E4DC" }}>
                <input type="text" placeholder="Capture something..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.target.value.trim()) {
                      setHopper(h => [{ id: "h" + Date.now(), name: e.target.value.trim(), source: "quick_capture", activity: null, energyLevel: "B", context: "", emotionalWeight: "normal", durationMin: 15, durationMax: 30, flexibility: "anytime_today", values: [], domains: [] }, ...h]);
                      e.target.value = "";
                    }
                  }}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E8E4DC", fontSize: 13, fontFamily: "'Source Sans 3', sans-serif", background: "#FAFAF7", outline: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>
          )}

          {/* CENTER: Day Plan */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "10px 24px", borderBottom: "1px solid #E8E4DC", display: "flex", alignItems: "center", gap: 4, background: "#FAFAF7" }}>
              {DAYS.map(d => (
                <button key={d} onClick={() => setSelectedDay(d)} style={{
                  padding: "5px 14px", borderRadius: 8, border: "1.5px solid",
                  borderColor: selectedDay === d ? "#2D2A26" : "transparent",
                  background: selectedDay === d ? "white" : "transparent",
                  color: selectedDay === d ? "#2D2A26" : "#8A857D",
                  fontSize: 13, fontWeight: selectedDay === d ? 700 : 400,
                  cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif",
                }}>{d}</button>
              ))}
              <div style={{ flex: 1 }} />
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={showTemplate} onChange={e => setShowTemplate(e.target.checked)} style={{ accentColor: "#C4BFB4" }} />
                <span style={{ fontSize: 11, color: "#B5B0A8" }}>Show time template</span>
              </label>
            </div>

            {mode === "capture" ? (
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
                <div style={{ maxWidth: 640, margin: "0 auto" }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#2D2A26", marginBottom: 4 }}>Close out the day</h3>
                  <p style={{ fontSize: 13, color: "#8A857D", marginBottom: 20 }}>Check off what got done. This is your integrity data.</p>
                  {allSched().length === 0 ? (
                    <div style={{ padding: 40, textAlign: "center", color: "#B5B0A8", fontSize: 14 }}>No items scheduled today.</div>
                  ) : (<>
                    {allSched().map(item => (
                      <div key={item.id} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", marginBottom: 6,
                        background: "white", borderRadius: 10, border: "1.5px solid",
                        borderColor: completions[item.id] === "done" ? "#5A9E6F" : completions[item.id] === "skipped" ? "#D4564E40" : "#E8E4DC",
                      }}>
                        <button onClick={() => toggleDone(item.id)} style={{
                          width: 24, height: 24, borderRadius: 7, border: "2px solid",
                          borderColor: completions[item.id] === "done" ? "#5A9E6F" : "#D0CBC3",
                          background: completions[item.id] === "done" ? "#5A9E6F" : "transparent",
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          color: "white", fontSize: 14, flexShrink: 0,
                        }}>{completions[item.id] === "done" ? "✓" : ""}</button>
                        <div style={{ flex: 1 }}>
                          <span style={{
                            fontSize: 14, fontWeight: 500, color: "#2D2A26",
                            textDecoration: completions[item.id] === "done" ? "line-through" : "none",
                            opacity: completions[item.id] === "skipped" ? 0.4 : 1,
                          }}>{item.name}</span>
                          <span style={{ fontSize: 11, color: "#B5B0A8", marginLeft: 8 }}>{item.blockTime ? `${item.blockTime} · ${item.block}` : item.block}</span>
                        </div>
                        <button onClick={() => toggleSkip(item.id)} style={{
                          padding: "3px 10px", borderRadius: 6, border: "1px solid",
                          borderColor: completions[item.id] === "skipped" ? "#D4564E" : "#E8E4DC",
                          background: completions[item.id] === "skipped" ? "#D4564E10" : "transparent",
                          color: completions[item.id] === "skipped" ? "#D4564E" : "#B5B0A8",
                          fontSize: 11, cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif",
                        }}>Didn't do</button>
                      </div>
                    ))}
                    <div style={{ marginTop: 24, padding: 20, background: "white", borderRadius: 12, border: "1.5px solid #E8E4DC" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#2D2A26", marginBottom: 12 }}>Reflection</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 12, color: "#8A857D", width: 80 }}>Energy / Mood</span>
                        {[1, 2, 3, 4, 5].map(n => (
                          <button key={n} onClick={() => setMoodEnergy(n)} style={{
                            width: 32, height: 32, borderRadius: 8, border: "1.5px solid",
                            borderColor: moodEnergy === n ? "#C4725A" : "#E8E4DC",
                            background: moodEnergy === n ? "#C4725A10" : "transparent",
                            color: moodEnergy === n ? "#C4725A" : "#8A857D",
                            fontSize: 14, cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif",
                          }}>{n}</button>
                        ))}
                      </div>
                      <textarea placeholder="How was today? (optional)" value={reflection} onChange={e => setReflection(e.target.value)}
                        style={{ width: "100%", minHeight: 60, padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E4DC", fontSize: 13, fontFamily: "'Source Sans 3', sans-serif", resize: "vertical", outline: "none", background: "#FAFAF7", boxSizing: "border-box" }} />
                      <div style={{ fontSize: 11, color: "#B5B0A8", marginTop: 6, fontStyle: "italic" }}>Custom reflection form: coming soon</div>
                    </div>
                    <button style={{ marginTop: 16, padding: "10px 24px", borderRadius: 8, border: "none", background: "#5A9E6F", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif" }}>Close Day</button>
                  </>)}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
                {timeBlocks.map(block => {
                  const tmpl = showTemplate ? TIME_TEMPLATE.find(t => t.label === block.label) : null;
                  return (
                    <div key={block.id} style={{ position: "relative", marginBottom: 12 }}>
                      {tmpl && (
                        <div style={{
                          position: "absolute", inset: -2, borderRadius: 14,
                          border: "1.5px dashed " + EC[tmpl.energyLevel] + "35",
                          background: EC[tmpl.energyLevel] + "05", pointerEvents: "none", zIndex: 0,
                        }}>
                          <div style={{ position: "absolute", top: 5, right: 10, fontSize: 9, color: EC[tmpl.energyLevel] + "70", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>template</div>
                        </div>
                      )}
                      <div
                        draggable={!block.isHardBlock && !dragItem}
                        onDragStart={(e) => { if (dragItem) return; e.dataTransfer.effectAllowed = "move"; blockDragStart(block.id); }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragItem) setDragOver(block.id);
                          else if (dragBlock && dragBlock !== block.id) setDragBlockOver(block.id);
                        }}
                        onDragLeave={() => { setDragOver(null); setDragBlockOver(null); }}
                        onDrop={() => { if (dragItem) dropOnBlock(block.id); else if (dragBlock) blockDrop(block.id); }}
                        onDragEnd={() => { setDragBlock(null); setDragBlockOver(null); }}
                        style={{
                          position: "relative", zIndex: 1, borderRadius: 12, border: "1.5px solid",
                          borderColor: dragBlockOver === block.id ? "#C4725A" : dragOver === block.id ? EC[block.energyLevel] : "#E8E4DC",
                          background: dragBlockOver === block.id ? "#C4725A08" : dragOver === block.id ? EC[block.energyLevel] + "08" : "white",
                          transition: "all 0.15s", overflow: "hidden",
                          opacity: dragBlock === block.id ? 0.4 : 1,
                          cursor: block.isHardBlock ? "default" : (dragItem ? "default" : "grab"),
                        }}
                      >
                        <div style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                          borderBottom: (block.items.length > 0 || !block.isHardBlock) ? "1px solid #E8E4DC" : "none",
                        }}>
                          {!block.isHardBlock && (
                            <div title="Drag to reorder block" style={{ cursor: "grab", color: "#C4BFB4", fontSize: 16, userSelect: "none", lineHeight: 1 }}>⠿</div>
                          )}
                          <div style={{ width: 4, height: 28, borderRadius: 2, background: block.isHardBlock ? "#9E6A46" : EC[block.energyLevel] }} />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#2D2A26" }}>{block.label}</span>
                            <span style={{ fontSize: 12, color: "#8A857D", marginLeft: 8 }}>{block.start} – {block.end}</span>
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 600,
                            color: block.isHardBlock ? "#9E6A46" : EC[block.energyLevel],
                            background: (block.isHardBlock ? "#9E6A46" : EC[block.energyLevel]) + "12",
                            padding: "2px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: 0.5,
                          }}>{block.isHardBlock ? "committed" : EL[block.energyLevel] + " time"}</span>
                        </div>

                        {block.items.length > 0 && (
                          <div style={{ padding: "6px 12px 2px" }}>
                            {block.items.map(item => renderSchedItem(item, `block-${block.id}`))}
                          </div>
                        )}

                        {/* Inline add for non-hard blocks */}
                        {!block.isHardBlock && (
                          <InlineAdd placeholder="Add task..." onAdd={(name) => addItemToBlock(block.id, name)} />
                        )}

                        {block.items.length === 0 && !block.isHardBlock && (
                          <div style={{ padding: "4px 16px 10px", textAlign: "center", color: "#C4BFB4", fontSize: 12, fontStyle: "italic" }}>
                            Drop {EL[block.energyLevel].toLowerCase()} tasks here
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add new time block */}
                {!addingBlock ? (
                  <button onClick={() => setAddingBlock(true)} style={{
                    width: "100%", padding: "10px", marginBottom: 12, borderRadius: 12,
                    border: "1.5px dashed #D0CBC3", background: "transparent",
                    color: "#8A857D", fontSize: 13, cursor: "pointer",
                    fontFamily: "'Source Sans 3', sans-serif", fontWeight: 600,
                    transition: "all 0.15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#C4725A"; e.currentTarget.style.color = "#C4725A"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#D0CBC3"; e.currentTarget.style.color = "#8A857D"; }}
                  >+ Add time block</button>
                ) : (
                  <div style={{
                    padding: "14px 16px", marginBottom: 12, borderRadius: 12,
                    border: "1.5px solid #C4725A", background: "white",
                  }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input type="text" placeholder="Block name" value={newBlock.label} onChange={e => setNewBlock(b => ({ ...b, label: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter") createBlock(); if (e.key === "Escape") setAddingBlock(false); }}
                        autoFocus
                        style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid #E8E4DC", fontSize: 13, fontFamily: "'Source Sans 3', sans-serif", outline: "none" }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                      <input type="text" placeholder="Start" value={newBlock.start} onChange={e => setNewBlock(b => ({ ...b, start: e.target.value }))}
                        style={{ width: 70, padding: "5px 8px", borderRadius: 6, border: "1px solid #E8E4DC", fontSize: 12, fontFamily: "'Source Sans 3', sans-serif", outline: "none" }} />
                      <span style={{ color: "#B5B0A8", fontSize: 12 }}>–</span>
                      <input type="text" placeholder="End" value={newBlock.end} onChange={e => setNewBlock(b => ({ ...b, end: e.target.value }))}
                        style={{ width: 70, padding: "5px 8px", borderRadius: 6, border: "1px solid #E8E4DC", fontSize: 12, fontFamily: "'Source Sans 3', sans-serif", outline: "none" }} />
                      <div style={{ display: "flex", gap: 3, marginLeft: 8 }}>
                        {["A", "B", "C"].map(level => (
                          <button key={level} onClick={() => setNewBlock(b => ({ ...b, energyLevel: level }))} style={{
                            padding: "3px 8px", borderRadius: 5, border: "1.5px solid",
                            borderColor: newBlock.energyLevel === level ? EC[level] : "#E8E4DC",
                            background: newBlock.energyLevel === level ? EC[level] + "10" : "transparent",
                            color: newBlock.energyLevel === level ? EC[level] : "#8A857D",
                            fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif",
                          }}>{EL[level]}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={createBlock} style={{
                        padding: "6px 16px", borderRadius: 6, border: "none", background: "#C4725A",
                        color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif",
                      }}>Add Block</button>
                      <button onClick={() => { setAddingBlock(false); setNewBlock({ label: "", start: "", end: "", energyLevel: "B" }); }} style={{
                        padding: "6px 16px", borderRadius: 6, border: "1px solid #E8E4DC", background: "transparent",
                        color: "#8A857D", fontSize: 12, cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif",
                      }}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* Unscheduled */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver("unscheduled"); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={dropOnUnsched}
                  style={{
                    padding: "12px 16px", borderRadius: 12, border: "1.5px dashed",
                    borderColor: dragOver === "unscheduled" ? "#4B82AF" : "#D0CBC3",
                    background: dragOver === "unscheduled" ? "#4B82AF08" : "#FAFAF7",
                    minHeight: 48, transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#8A857D", marginBottom: 6 }}>To-dos (no specific time)</div>
                  {unscheduledTasks.map(item => renderSchedItem(item, "unscheduled"))}
                  <InlineAdd placeholder="Add to-do..." onAdd={addItemToUnsched} />
                  {unscheduledTasks.length === 0 && (
                    <div style={{ textAlign: "center", color: "#C4BFB4", fontSize: 12, fontStyle: "italic", padding: 4 }}>
                      Drop tasks here or type above
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, border: "1.5px dashed #D0CBC3", background: "#F5F3EF", textAlign: "center" }}>
                  <span style={{ fontSize: 13, color: "#B5B0A8" }}>Google Calendar integration: coming soon</span>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Context */}
          <div style={{ width: 240, borderLeft: "1px solid #E8E4DC", background: "white", padding: 16, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#2D2A26", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Day at a Glance</div>
              {timeBlocks.map(b => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 3, height: 14, borderRadius: 1, background: b.isHardBlock ? "#9E6A46" : EC[b.energyLevel] }} />
                  <span style={{ fontSize: 11, color: "#8A857D", flex: 1 }}>{b.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: b.items.length > 0 ? "#2D2A26" : "#C4BFB4" }}>{b.items.length}</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <div style={{ width: 3, height: 14, borderRadius: 1, background: "#B5B0A8" }} />
                <span style={{ fontSize: 11, color: "#8A857D", flex: 1 }}>Anytime today</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: unscheduledTasks.length > 0 ? "#2D2A26" : "#C4BFB4" }}>{unscheduledTasks.length}</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#2D2A26", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Energy Balance</div>
              {["A", "B", "C"].map(level => {
                const c = [...timeBlocks.flatMap(b => b.items), ...unscheduledTasks].filter(i => i.energyLevel === level).length;
                return (
                  <div key={level} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: EC[level], width: 50 }}>{EL[level]}</span>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#F5F3EF" }}>
                      <div style={{ width: `${Math.min(c * 20, 100)}%`, height: "100%", borderRadius: 3, background: EC[level], transition: "width 0.3s" }} />
                    </div>
                    <span style={{ fontSize: 11, color: "#8A857D", width: 16, textAlign: "right" }}>{c}</span>
                  </div>
                );
              })}
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#2D2A26", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Values Served Today</div>
              {(() => {
                const ai = [...timeBlocks.flatMap(b => b.items), ...unscheduledTasks];
                const vc = {}; ai.forEach(i => i.values?.forEach(v => { vc[v] = (vc[v] || 0) + 1; }));
                const e = Object.entries(vc).sort((a, b) => b[1] - a[1]);
                if (!e.length) return <span style={{ fontSize: 11, color: "#C4BFB4", fontStyle: "italic" }}>Schedule items to see values coverage</span>;
                return e.map(([n, c]) => (
                  <div key={n} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "#2D2A26", marginBottom: 3 }}>
                    <span>{n}</span>
                    <span style={{ background: "#9E6A4612", color: "#9E6A46", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{c}</span>
                  </div>
                ));
              })()}
            </div>

            {(() => {
              const hv = [...timeBlocks.flatMap(b => b.items), ...unscheduledTasks].filter(i => i.emotionalWeight === "heavy");
              if (!hv.length) return null;
              return (
                <div style={{ padding: "10px 12px", borderRadius: 8, background: "#C4725A08", border: "1px solid #C4725A20" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#C4725A", marginBottom: 4 }}>◆ Heavy items today</div>
                  {hv.map(i => <div key={i.id} style={{ fontSize: 11, color: "#8A857D", marginBottom: 2 }}>{i.name}</div>)}
                  <div style={{ fontSize: 10, color: "#B5B0A8", marginTop: 4, fontStyle: "italic" }}>Consider scheduling these during your best energy</div>
                </div>
              );
            })()}

            <div style={{ padding: "10px 12px", borderRadius: 8, background: "#F5F3EF", border: "1px solid #E8E4DC" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#8A857D", marginBottom: 4 }}>Integrity Score</div>
              <div style={{ fontSize: 11, color: "#B5B0A8", fontStyle: "italic" }}>Coming soon — committed vs. completed over time</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}