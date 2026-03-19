interface Props {
  message: string
  type: 'success' | 'error'
}

export default function Toast({ message, type }: Props) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 100,
      background: type === 'error' ? '#FDF5F4' : '#F4FDF7',
      border: `1px solid ${type === 'error' ? '#C4504A40' : '#5A9E6F40'}`,
      borderRadius: 12, padding: '14px 22px',
      fontSize: 15, fontWeight: 600,
      color: type === 'error' ? '#C4504A' : '#4A8B5E',
      boxShadow: '0 4px 16px rgba(45,42,38,0.1)',
    }}>
      {message}
    </div>
  )
}
