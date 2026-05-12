import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Trash2 } from 'lucide-react';
import { apiClient } from '../api/client';

export default function ChatSimulator() {
  const [messages, setMessages] = useState([
    { role: 'system', text: 'Simulador iniciado. Escribe un mensaje para interactuar con el BotEngine de omnikook.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  
  const organizationId = localStorage.getItem('organizationId') || 1;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const response = await apiClient.post('/bot/mock', {
        channel: 'whatsapp',
        channel_user_id: 'simulator-user-01',
        organization_id: parseInt(organizationId, 10),
        text: userText
      });

      // Response contains a list of messages sent back by the bot
      // e.g. { messages: [{ type: 'text', text: { body: 'Hola' } }, ... ] }
      const botReplies = response.data.messages || [];
      
      if (botReplies.length === 0) {
        setMessages(prev => [...prev, { role: 'bot', text: 'Silencio (no hubo respuesta del bot)' }]);
      } else {
        botReplies.forEach(reply => {
          let replyText = '';
          if (reply.type === 'text') {
            replyText = reply.text.body;
          } else if (reply.type === 'interactive') {
            replyText = `[Interactivo: ${reply.interactive?.type}] ` + 
                        (reply.interactive?.body?.text || '') + 
                        "\nBotones: " + (reply.interactive?.action?.buttons?.map(b => b.reply.title).join(', ') || '');
          } else if (reply.type === 'image') {
            replyText = `[Imagen enviada: ${reply.image.link}]`;
          } else if (reply.type === 'document') {
            replyText = `[Documento enviado: ${reply.document.link}]`;
          } else {
            replyText = `[Mensaje tipo: ${reply.type}]`;
          }
          setMessages(prev => [...prev, { role: 'bot', text: replyText }]);
        });
      }
    } catch (error) {
      console.error("Error calling mock endpoint:", error);
      setMessages(prev => [...prev, { 
        role: 'system', 
        text: `Error de conexión: ${error.response?.data?.detail || error.message}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{ role: 'system', text: 'Chat limpiado.' }]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div style={{ 
        padding: '1rem 1.5rem', 
        background: 'var(--surface-color)', 
        border: '1px solid var(--surface-border)', 
        borderRadius: '2px 2px 0 0',
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.4rem', background: 'var(--success-bg)', color: 'var(--success-color)', borderRadius: '2px' }}>
            <Bot size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Simulator</h2>
            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>Bypassing META API</p>
          </div>
        </div>
        <button 
          onClick={clearChat}
          style={{ 
            background: 'none', border: '1px solid var(--surface-border)', 
            color: 'var(--text-secondary)', padding: '0.5rem 0.75rem', 
            borderRadius: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
            fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.15s'
          }}
          onMouseOver={e => { e.currentTarget.style.color = 'var(--danger-color)'; e.currentTarget.style.borderColor = 'var(--danger-color)'; }}
          onMouseOut={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--surface-border)'; }}
        >
          <Trash2 size={14} /> Clear
        </button>
      </div>

      {/* Messages */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '1.5rem', 
        borderLeft: '1px solid var(--surface-border)',
        borderRight: '1px solid var(--surface-border)',
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1.25rem' 
      }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ 
            display: 'flex', 
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            gap: '1rem',
            alignItems: 'flex-start'
          }}>
            {/* Avatar */}
            {msg.role !== 'system' && (
              <div style={{ 
                width: '32px', height: '32px', borderRadius: '2px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: msg.role === 'user' ? 'var(--surface-color)' : 'var(--success-bg)',
                border: '1px solid',
                borderColor: msg.role === 'user' ? 'var(--surface-border)' : 'var(--success-border)',
                color: msg.role === 'user' ? 'var(--text-secondary)' : 'var(--success-color)'
              }}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
            )}
            
            {/* Bubble */}
            <div style={{ 
              maxWidth: '75%',
              background: msg.role === 'user' ? 'var(--surface-color)' : (msg.role === 'system' ? 'transparent' : '#141414'),
              border: msg.role === 'system' ? 'none' : '1px solid var(--surface-border)',
              padding: msg.role === 'system' ? '0' : '0.85rem 1rem',
              borderRadius: '2px',
              color: msg.role === 'system' ? 'var(--text-secondary)' : 'var(--text-primary)',
              fontSize: '0.9rem',
              fontFamily: msg.role === 'system' ? 'JetBrains Mono, monospace' : 'Inter, sans-serif',
              textAlign: msg.role === 'system' ? 'center' : 'left',
              width: msg.role === 'system' ? '100%' : 'auto',
              whiteSpace: 'pre-wrap'
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ 
              width: '32px', height: '32px', borderRadius: '2px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success-color)'
            }}>
              <Bot size={16} />
            </div>
            <div style={{ 
              padding: '0.85rem 1rem', background: '#141414', border: '1px solid var(--surface-border)',
              borderRadius: '2px', color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', gap: '0.4rem'
            }}>
              <span className="dot-typing" />
              Procesando...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ 
        padding: '1.25rem', 
        background: 'var(--surface-color)', 
        border: '1px solid var(--surface-border)', 
        borderRadius: '0 0 2px 2px'
      }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.75rem' }}>
          <input 
            type="text" 
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Escribe un mensaje al bot (ej. 'Quiero pedir una pizza')..."
            style={{ 
              flex: 1, height: '48px', padding: '0 1.25rem', fontSize: '0.9rem',
              background: 'var(--bg-primary)', border: '1px solid var(--surface-border)', borderRadius: '2px',
              color: 'var(--text-primary)'
            }}
            disabled={isLoading}
          />
          <button 
            type="submit" 
            className="btn-primary" 
            style={{ width: '48px', height: '48px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            disabled={isLoading || !input.trim()}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .dot-typing {
          animation: dotTyping 1.5s infinite linear;
        }
        @keyframes dotTyping {
          0% { opacity: 0.2; }
          20% { opacity: 1; }
          100% { opacity: 0.2; }
        }
      `}} />
    </div>
  );
}
