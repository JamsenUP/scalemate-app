import React, { useState, useEffect, useRef } from 'react';
import { Send, ArrowLeft, MessageSquare, Scale, CheckCircle2, UserX } from 'lucide-react';

export default function Chat({ user, API_URL, tgUserId, activePartnerId, onClearActivePartner }) {
  const [matches, setMatches] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // holds the matched user object
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchMatches();
  }, []);

  // Handle navigating from Deck to a specific match directly
  useEffect(() => {
    if (activePartnerId && matches.length > 0) {
      const match = matches.find(m => String(m.user.id) === String(activePartnerId));
      if (match) {
        handleSelectChat(match);
      }
    }
  }, [activePartnerId, matches]);

  const getAuthHeaders = () => {
    const headers = {};
    const tgInit = window.Telegram?.WebApp?.initData;
    if (tgInit) {
      headers['x-tg-init-data'] = tgInit;
    } else {
      headers['x-dev-user-id'] = tgUserId;
    }
    return headers;
  };

  const handleBlockUser = async (targetUserId, targetName) => {
    if (!window.confirm(`Вы действительно хотите заблокировать ${targetName}? Этот пользователь больше не сможет вам писать.`)) return;

    try {
      const response = await fetch(`${API_URL}/api/chat/block`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ targetUserId })
      });

      if (response.ok) {
        alert(`${targetName} заблокирован. Диалог завершен.`);
        setActiveChat(null);
        if (onClearActivePartner) onClearActivePartner();
        fetchMatches();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMatches = async () => {
    setLoadingMatches(true);
    try {
      const response = await fetch(`${API_URL}/api/matches`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (response.ok) {
        setMatches(result.matches);
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
    } finally {
      setLoadingMatches(false);
    }
  };

  const handleSelectChat = async (match) => {
    setActiveChat(match);
    setLoadingChat(true);
    
    // Periodically fetch messages to simulate real-time chat (polling every 3s)
    fetchMessages(match.chatId);
  };

  const fetchMessages = async (chatId) => {
    try {
      const response = await fetch(`${API_URL}/api/chats/${chatId}`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (response.ok) {
        setMessages(result.messages);
        scrollToBottom();
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoadingChat(false);
    }
  };

  // Set up polling for messages when chat is open
  useEffect(() => {
    if (!activeChat) {
      const interval = setInterval(() => {
        fetchMatches();
      }, 4000);
      return () => clearInterval(interval);
    }

    const interval = setInterval(() => {
      fetchMessages(activeChat.chatId);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeChat]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    const textToSend = newMessage;
    setNewMessage(''); // Clear input optimistically

    // Optimistic message add
    const tempMsg = {
      chatId: activeChat.chatId,
      senderId: String(user.id),
      text: textToSend,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);
    scrollToBottom();

    try {
      const response = await fetch(`${API_URL}/api/chats/${activeChat.chatId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ text: textToSend })
      });

      if (!response.ok) {
        throw new Error('Не удалось отправить сообщение');
      }

      // Refresh chats list to update lastMessage
      fetchMatches();

    } catch (err) {
      console.error(err);
    }
  };

  const handleBackToMatches = () => {
    setActiveChat(null);
    onClearActivePartner();
    fetchMatches();
  };

  if (activeChat) {
    const partner = activeChat.user;
    return (
      <div className="screen-container" style={{ padding: 0, paddingBottom: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Chat Header */}
        <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)', zIndex: 10 }}>
          <button onClick={handleBackToMatches} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginRight: '10px' }}>
            <ArrowLeft size={24} />
          </button>
          
          <img 
            src={API_URL + partner.photos[0]} 
            alt={partner.name} 
            style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', marginRight: '12px', border: '2px solid var(--color-accent)' }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '15px', fontWeight: '700' }}>{partner.name}</span>
              <span className="badge-verified" style={{ padding: '2px 6px', fontSize: '9px', gap: '3px' }}>
                <CheckCircle2 size={10} /> {partner.weight} кг
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>В сети</span>
          </div>

          <button 
            onClick={() => handleBlockUser(partner.id, partner.name)}
            title="Заблокировать (Не писать мне больше)"
            style={{
              background: 'rgba(255, 95, 95, 0.12)',
              border: '1px solid rgba(255, 95, 95, 0.3)',
              color: '#ff5f5f',
              padding: '6px 10px',
              borderRadius: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: '600'
            }}
          >
            <UserX size={14} /> Не писать больше
          </button>
        </div>

        {/* Message Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(10, 8, 19, 0.5)' }}>
          {loadingChat ? (
            <div style={{ margin: 'auto', color: 'var(--text-muted)', fontSize: '14px' }}>Загрузка беседы...</div>
          ) : messages.length === 0 ? (
            <div style={{ margin: 'auto', textAlign: 'center', padding: '20px', maxWidth: '250px' }}>
              <MessageSquare size={32} color="var(--text-muted)" style={{ margin: 'auto', marginBottom: '10px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                Совпадение найдено! Напишите {partner.name} первым.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = String(msg.senderId) === String(user.id);
              return (
                <div 
                  key={idx} 
                  style={{
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    maxWidth: '75%',
                    padding: '12px 16px',
                    borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: isMe 
                      ? 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)' 
                      : 'rgba(255, 255, 255, 0.05)',
                    border: isMe ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    color: '#fff',
                    boxShadow: isMe ? '0 4px 15px rgba(var(--primary-rgb), 0.15)' : 'none',
                    fontSize: '14px',
                    lineHeight: '1.4',
                    wordBreak: 'break-word'
                  }}
                >
                  {msg.text}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Box */}
        <form onSubmit={handleSendMessage} className="glass" style={{ padding: '15px', display: 'flex', gap: '10px', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <input 
            type="text" 
            placeholder="Написать сообщение..." 
            className="input-field" 
            style={{ flex: 1, marginBottom: 0, padding: '12px 16px', borderRadius: '30px' }}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button 
            type="submit" 
            className="btn" 
            style={{ width: '45px', height: '45px', padding: 0, borderRadius: '50%', flexShrink: 0 }}
            disabled={!newMessage.trim()}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="screen-container">
      <div className="bg-mesh mesh-1"></div>
      <div className="bg-mesh mesh-2"></div>

      <div style={{ zIndex: 1, position: 'relative' }}>
        <h2 style={{ marginBottom: '20px', marginTop: '10px' }}>Ваши Диалоги</h2>

        {loadingMatches ? (
          <div style={{ textAlign: 'center', marginTop: '50px', color: 'var(--text-muted)' }}>Загрузка диалогов...</div>
        ) : matches.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '80px' }}>
            <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', marginBottom: '15px' }}>
              <MessageSquare size={32} color="var(--text-muted)" />
            </div>
            <h3>Пока нет совпадений</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px', maxWidth: '250px', margin: 'auto' }}>
              Продолжайте свайпать в ленте, чтобы получить взаимный интерес!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {matches.map((match) => (
              <div 
                key={match.chatId} 
                className="glass" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '14px', 
                  borderRadius: '16px', 
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={() => handleSelectChat(match)}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--card-bg)'}
              >
                <img 
                  src={API_URL + match.user.photos[0]} 
                  alt={match.user.name} 
                  style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', marginRight: '15px', border: '2px solid var(--color-accent)' }}
                />
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', fontSize: '15px' }}>{match.user.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {match.user.weight} кг
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {match.lastMessage ? (
                      String(match.lastMessage.senderId) === String(user.id) ? `Вы: ${match.lastMessage.text}` : match.lastMessage.text
                    ) : 'Начните диалог...'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
