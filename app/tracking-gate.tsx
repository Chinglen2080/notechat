'use client'

import { useEffect, useState } from 'react'

// Returns true if the user has signalled no-tracking:
// 1. ?no-trac=1 in the URL
// 2. navigator.doNotTrack === '1'
// 3. globalThis.navigator?.globalPrivacyControl === true  (GPC signal)
function isNoTrack(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  if (params.get('no-trac') === '1') return true
  if (navigator.doNotTrack === '1') return true
  // @ts-expect-error globalPrivacyControl is not in TS types yet
  if (navigator.globalPrivacyControl === true) return true
  return false
}

export default function TrackingGate({ children }: { children: React.ReactNode }) {
  const [blocked, setBlocked] = useState(false)
  const [toast, setToast] = useState(false)

  useEffect(() => {
    if (isNoTrack()) {
      setBlocked(true)
      const t = setTimeout(() => {
        setToast(true)
        // auto-hide after 4 s
        setTimeout(() => setToast(false), 4000)
      }, 600)
      return () => clearTimeout(t)
    }
  }, [])

  return (
    <>
      {/* Only mount analytics scripts when tracking is NOT blocked */}
      {!blocked && children}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '1.25rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--fg, #111)',
            color: 'var(--bg, #fff)',
            padding: '0.55rem 1.1rem',
            borderRadius: 8,
            fontSize: '0.82rem',
            fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            zIndex: 9999,
            whiteSpace: 'nowrap',
            animation: 'fadein 200ms ease',
          }}
        >
          tracking disabled — your signal is respected
        </div>
      )}

      <style>{`
        @keyframes fadein {
          from { opacity: 0; transform: translateX(-50%) translateY(6px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  )
}
