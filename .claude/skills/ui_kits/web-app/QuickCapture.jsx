// QuickCapture.jsx — fixed pill at bottom-center, expands on focus
const QuickCapture = ({ onCapture, hidden }) => {
  const [val, setVal] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef(null);

  const submit = () => {
    if (val.trim()) {
      onCapture(val.trim());
      setVal('');
    }
  };

  if (hidden) return null;

  return (
    <div style={{
      ...qcStyles.outer,
      width: focused ? 480 : 320,
      borderColor: focused ? 'var(--ws-primary)' : 'var(--ws-border)',
      boxShadow: focused
        ? '0 4px 24px rgba(196,114,90,0.18)'
        : '0 2px 12px rgba(45,42,38,0.10)',
    }}>
      <span style={{ fontSize: 14, color: 'var(--ws-fg-2)', marginLeft: 4 }}>+</span>
      <input
        ref={inputRef}
        value={val}
        onChange={e => setVal(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={e => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') { setVal(''); inputRef.current.blur(); }
        }}
        placeholder="Capture something…"
        style={qcStyles.input}
      />
      {focused && val.trim() ? (
        <button onMouseDown={e => { e.preventDefault(); submit(); }} style={qcStyles.btn}>Capture</button>
      ) : null}
    </div>
  );
};

const qcStyles = {
  outer: {
    position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)',
    display: 'flex', alignItems: 'center', gap: 8, background: '#fff',
    borderRadius: 28, border: '1.5px solid var(--ws-border)', padding: '8px 8px 8px 18px',
    transition: 'width 200ms cubic-bezier(.2,.8,.2,1), border-color 200ms, box-shadow 200ms',
    zIndex: 30,
  },
  input: {
    flex: 1, border: 'none', outline: 'none', background: 'transparent',
    fontSize: 13, color: 'var(--ws-fg-1)', fontFamily: 'inherit',
  },
  btn: {
    padding: '6px 16px', borderRadius: 20, background: 'var(--ws-primary)',
    color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
window.QuickCapture = QuickCapture;
