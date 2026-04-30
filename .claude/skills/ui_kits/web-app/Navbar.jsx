// Navbar.jsx — sticky top bar matching app/layout.tsx in wildsuccess
const Navbar = ({ active, onTab, badges = {}, overdue = 0 }) => {
  const tabs = ['Map', 'Today', 'Organize', 'Plan', 'Communicate', 'Review', 'Spending'];
  return (
    <div style={navStyles.bar}>
      <div style={navStyles.brand}>
        <span style={navStyles.brandWild}>wild</span>
        <svg style={navStyles.brandRidge} width="36" height="6" viewBox="0 0 100 14" preserveAspectRatio="none">
          <path d="M2 11 L50 4 L98 11" fill="none" stroke="var(--ws-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span style={navStyles.brandSucc}>success</span>
      </div>
      {tabs.map(t => {
        const on = t === active;
        const badge = badges[t];
        const badgeColor = t === 'Today' ? '#4B6A82' : '#C4725A';
        return (
          <button key={t} onClick={() => onTab(t)} style={{
            ...navStyles.tab,
            ...(on ? navStyles.tabActive : {}),
          }}>
            {t}
            {badge ? (
              <span style={{ ...navStyles.badge, background: badgeColor }}>{badge}</span>
            ) : null}
          </button>
        );
      })}
      {overdue > 0 ? (
        <span style={navStyles.overdue}>{overdue} overdue</span>
      ) : null}
      <div style={{ flex: 1 }} />
      <button style={navStyles.utility}>Search</button>
      <button style={navStyles.utility}>Settings</button>
      <button style={navStyles.utility}>Log out</button>
      <div style={navStyles.avatar}>N</div>
    </div>
  );
};

const navStyles = {
  bar: {
    padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 5,
    borderBottom: '1px solid var(--ws-border-soft)', background: 'var(--ws-bg-card)',
    position: 'sticky', top: 0, zIndex: 50, height: 41, boxSizing: 'border-box',
  },
  brand: {
    display: 'inline-flex', flexDirection: 'column', alignItems: 'stretch',
    lineHeight: 0.92, marginRight: 14, flexShrink: 0,
  },
  brandWild: {
    fontSize: 11, fontWeight: 600, color: 'var(--ws-primary)',
    letterSpacing: '0.16em', textAlign: 'center',
  },
  brandRidge: { display: 'block', margin: '-1px 0 0' },
  brandSucc: {
    fontSize: 9, fontWeight: 500, color: 'var(--ws-ink)',
    letterSpacing: '-0.01em', textAlign: 'center', marginTop: 1,
  },
  tab: {
    padding: '3px 9px', borderRadius: 5, border: '1px solid var(--ws-border-soft)',
    fontSize: 10, fontWeight: 600, color: 'var(--ws-fg-1)', background: 'transparent',
    fontFamily: 'inherit', cursor: 'pointer', position: 'relative',
    whiteSpace: 'nowrap', flexShrink: 0,
  },
  tabActive: {
    borderColor: 'rgba(196,114,90,0.40)', background: 'rgba(196,114,90,0.03)',
    color: 'var(--ws-primary)',
  },
  badge: {
    position: 'absolute', top: -4, right: -4, minWidth: 14, height: 14, borderRadius: 7,
    color: '#fff', fontSize: 8, fontWeight: 700, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', padding: '0 3px',
  },
  overdue: { fontSize: 10, color: 'var(--ws-danger)', fontWeight: 700, marginLeft: 4, whiteSpace: 'nowrap', flexShrink: 0 },
  utility: {
    fontSize: 10, color: 'var(--ws-fg-2)', background: 'none', border: 'none',
    cursor: 'pointer', fontFamily: 'inherit', padding: '4px 6px',
    whiteSpace: 'nowrap', flexShrink: 0,
  },
  avatar: {
    width: 24, height: 24, borderRadius: '50%', background: 'rgba(196,114,90,0.20)',
    color: 'var(--ws-primary)', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 10, fontWeight: 700, marginLeft: 4,
    flexShrink: 0,
  },
};
window.Navbar = Navbar;
