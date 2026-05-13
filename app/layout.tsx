import type { Metadata } from 'next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import CssGate from './css-gate'

export const metadata: Metadata = {
  title: 'NoteChat',
  description: 'Public chat room and notes app',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <CssGate>{children}</CssGate>
        <SpeedInsights />
      </body>
    </html>
  )
}
