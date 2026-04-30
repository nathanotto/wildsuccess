// Item.jsx — Today list row, with checkbox states
const Checkbox = ({ state, onClick }) => {
  const base = {
    width: 14, height: 14, border: '1.5px solid var(--ws-fg-3)', borderRadius: 2,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden', flexShrink: 0, cursor: 'pointer',
    background: '#fff', marginTop: 3,
  };
  if (state === 'completed') {
    return <span onClick={onClick} style={{ ...base, borderColor: '#8A857D', background: '#8A857D', color: '#fff', fontSize: 10 }}>✓</span>;
  }
  if (state === 'in_progress') {
    return <span onClick={onClick} style={{ ...base, borderColor: 'var(--ws-primary)' }}>
      <span style={{ width: 6, height: 6, background: 'var(--ws-primary)', borderRadius: 1 }} />
    </span>;
  }
  if (state === 'parked') {
    return <span onClick={onClick} style={base}>
      <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 7, background: '#B5B0A8' }} />
    </span>;
  }
  if (state === 'skipped') {
    return <span onClick={onClick} style={{ ...base, color: '#B5B0A8', fontSize: 10, fontWeight: 700 }}>✕</span>;
  }
  return <span onClick={onClick} style={base} />;
};

const Item = ({ item, onClick, onToggle }) => {
  const completed = item.state === 'completed';
  const skipped = item.state === 'skipped';
  return (
    <div style={itemStyles.row} onClick={() => onClick && onClick(item)}>
      <Checkbox state={item.state} onClick={(e) => { e.stopPropagation(); onToggle && onToggle(item); }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, color: completed ? '#8A857D' : skipped ? '#B5B0A8' : 'var(--ws-fg-1)',
          textDecoration: completed ? 'line-through' : 'none', lineHeight: 1.4,
        }}>
          {item.title}
        </div>
        {item.linked && item.linked.length ? (
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            {item.linked.map((c, i) => <span key={i} style={itemStyles.chip}>{c}</span>)}
          </div>
        ) : null}
      </div>
      {item.time ? <div style={itemStyles.time}>{item.time}</div> : null}
    </div>
  );
};

const itemStyles = {
  row: {
    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0',
    borderBottom: '1px solid var(--ws-border-soft)', cursor: 'pointer',
  },
  chip: {
    padding: '1px 7px', borderRadius: 10, background: 'var(--ws-surface-1)',
    border: '1px solid var(--ws-border)', color: 'var(--ws-fg-2)', fontSize: 10,
  },
  time: { fontSize: 11, color: 'var(--ws-fg-3)', fontFamily: 'var(--ws-font-mono)', marginTop: 2 },
};

window.Item = Item; window.Checkbox = Checkbox;
