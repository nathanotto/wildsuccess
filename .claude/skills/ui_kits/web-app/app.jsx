// app.jsx — wires the kit together; demonstrates Today + Map + Capture + Modal
const initialItems = [
  { id: 1, title: 'Email Sam re: Q3 budget',         bucket: 'now',   state: 'in_progress', linked: ['Work'],   time: '9:30a' },
  { id: 2, title: 'Morning walk',                    bucket: 'now',   state: 'completed',   linked: ['Health'], time: '7:00a' },
  { id: 3, title: 'Drop off paperwork',              bucket: 'next',  state: 'committed',   linked: ['Money'],  time: '11a' },
  { id: 4, title: 'Drafting Q3 plan',                bucket: 'today', state: 'in_progress', linked: ['Work']             },
  { id: 5, title: 'Coffee w/ Sam',                   bucket: 'today', state: 'skipped',     linked: ['Family']           },
  { id: 6, title: 'Tax review (pick up Mon)',        bucket: 'today', state: 'parked',      linked: ['Money']            },
  { id: 7, title: 'Capture something to think about later', bucket: 'today', state: 'committed' },
  { id: 8, title: 'Read 30 min — Anti-Fragile',      bucket: 'later', state: 'committed',   linked: ['Spirit']           },
];

function App() {
  const [tab, setTab] = React.useState('Today');
  const [items, setItems] = React.useState(initialItems);
  const [editing, setEditing] = React.useState(null);
  const [toast, setToast] = React.useState(null);

  const cycle = (s) => {
    const order = ['committed', 'in_progress', 'completed', 'parked', 'skipped'];
    const i = order.indexOf(s);
    return order[(i + 1) % order.length];
  };
  const onToggle = (it) => setItems(items.map(x => x.id === it.id ? { ...x, state: cycle(x.state) } : x));
  const onCapture = (text) => {
    const id = Math.max(0, ...items.map(x => x.id)) + 1;
    setItems([{ id, title: text, bucket: 'today', state: 'committed' }, ...items]);
    setToast('Captured to Today');
    setTimeout(() => setToast(null), 1800);
  };
  const onSave = (vals) => {
    setItems(items.map(x => x.id === editing.id ? { ...x, title: vals.name } : x));
    setEditing(null);
    setToast('Saved');
    setTimeout(() => setToast(null), 1500);
  };

  const overdue = items.filter(i => i.state === 'parked').length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ws-bg-page)', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        active={tab} onTab={setTab}
        badges={{ Today: items.filter(i => ['now','next','today'].includes(i.bucket)).length, Organize: 3 }}
        overdue={overdue}
      />
      {tab === 'Today' ? (
        <TodayPage items={items} onItemClick={setEditing} onToggle={onToggle} />
      ) : tab === 'Map' ? (
        <MapPage />
      ) : (
        <div style={{ flex: 1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ws-fg-3)', fontFamily:'var(--ws-font-sans)', fontSize: 13 }}>
          {tab} — not in this kit
        </div>
      )}

      <QuickCapture onCapture={onCapture} hidden={!!editing} />

      <EditValueModal
        open={!!editing}
        item={editing}
        onClose={() => setEditing(null)}
        onSave={onSave}
      />

      {toast ? (
        <div style={{
          position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)',
          background: '#F4FDF7', border: '1px solid rgba(90,158,111,0.4)', color: '#2E7D32',
          borderRadius: 12, padding: '10px 18px', fontSize: 13, fontWeight: 600,
          fontFamily: 'var(--ws-font-sans)', boxShadow: '0 4px 16px rgba(45,42,38,0.10)',
          zIndex: 60,
        }}>{toast}</div>
      ) : null}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
