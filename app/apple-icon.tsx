import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#FAFAF7',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Apex ridge line */}
        <svg width="100" height="20" viewBox="0 0 100 20" style={{ marginBottom: -4 }}>
          <path d="M5 15 L50 5 L95 15" fill="none" stroke="#B8552E" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* ws text */}
        <div
          style={{
            fontSize: 80,
            fontWeight: 700,
            color: '#B8552E',
            letterSpacing: -4,
            lineHeight: 1,
            marginTop: -2,
          }}
        >
          ws
        </div>
      </div>
    ),
    { ...size }
  )
}
