import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, RefreshCw, Zap } from 'lucide-react';
import { apiClient } from '../api/client';

// ── Extrae texto legible de cualquier mensaje del engine ──────────────────
// El engine devuelve: { action: 'SEND_TEXT', payload: { type, text/image/... } }
function parseEngineMessage(msg) {
  const payload = msg.payload || msg;

  // Texto WhatsApp: { type: 'text', text: { body: '...' } }
  if (payload.type === 'text' && payload.text?.body)
    return { type: 'text', text: payload.text.body };

  // Texto Messenger: { message: { text: '...' } }
  if (payload.message?.text)
    return { type: 'text', text: payload.message.text };

  // Imagen WhatsApp: { type: 'image', image: { link, caption } }
  if (payload.type === 'image' && payload.image?.link)
    return { type: 'image', url: payload.image.link, caption: payload.image.caption || '' };

  // Imagen Messenger: { message: { attachment: { type: 'image', payload: { url } } } }
  if (payload.message?.attachment?.type === 'image')
    return { type: 'image', url: payload.message.attachment.payload?.url, caption: '' };

  // Interactivo WhatsApp: { type: 'interactive', interactive: { body: { text }, action: { buttons } } }
  if (payload.type === 'interactive') {
    const body = payload.interactive?.body?.text || '';
    const buttons = payload.interactive?.action?.buttons?.map(b => b.reply?.title || b.title) || [];
    const list = payload.interactive?.action?.sections?.flatMap(s => s.rows?.map(r => r.title) || []) || [];
    const opts = [...buttons, ...list];
    return {
      type: 'text',
      text: body + (opts.length ? '\n\n' + opts.map((o, i) => `[${i + 1}] ${o}`).join('\n') : '')
    };
  }

  // Fallback
  return { type: 'text', text: JSON.stringify(payload, null, 2) };
}

// ── Burbuja de mensaje ────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  if (msg.role === 'system') {
    return (
      <div style={{ textAlign: 'center', padding: '0.25rem 0' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {msg.text}
        </span>
      </div>
    );
  }

  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap: '0.75rem', alignItems: 'flex-end' }}>
      <div style={{
        width: '30px', height: '30px', borderRadius: '3px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isUser ? 'var(--neutral-bg)' : 'var(--accent-subtle)',
        border: `1px solid ${isUser ? 'var(--surface-border)' : 'var(--accent-border)'}`,
        color: isUser ? 'var(--text-secondary)' : 'var(--accent-blue)'
      }}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      <div style={{
        maxWidth: '72%',
        background: isUser ? 'var(--surface-color)' : 'var(--accent-subtle)',
        border: `1px solid ${isUser ? 'var(--surface-border)' : 'var(--accent-border)'}`,
        borderRadius: isUser ? '8px 2px 8px 8px' : '2px 8px 8px 8px',
        padding: '0.7rem 0.9rem',
        color: 'var(--text-primary)',
        fontSize: '0.88rem',
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}>
        {msg.type === 'image' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <img src={msg.url} alt="menu" style={{ maxWidth: '100%', borderRadius: '4px', border: '1px solid var(--surface-border)' }} />
            {msg.caption && <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{msg.caption}</span>}
          </div>
        ) : msg.text}
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.35rem', textAlign: isUser ? 'left' : 'right' }}>
          {msg.time}
        </div>
      </div>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
      <div style={{
        width: '30px', height: '30px', borderRadius: '3px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', color: 'var(--accent-blue)'
      }}>
        <Bot size={14} />
      </div>
      <div style={{
        padding: '0.7rem 1rem', background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
        borderRadius: '2px 8px 8px 8px', display: 'flex', gap: '0.3rem', alignItems: 'center'
      }}>
        {[0, 0.2, 0.4].map((delay, i) => (
          <span key={i} style={{
            width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success-color)',
            animation: `dotBounce 1.2s ${delay}s ease-in-out infinite`
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function ChatSimulator() {
  // org_id: prioridad URL ?org=N → localStorage → fallback a 1 (Horno 74 por seed).
  // Permite usar el bot público (/bot?org=N) sin estar logueado.
  const organizationId = (() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const fromQuery = url.searchParams.get('org');
      if (fromQuery && /^\d+$/.test(fromQuery)) return parseInt(fromQuery, 10);
    }
    const fromStorage = localStorage.getItem('organizationId');
    if (fromStorage && /^\d+$/.test(fromStorage)) return parseInt(fromStorage, 10);
    return 1;
  })();
  const now = () => new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  // Mensaje inicial: solo una pista pasiva ("Escribe para empezar").
  // El bot NO inicia la conversación — espera al usuario.
  const [messages, setMessages] = useState([
    { role: 'system', text: 'Escribe un mensaje para empezar' }
  ]);
  const [input, setInput]         = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId]               = useState(() => `sim-${Date.now()}`);
  const messagesEndRef            = useRef(null);
  const inputRef                  = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const addMessage = (role, text, extra = {}) => {
    setMessages(prev => [...prev, { role, text, time: now(), ...extra }]);
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    const userText = input.trim();
    if (!userText || isLoading) return;
    setInput('');
    addMessage('user', userText);
    setIsLoading(true);

    try {
      const res = await apiClient.post('/bot/mock', {
        channel: 'whatsapp',
        channel_user_id: sessionId,
        organization_id: organizationId,
        text: userText,
      });

      // Backend devuelve { outbound_messages: [ { action, payload } ] }
      const outbound = res.data?.outbound_messages || res.data?.messages || [];

      if (outbound.length === 0) {
        addMessage('bot', '…');
      } else {
        outbound.forEach(msg => {
          const parsed = parseEngineMessage(msg);
          if (parsed.type === 'image') {
            setMessages(prev => [...prev, { role: 'bot', type: 'image', url: parsed.url, caption: parsed.caption, time: now() }]);
          } else {
            addMessage('bot', parsed.text);
          }
        });
      }
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      addMessage('system', `⚠ Error: ${detail}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([{ role: 'system', text: 'Escribe un mensaje para empezar' }]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px - 3.5rem)', maxHeight: '820px', minHeight: '500px' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.85rem 1.25rem',
        background: 'var(--surface-color)', border: '1px solid var(--surface-border)',
        borderRadius: '6px 6px 0 0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '4px',
            background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue)'
          }}>
            <Zap size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Bot Simulator</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>WhatsApp · Simulador de conversación</div>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.15rem 0.5rem', borderRadius: '20px',
            background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
            color: 'var(--accent-blue)', fontSize: '0.62rem', fontWeight: 700
          }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-blue)', animation: 'pulse-accent 2s infinite' }} />
            En línea
          </span>
        </div>
        <button
          onClick={clearChat}
          aria-label="Reiniciar conversación"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.35rem 0.75rem', borderRadius: '4px',
            border: '1px solid var(--surface-border)', background: 'transparent',
            color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger-color)'; e.currentTarget.style.borderColor = 'var(--danger-color)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--surface-border)'; }}
        >
          <RefreshCw size={13} aria-hidden="true" /> Reiniciar
        </button>
      </div>

      {/* Messages area */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Conversación con el bot"
        style={{
          flex: 1, overflowY: 'auto', padding: '1.25rem',
          background: 'var(--bg-color)',
          border: '1px solid var(--surface-border)', borderTop: 'none', borderBottom: 'none',
          display: 'flex', flexDirection: 'column', gap: '1rem'
        }}
      >
        {messages.map((msg, idx) => <MessageBubble key={idx} msg={msg} />)}
        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '0.85rem 1rem',
        background: 'var(--surface-color)',
        border: '1px solid var(--surface-border)', borderTop: 'none',
        borderRadius: '0 0 6px 6px'
      }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.6rem' }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje al bot… (Enter para enviar)"
            disabled={isLoading}
            autoFocus
            style={{
              flex: 1, height: '44px', padding: '0 1rem', fontSize: '0.88rem',
              background: 'var(--bg-color)', border: '1px solid var(--surface-border)',
              borderRadius: '4px', color: 'var(--text-primary)', outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            aria-label="Enviar mensaje"
            style={{
              width: '44px', height: '44px', borderRadius: '4px',
              background: input.trim() && !isLoading ? 'var(--accent-blue)' : 'var(--surface-color)',
              color: input.trim() && !isLoading ? '#fff' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s', border: '1px solid var(--surface-border)', flexShrink: 0
            }}
          >
            <Send size={16} aria-hidden="true" />
          </button>
        </form>
      </div>

      <style>{`
        @keyframes dotBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
