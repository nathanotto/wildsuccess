interface Props {
  name: string
  description: string
  onClose: () => void
}

export default function ComingSoonModal({ name, description, onClose }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(45,42,38,0.25)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }} onClick={onClose}>
      <div style={{
        background: '#FFF', borderRadius: 16, padding: '32px 36px', maxWidth: 400, width: '90%',
        border: '1px solid #E8E4DC',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#2D2A26', marginBottom: 10 }}>{name}</div>
        <div style={{ fontSize: 13, color: '#8A8578', lineHeight: 1.6, marginBottom: 20 }}>{description}</div>
        <div style={{ fontSize: 12, color: '#C4725A', fontWeight: 600 }}>Coming soon</div>
        <button onClick={onClose} style={{
          marginTop: 20, padding: '8px 20px', background: '#F8F7F4', border: '1px solid #E8E4DC',
          borderRadius: 8, fontSize: 12, cursor: 'pointer', color: '#2D2A26',
        }}>Close</button>
      </div>
    </div>
  )
}
