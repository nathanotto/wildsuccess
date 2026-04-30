// MapPage.jsx — values + life-domains mind map, hand-drawn feel
const MapPage = ({ activeId = 'me', onNode }) => {
  const center = { id: 'me', x: 400, y: 300, r: 44, label: 'Me' };
  const nodes = [
    { id: 'health', x: 180, y: 140, r: 34, label: 'Health' },
    { id: 'work',   x: 620, y: 160, r: 34, label: 'Work' },
    { id: 'family', x: 200, y: 460, r: 34, label: 'Family' },
    { id: 'money',  x: 620, y: 460, r: 34, label: 'Money' },
    { id: 'spirit', x: 400, y: 80,  r: 28, label: 'Spirit' },
    { id: 'play',   x: 400, y: 520, r: 28, label: 'Play' },
  ];
  const edges = nodes.map(n => ({
    d: `M ${center.x} ${center.y} C ${(center.x + n.x) / 2 + 30} ${(center.y + n.y) / 2 - 30}, ${(center.x + n.x) / 2 - 20} ${(center.y + n.y) / 2 + 20}, ${n.x} ${n.y}`,
  }));
  const isActive = (id) => id === activeId;

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'auto' }}>
      <svg viewBox="0 0 800 600" width="100%" style={{ maxWidth: 760 }}>
        {edges.map((e, i) => (
          <path key={i} d={e.d} fill="none" stroke="#C4BFB4" strokeWidth="1.25" strokeLinecap="round" />
        ))}
        {[center, ...nodes].map(n => {
          const active = isActive(n.id);
          return (
            <g key={n.id} style={{ cursor: 'pointer' }} onClick={() => onNode && onNode(n)}>
              <circle
                cx={n.x} cy={n.y} r={n.r}
                fill={active ? '#FDF6F3' : '#fff'}
                stroke={active ? 'var(--ws-primary)' : '#B5B0A8'}
                strokeWidth={active ? 1.75 : 1.25}
              />
              <text
                x={n.x} y={n.y + 4} textAnchor="middle"
                fontFamily="var(--ws-font-sans)" fontSize="13" fontWeight="600"
                fill={active ? 'var(--ws-primary)' : 'var(--ws-fg-1)'}
              >{n.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
window.MapPage = MapPage;
