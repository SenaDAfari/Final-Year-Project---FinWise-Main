// frontend/src/pages/AIAdvisor.jsx
import React, { useState, useRef, useEffect } from 'react';
import { MdSend, MdDeleteOutline, MdWarning, MdPerson } from 'react-icons/md';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const SUGGESTED = [
  'How can I save more this month?',
  'Am I overspending on any category?',
  'How long to reach my savings goal?',
];

const REQUEST_TIMEOUT_MS = 25000;
// Matches backend's MAX_HISTORY_TURNS — sent as (role, text) pairs, so this
// caps how much of the visible chat we forward as context on each request.
const HISTORY_TURNS_TO_SEND = 6;
// How many messages to keep in sessionStorage for display purposes. Separate
// from HISTORY_TURNS_TO_SEND, which only governs what's sent to the backend
// as context on each request — this just stops the persisted log growing
// unbounded over a very long session.
const MAX_STORED_MESSAGES = 60;

const WELCOME_MESSAGE = {
  role: 'ai',
  text: "Hi! I'm your FinWise AI advisor. I can see your spending data and help you make smarter financial decisions. What would you like to know?"
};

// ── Message timestamps ──
// Each message is stored with `ts` (milliseconds). Messages saved before this
// change have no `ts`; they simply show no time.
const makeMessage = (role, text) => ({ role, text, ts: Date.now() });

const dayKey = (ts) => new Date(ts).toDateString();

const formatDayLabel = (ts) => {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

const formatTime = (ts) =>
  new Date(ts).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });

const formatFullDateTime = (ts) =>
  new Date(ts).toLocaleString('en-GH', { dateStyle: 'full', timeStyle: 'short' });

// Backend now tells the model not to use markdown, but LLMs don't always
// follow formatting instructions perfectly, and this bubble just renders
// plain text (no markdown renderer), so leftover **bold**, *italic*, or
// backslash-escaped symbols would show up as literal clutter. This is a
// safety net, not the primary fix.
const stripMarkdown = (text) => text
  .replace(/\\([*_`#])/g, '$1')     // backslash-escaped symbols, e.g. \* -> *
  .replace(/\*\*\*(.+?)\*\*\*/g, '$1') // ***bold italic***
  .replace(/\*\*(.+?)\*\*/g, '$1')       // **bold**
  .replace(/\*(.+?)\*/g, '$1')             // *italic*
  .replace(/__(.+?)__/g, '$1')             // __bold__
  .replace(/_(.+?)_/g, '$1')               // _italic_
  .replace(/`(.+?)`/g, '$1')               // `code`
  .replace(/^#{1,6}\s+/gm, '')             // # headers
  .replace(/^[-*]\s+/gm, '\u2022 ');       // - or * bullets -> a plain bullet char

const AIAdvisor = () => {
  const { user } = useAuth();
  // Per-user sessionStorage key so chat history doesn't leak across accounts
  // sharing the same browser, and clears when the browser tab/session ends
  // (consistent with the milestone/notification-dismissal storage pattern
  // used elsewhere in the app) rather than persisting forever like
  // localStorage would.
  const chatKey = `fw_chat_history_${user?.id ?? user?.email ?? 'anon'}`;

  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem(chatKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // corrupted/unavailable storage — fall through to default
    }
    return [WELCOME_MESSAGE];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Persist on every change so navigating to another tab and back (or a
  // full page reload within the same browser session) restores the
  // conversation instead of resetting to the welcome message.
  useEffect(() => {
    try {
      const toStore = messages.slice(-MAX_STORED_MESSAGES);
      sessionStorage.setItem(chatKey, JSON.stringify(toStore));
    } catch {
      // sessionStorage full or unavailable — non-fatal, chat still works
      // for the current page view, it just won't persist.
    }
  }, [messages, chatKey]);

  const sendMessage = async (text) => {
    if (loading) return; // guard against double-sends from chip clicks too
    const msg = text || input.trim();
    if (!msg) return;

    // Snapshot conversation history BEFORE adding the new user message,
    // so we don't duplicate it in the payload sent to the backend.
    const history = messages
      .slice(-HISTORY_TURNS_TO_SEND * 2)
      .map(m => ({ role: m.role, text: m.text }));

    setInput('');
    setMessages(prev => [...prev, makeMessage('user', msg)]);
    setLoading(true);

    try {
      const res = await api.post(
        '/ai/chat',
        { message: msg, history },
        { timeout: REQUEST_TIMEOUT_MS }
      );
      if (isMountedRef.current) {
        setMessages(prev => [...prev, makeMessage('ai', res.data.reply)]);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const isTimeout = err.code === 'ECONNABORTED';
        setMessages(prev => [
          ...prev,
          makeMessage(
            'ai',
            isTimeout
              ? "That's taking longer than expected — the AI service might be busy. Please try again in a moment."
              : "Sorry, I couldn't connect right now. Please try again shortly."
          )
        ]);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (loading) return; // prevent Enter-key spam queuing simultaneous requests
      sendMessage();
    }
  };

  const handleClearConversation = () => {
    if (loading) return;
    if (!window.confirm('Clear this conversation? This cannot be undone.')) return;
    setMessages([WELCOME_MESSAGE]);
    try {
      sessionStorage.removeItem(chatKey);
    } catch {
      // non-fatal
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 className="page-title">AI Financial Advisor</h1>
          <p className="page-subtitle">Powered by your real spending data</p>
        </div>
        {messages.length > 1 && (
          <button
            className="btn btn-outline btn-sm"
            onClick={handleClearConversation}
            disabled={loading}
            aria-label="Clear conversation"
          >
            <MdDeleteOutline /> Clear Chat
          </button>
        )}
      </div>

      {/* Disclaimer */}
      <div
        style={{
          background: '#FFF7ED',
          border: '1px solid #fed7aa',
          borderRadius: 8,
          padding: '0.6rem 1rem',
          color: '#92400e',
          fontSize: '0.78rem',
          lineHeight: 1.5,
          marginBottom: '1rem',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <MdWarning style={{ flexShrink: 0 }} />
          This AI advisor offers general guidance based on your logged data. It is not a licensed financial
          advisor and its suggestions should not be treated as professional financial advice.
        </span>
      </div>

      {/* Suggested prompts */}
      <div className="suggested-prompts">
        {SUGGESTED.map(p => (
          <button
            key={p}
            className="prompt-chip"
            onClick={() => sendMessage(p)}
            disabled={loading}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chat */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 16rem)' }}>
        <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            // Show a date divider whenever the day changes (or before the first dated message)
            const showDay = m.ts && (!prev || !prev.ts || dayKey(prev.ts) !== dayKey(m.ts));
            return (
              <React.Fragment key={i}>
                {showDay && <div className="chat-day-divider">{formatDayLabel(m.ts)}</div>}
                <div className={`chat-bubble-wrap ${m.role === 'user' ? 'user' : ''}`}>
                  <div className={`chat-avatar ${m.role}`}>
                    {m.role === 'ai' ? 'FW' : <MdPerson />}
                  </div>
                  <div className="chat-bubble-col">
                    <div className={`chat-bubble ${m.role}`} style={{ whiteSpace: 'pre-wrap' }}>
                      {m.role === 'ai' ? stripMarkdown(m.text) : m.text}
                    </div>
                    {m.ts && (
                      <div className="chat-time" title={formatFullDateTime(m.ts)}>
                        {formatTime(m.ts)}
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          {loading && (
            <div className="chat-bubble-wrap">
              <div className="chat-avatar ai">FW</div>
              <div className="chat-bubble ai" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span
                  style={{
                    animation: 'spin 1s linear infinite',
                    display: 'inline-block',
                    width: 14,
                    height: 14,
                    border: '2px solid #ccc',
                    borderTopColor: '#0A2E1A',
                    borderRadius: '50%'
                  }}
                />
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-row">
          <input
            className="chat-input"
            placeholder="Ask me anything about your finances..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
          />
          <button
            className="btn btn-primary"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            <MdSend />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAdvisor;