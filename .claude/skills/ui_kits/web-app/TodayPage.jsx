// TodayPage.jsx — single narrow column, sections: Now / Next 2h / Today / Later
const TodayPage = ({ items, onItemClick, onToggle }) => {
  const groups = [
    { key: 'now', label: 'Now', filter: i => i.bucket === 'now' },
    { key: 'next', label: 'Next 2h', filter: i => i.bucket === 'next' },
    { key: 'today', label: 'Today', filter: i => i.bucket === 'today' },
    { key: 'later', label: 'Later', filter: i => i.bucket === 'later' },
  ];
  return (
    <div style={todayStyles.page}>
      <div style={todayStyles.header}>
        <div style={todayStyles.date}>Thursday, April 30</div>
        <div style={todayStyles.subhead}>What did you commit to?</div>
      </div>
      {groups.map(g => {
        const matches = items.filter(g.filter);
        if (!matches.length) return null;
        return (
          <div key={g.key} style={todayStyles.section}>
            <div style={todayStyles.sectionHead}>{g.label}</div>
            {matches.map(it => (
              <Item key={it.id} item={it} onClick={onItemClick} onToggle={onToggle} />
            ))}
          </div>
        );
      })}
      <div style={todayStyles.endNote}>That's everything for today.</div>
    </div>
  );
};

const todayStyles = {
  page: {
    maxWidth: 480, margin: '0 auto', padding: '32px 24px 120px', fontFamily: 'var(--ws-font-sans)',
  },
  header: { marginBottom: 24 },
  date: { fontSize: 11, color: 'var(--ws-fg-3)', fontFamily: 'var(--ws-font-mono)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' },
  subhead: { fontSize: 18, fontWeight: 600, color: 'var(--ws-fg-1)', letterSpacing: '-0.005em' },
  section: { marginBottom: 24 },
  sectionHead: {
    fontSize: 10, fontWeight: 700, color: 'var(--ws-fg-2)', textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: 6,
  },
  endNote: {
    fontSize: 11, color: 'var(--ws-fg-3)', textAlign: 'center', marginTop: 32,
    fontStyle: 'italic',
  },
};
window.TodayPage = TodayPage;
