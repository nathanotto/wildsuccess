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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FFFFFF',
        }}
      >
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: '50%',
            border: '5px solid #C4725A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: 90,
              fontWeight: 800,
              color: '#C4725A',
              letterSpacing: '-8px',
              paddingRight: 8,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            WS
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
