'use client'

import { useState, useEffect, useRef } from 'react'

type Message = { id: string; username: string; content: string; created_at: string }
type Note = { id: string; title: string; content: string; updated_at: string }

export default function Home() {
  const [tab, setTab] = useState<'chat' | 'notes'>('chat')

  // --- Chat state ---
  const [messages, setMessages] = useState<Message[]>([])
  const [username, setUsername] = useState('')
  const [msgInput, setMsgInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // --- Notes state ---
  const [notes, setNotes] = useState<Note[]>([])
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // fetch messages
  useEffect(() => {
    if (tab !== 'chat') return
    const load = () => fetch('/api/messages').then(r => r.json()).then(d => { if (Array.isArray(d)) setMessages(d) })
    load()
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [tab])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // fetch notes
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
    if (activeNote) {
      const d = await fetch(`/api/notes/${activeNote.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: noteTitle, content: noteContent }) }).then(r => r.json())
      setNotes(n => n.map(x => x.id === d.id ? d : x))
      setActiveNote(d)
    } else {
      const d = await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: noteTitle, content: noteContent }) }).then(r => r.json())
      setNotes(n => [d, ...n])
      setActiveNote(d)
    }
    setSavingNote(false)
  }

  async function deleteNote(id: string) {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    setNotes(n => n.filter(x => x.id !== id))
    if (activeNote?.id === id) { setActiveNote(null); setNoteTitle(''); setNoteContent('') }
  }

  function openNote(note: Note) {
    setActiveNote(note)
    setNoteTitle(note.title)
    setNoteContent(note.content)
  }

  function newNote() {
    setActiveNote(null)
    setNoteTitle('')
    setNoteContent('')
  }

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
            {messages.length === 0 && <p style={{ color: 'var(--muted)', margin: 'auto', fontSize: '0.875rem' }}>no messages yet — say something!</p>}
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
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="your name" style={{ padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg)', fontFamily: 'inherit', fontSize: '0.875rem' }} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input value={msgInput} onChange={e => setMsgInput(e.target.value)} placeholder="message..." style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg)', fontFamily: 'inherit', fontSize: '0.875rem' }} />
              <button type="submit" disabled={sending} style={{ padding: '0.5rem 1.25rem', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', fontSize: '0.875rem', cursor: 'pointer', opacity: sending ? 0.6 : 1 }}>send</button>
            </div>
          </form>
        </section>
      )}

      {tab === 'notes' && (
        <section style={{ display: 'flex', gap: '1rem', flex: 1 }}>
          <aside style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button onClick={newNote} style={{ padding: '0.4rem 0.75rem', borderRadius: 6, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontFamily: 'inherit', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left' }}>+ new note</button>
            {notes.map(n => (
              <div key={n.id} onClick={() => openNote(n)} style={{ padding: '0.5rem 0.75rem', borderRadius: 6, border: `1px solid ${activeNote?.id === n.id ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: activeNote?.id === n.id ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'transparent' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                <button onClick={e => { e.stopPropagation(); deleteNote(n.id) }} style={{ marginLeft: 4, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: 0, fontFamily: 'inherit' }}>✕</button>
              </div>
            ))}
            {notes.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>no notes yet</p>}
          </aside>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="title" style={{ padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg)', fontFamily: 'inherit', fontSize: '0.95rem', fontWeight: 600 }} />
            <textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="write something..." rows={12} style={{ padding: '0.75rem', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg)', fontFamily: 'inherit', fontSize: '0.875rem', resize: 'vertical', lineHeight: 1.6 }} />
            <button onClick={saveNote} disabled={savingNote} style={{ alignSelf: 'flex-end', padding: '0.4rem 1.25rem', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', fontSize: '0.875rem', cursor: 'pointer', opacity: savingNote ? 0.6 : 1 }}>{savingNote ? 'saving...' : 'save'}</button>
          </div>
        </section>
      )}
    </main>
  )
}
