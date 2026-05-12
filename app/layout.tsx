import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NoteChat',
  description: 'Public chat room and notes app',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300..700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
