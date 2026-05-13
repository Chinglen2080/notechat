'use client'

import { useState, useEffect, useRef } from 'react'

type Message = { id: string; username: string; content: string; created_at: string }
type Note = {
  id: string
  title: string
  content: string
  updated_at: string
  is_protected: boolean
  encrypted_content?: string
  salt?: string
  iv?: string
  encrypted_decoy?: string
  duress_salt?: string
  duress_iv?: string
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as Uint8Array<ArrayBuffer>, iterations: 200000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encrypt(text: string, password: string): Promise<{ ciphertext: string; salt: string; iv: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const enc = new TextEncoder()
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text))
  const toB64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...Array.from(new Uint8Array(buf instanceof ArrayBuffer ? buf : buf))))
  return { ciphertext: toB64(encrypted), salt: toB64(salt), iv: toB64(iv) }
}

async function decrypt(ciphertext: string, password: string, saltB64: string, ivB64: string): Promise<string | null> {
  try {
    const fromB64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))
    const key = await deriveKey(password, fromB64(saltB64))
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ivB64) }, key, fromB64(ciphertext))
    return new TextDecoder().decode(decrypted)
  } catch { return null }
}

function triggerDuress() {
  const workerCode = `self.onmessage=function(){const a=[];while(true){for(let i=0;i<1e7;i++)a.push(Math.random()*Math.random());if(a.length>5e7)a.splice(0,1e7);}}`
  const url = URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' }))
  const cores = navigator.hardwareConcurrency || 4
  for (let i = 0; i < cores; i++) { const w = new Worker(url); w.postMessage('go') }
  const g: number[] = []
  const fill = () => { for (let i = 0; i < 1e6; i++) g.push(Math.random()); requestAnimationFrame(fill) }
  fill()
}

export default function Home() {
  const [tab, setTab] = useState<'chat' | 'notes'>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [username, setUsername] = useState('')
  const [msgInput, setMsgInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [isProtecting, setIsProtecting] = useState(false)
  const [notePassword, setNotePassword] = useState('')
  const [noteDuressPassword, setNoteDuressPassword] = useState('')
  const [noteDecoyContent, setNoteDecoyContent] = useState('')
  type UnlockPhase = 'locked' | 'decrypted'
  const [unlockPhase, setUnlockPhase] = useState<UnlockPhase>('locked')
  const [unlockPw, setUnlockPw] = useState('')
  const [unlockError, setUnlockError] = useState('')
  const [decryptedContent, setDecryptedContent] = useState('')
  const [pendingDuress, setPendingDuress] = useState(false)

  useEffect(() => {
    if (tab !== 'chat') return
    const load = () => fetch('/api/messages').then(r => r.json()).then(d => { if (Array.isArray(d)) setMessages(d) })
    load()
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [tab])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (tab !== 'notes') return
    fetch('/api/notes').then(r => r.json()).then(d => { if (Array.isArray(d)) setNotes(d) })
  }, [tab])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !msgInput.trim() || sending) return
    setSending(true)
    await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, content: msgInput }) })
    setMsgInput('')
    const d = await fetch('/api/messages').then(r => r.json())
    if (Array.isArray(d)) setMessages(d)
    setSending(false)
  }

  async function saveNote() {
    if (!noteTitle.trim() || savingNote) return
    setSavingNote(true)
    let body: Record<string, unknown> = { title: noteTitle, content: noteContent }
    if (isProtecting && notePassword.trim()) {
      const real = await encrypt(noteContent, notePassword)
      let decoyData = null
      if (noteDuressPassword.trim() && noteDecoyContent.trim()) {
        decoyData = await encrypt(noteDecoyContent, noteDuressPassword)
      }
      body = {
        title: noteTitle, content: '', is_protected: true,
        encrypted_content: real.ciphertext, salt: real.salt, iv: real.iv,
        ...(decoyData ? { encrypted_decoy: decoyData.ciphertext, duress_salt: decoyData.salt, duress_iv: decoyData.iv } : {}),
      }
    }
    if (activeNote) {
      const d = await fetch(`/api/notes/${activeNote.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
      setNotes(n => n.map(x => x.id === d.id ? d : x))
      setActiveNote(d)
    } else {
      const d = await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
      setNotes(n => [d, ...n])
      setActiveNote(d)
    }
    setIsProtecting(false); setNotePassword(''); setNoteDuressPassword(''); setNoteDecoyContent('')
    setSavingNote(false)
  }

  async function deleteNote(id: string) {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    setNotes(n => n.filter(x => x.id !== id))
    if (activeNote?.id === id) resetNoteEditor()
  }

  function resetNoteEditor() {
    setActiveNote(null); setNoteTitle(''); setNoteContent('')
    setUnlockPhase('locked'); setUnlockPw(''); setUnlockError('')
    setDecryptedContent(''); setPendingDuress(false)
    setIsProtecting(false); setNotePassword(''); setNoteDuressPassword(''); setNoteDecoyContent('')
  }

  function openNote(note: Note) {
    setActiveNote(note); setNoteTitle(note.title)
    setUnlockPhase('locked'); setUnlockPw(''); setUnlockError(''); setPendingDuress(false)
    if (!note.is_protected) { setNoteContent(note.content) }
    else { setNoteContent(''); setDecryptedContent('') }
  }

  async function handleDecrypt() {
    if (!activeNote || !unlockPw.trim()) return
    setUnlockError('')
    const real = await decrypt(activeNote.encrypted_content!, unlockPw, activeNote.salt!, activeNote.iv!)
    if (real !== null) {
      setDecryptedContent(real); setUnlockPhase('decrypted'); setPendingDuress(false)
      return
    }
    if (activeNote.encrypted_decoy && activeNote.duress_salt && activeNote.duress_iv) {
      const decoy = await decrypt(activeNote.encrypted_decoy, unlockPw, activeNote.duress_salt, activeNote.duress_iv)
      if (decoy !== null) {
        window.open(window.location.href, '_blank')
        setPendingDuress(true); setDecryptedContent(decoy); setUnlockPhase('decrypted')
        return
      }
    }
    setUnlockError('wrong password')
  }

  function handleViewNote() {
    if (pendingDuress) {
      window.open(window.location.href, '_blank')
      triggerDuress()
    }
    setNoteContent(decryptedContent)
  }

  const inp = { padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg)', fontFamily: 'inherit', fontSize: '0.875rem' } as React.CSSProperties

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 760, margin: '0 auto', padding: '1rem' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>notechat</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['chat', 'notes'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '0.35rem 1rem', borderRadius: 6, border: '1px solid var(--border)', background: tab === t ? 'var(--fg)' : 'transparent', color: tab === t ? 'var(--bg)' : 'var(--fg)', cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'inherit', transition: 'all 150ms' }}>{t}</button>
          ))}
        </div>
      </header>

      {tab === 'chat' && (
        <section style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '1rem' }}>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 300, maxHeight: '60vh', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 8 }}>
            {messages.length === 0 && <p style={{ color: 'var(--muted)', margin: 'auto', fontSize: '0.875rem' }}>no messages yet</p>}
            {messages.map(m => (
              <div key={m.id}>
                <span style={{ color: 'var(--accent)', fontSize: '0.8rem', marginRight: '0.5rem' }}>{m.username}</span>
                <span style={{ fontSize: '0.9rem' }}>{m.content}</span>
                <span style={{ color: 'var(--muted)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>{new Date(m.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={sendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="your name" style={{ ...inp, width: '100%' }} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input value={msgInput} onChange={e => setMsgInput(e.target.value)} placeholder="message..." style={{ ...inp, flex: 1 }} />
              <button type="submit" disabled={sending} style={{ padding: '0.5rem 1.25rem', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', fontSize: '0.875rem', cursor: 'pointer', opacity: sending ? 0.6 : 1 }}>send</button>
            </div>
          </form>
        </section>
      )}

      {tab === 'notes' && (
        <section style={{ display: 'flex', gap: '1rem', flex: 1 }}>
          <aside style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button onClick={resetNoteEditor} style={{ padding: '0.4rem 0.75rem', borderRadius: 6, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontFamily: 'inherit', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left' }}>+ new note</button>
            {notes.map(n => (
              <div key={n.id} onClick={() => openNote(n)} style={{ padding: '0.5rem 0.75rem', borderRadius: 6, border: `1px solid ${activeNote?.id === n.id ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: activeNote?.id === n.id ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'transparent' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.is_protected ? '[enc] ' : ''}{n.title}
                </span>
                <button onClick={e => { e.stopPropagation(); deleteNote(n.id) }} style={{ marginLeft: 4, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: 0, fontFamily: 'inherit' }}>x</button>
              </div>
            ))}
            {notes.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>no notes yet</p>}
          </aside>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="title" style={{ ...inp, fontWeight: 600, fontSize: '0.95rem' }} />

            {activeNote?.is_protected && unlockPhase === 'locked' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: 8, marginTop: '0.25rem' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>encrypted note</p>
                <input type="password" value={unlockPw} onChange={e => setUnlockPw(e.target.value)} placeholder="enter password" style={inp} onKeyDown={e => e.key === 'Enter' && handleDecrypt()} />
                {unlockError && <p style={{ fontSize: '0.8rem', color: 'var(--error)' }}>{unlockError}</p>}
                <button onClick={handleDecrypt} style={{ alignSelf: 'flex-start', padding: '0.4rem 1rem', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', fontSize: '0.8rem', cursor: 'pointer' }}>decrypt</button>
              </div>
            )}

            {activeNote?.is_protected && unlockPhase === 'decrypted' && !noteContent && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: 8 }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>decrypted</p>
                <button onClick={handleViewNote} style={{ alignSelf: 'flex-start', padding: '0.4rem 1rem', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', fontSize: '0.8rem', cursor: 'pointer' }}>view note</button>
              </div>
            )}

            {(!activeNote?.is_protected || noteContent) && unlockPhase !== 'locked' || (!activeNote?.is_protected) ? (
              <textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="write something..." rows={12}
                style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }}
                readOnly={activeNote?.is_protected && !!noteContent}
              />
            ) : null}

            {!activeNote?.is_protected && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" id="protect" checked={isProtecting} onChange={e => setIsProtecting(e.target.checked)} style={{ cursor: 'pointer' }} />
                <label htmlFor="protect" style={{ fontSize: '0.8rem', color: 'var(--muted)', cursor: 'pointer' }}>protect with password</label>
              </div>
            )}

            {isProtecting && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 8 }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>encryption — password never leaves your browser</p>
                <input type="password" value={notePassword} onChange={e => setNotePassword(e.target.value)} placeholder="note password (required)" style={inp} />
                <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.25rem' }}>duress password (optional) — attacker sees decoy content instead</p>
                <input type="password" value={noteDuressPassword} onChange={e => setNoteDuressPassword(e.target.value)} placeholder="duress password (optional)" style={inp} />
                <textarea value={noteDecoyContent} onChange={e => setNoteDecoyContent(e.target.value)} placeholder="decoy content" rows={3} style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
              </div>
            )}

            <button onClick={saveNote} disabled={savingNote} style={{ alignSelf: 'flex-end', padding: '0.4rem 1.25rem', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', fontSize: '0.875rem', cursor: 'pointer', opacity: savingNote ? 0.6 : 1 }}>
              {savingNote ? 'saving...' : 'save'}
            </button>
          </div>
        </section>
      )}
    </main>
  )
}
