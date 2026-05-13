'use client'

import { useEffect, useState } from 'react'

export default function CssGate({ children }: { children: React.ReactNode }) {
  const [noCss, setNoCss] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('no-css') === '1') {
      setNoCss(true)
    } else {
      // load full stylesheet dynamically
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = '/styles/main.css'
      document.head.appendChild(link)

      // load JetBrains Mono
      const font = document.createElement('link')
      font.rel = 'stylesheet'
      font.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300..700&display=swap'
      document.head.appendChild(font)
    }

    if (noCss) {
      // bare monospace only
      const style = document.createElement('style')
      style.textContent = `* { font-family: 'Courier New', Courier, monospace; }`
      document.head.appendChild(style)
    }
  }, [])

  return <>{children}</>
}
