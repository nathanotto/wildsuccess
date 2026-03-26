'use client'
import ReviewSubNav from './ReviewSubNav'

const FONT = "'Source Sans 3', 'Source Sans Pro', sans-serif"

interface Props {
  period: string
  description: string
}

export default function ComingSoonReview({ period, description }: Props) {
  return (
    <div style={{ fontFamily: FONT, maxWidth: 480, margin: '0 auto', padding: '0 20px' }}>
      <ReviewSubNav />
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#2D2A26', marginBottom: 12 }}>
          {period} Review — coming soon
        </div>
        <div style={{ fontSize: 14, color: '#8A8578', lineHeight: 1.5, maxWidth: 360, margin: '0 auto' }}>
          {description}
        </div>
      </div>
    </div>
  )
}
