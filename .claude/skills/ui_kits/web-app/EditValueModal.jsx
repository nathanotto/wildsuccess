// EditValueModal.jsx — representative modal for the "edit a value/item" pattern
const EditValueModal = ({ open, item, onSave, onClose }) => {
  const [name, setName] = React.useState(item?.title || '');
  const [type, setType] = React.useState(item?.kind || 'protect');

  React.useEffect(() => {
    if (open) {
      setName(item?.title || '');
      setType(item?.kind || 'protect');
    }
  }, [open, item]);

  if (!open) return null;

  return (
    <div style={modalStyles.scrim} onClick={onClose}>
      <div style={modalStyles.card} onClick={e => e.stopPropagation()}>
        <div style={modalStyles.title}>Edit item</div>

        <div style={{ marginBottom: 14 }}>
          <label style={modalStyles.label}>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} style={modalStyles.input} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={modalStyles.label}>Type</label>
          <div style={{ display: 'flex', gap: 14, fontSize: 13, color: 'var(--ws-fg-1)' }}>
            <label style={modalStyles.radio}>
              <input type="radio" checked={type === 'protect'} onChange={() => setType('protect')} style={{ accentColor: 'var(--ws-primary)' }} />
              Protect (preventive)
            </label>
            <label style={modalStyles.radio}>
              <input type="radio" checked={type === 'expand'} onChange={() => setType('expand')} style={{ accentColor: 'var(--ws-primary)' }} />
              Expand (promotional)
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 22 }}>
          <button style={modalStyles.cancel} onClick={onClose}>Cancel</button>
          <button style={modalStyles.save} onClick={() => onSave({ name, type })}>Save</button>
        </div>
      </div>
    </div>
  );
};

const modalStyles = {
  scrim: {
    position: 'fixed', inset: 0, background: 'rgba(45,42,38,0.25)', backdropFilter: 'blur(2px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  card: {
    background: '#fff', borderRadius: 16, padding: '24px 28px',
    width: '90%', maxWidth: 520, border: '1px solid var(--ws-border)',
    boxShadow: '0 8px 32px rgba(45,42,38,0.12)', fontFamily: 'var(--ws-font-sans)',
  },
  title: { fontSize: 16, fontWeight: 700, color: 'var(--ws-fg-1)', marginBottom: 14 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--ws-fg-1)', display: 'block', marginBottom: 6 },
  input: {
    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--ws-border)',
    fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
    color: 'var(--ws-fg-1)', background: '#fff',
  },
  radio: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' },
  cancel: {
    background: 'var(--ws-surface-1)', border: '1px solid var(--ws-border)',
    borderRadius: 8, padding: '10px 20px', fontSize: 13, color: 'var(--ws-fg-1)',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  save: {
    background: 'var(--ws-primary)', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },
};
window.EditValueModal = EditValueModal;
