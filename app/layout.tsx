import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Wild Success",
  description: "Personal productivity and attention-management",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: "'Source Sans 3', sans-serif", margin: 0, padding: 0, zoom: 1.2 }}>
        {children}
      </body>
    </html>
  )
}
