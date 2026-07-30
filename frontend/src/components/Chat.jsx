import React, { useState, useEffect, useRef } from 'react';
import { Send, ArrowLeft, MessageSquare, Scale, CheckCircle2, UserX, Heart, MessageCircle, HeartHandshake, X } from 'lucide-react';

export default function Chat({ user, API_URL, tgUserId, activePartnerId, onClearActivePartner, onChatOpenChange }) {
  const [matches, setMatches] = useState([]);
  const [incomingLikes, setIncomingLikes] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // holds match object { user, chatId, lastMessage }
  const [activeTab, setActiveTab] = useState('likes'); // 'likes' | 'chats'
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoadingMatches(true);
    await Promise.all([fetchMatches(), fetchIncomingLikes()]);
    setLoadingMatches(false);
  };

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

  const getPhotoUrl = (p) => {
    if (!p) return 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
    return p.startsWith('http') ? p : (API_URL + p);
  };

  const fetchMatches = async () => {
    try {
      const response = await fetch(`${API_URL}/api/matches`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (response.ok) {
        setMatches(result.matches || []);
        return result.matches || [];
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
    }
    return [];
  };

  const fetchIncomingLikes = async () => {
    try {
      const response = await fetch(`${API_URL}/api/likes-received`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (response.ok) {
        setIncomingLikes(result.likes || []);
      }
    } catch (err) {
      console.error('Error fetching incoming likes:', err);
    }
  };

  // Polling logic
  useEffect(() => {
    if (!activeChat) {
      const interval = setInterval(() => {
        fetchMatches();
        fetchIncomingLikes();
      }, 4000);
      return () => clearInterval(interval);
    }

    const interval = setInterval(() => {
      fetchMessages(activeChat.chatId);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeChat]);

  const handleSelectChat = async (match) => {
    setActiveChat(match);
    setLoadingChat(true);
    fetchMessages(match.chatId);
  };

  const fetchMessages = async (chatId) => {
    try {
      const response = await fetch(`${API_URL}/api/chats/${chatId}`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (response.ok) {
        setMessages(result.messages || []);
        scrollToBottom();
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoadingChat(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    const textToSend = newMessage;
    setNewMessage('');

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

      fetchMatches();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcceptLike = async (targetUserId) => {
    try {
      const response = await fetch(`${API_URL}/api/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ targetUserId, action: 'like' })
      });
      if (response.ok) {
        await Promise.all([fetchIncomingLikes(), fetchMatches()]);
      }
    } catch (err) {
      console.error('Error accepting like:', err);
    }
  };

  const handleWriteFirst = async (targetUserId) => {
    try {
      const response = await fetch(`${API_URL}/api/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ targetUserId, action: 'like' })
      });
      const result = await response.json();
      if (response.ok) {
        await fetchIncomingLikes();
        const updatedMatches = await fetchMatches();
        const match = updatedMatches.find(m => String(m.user.id) === String(targetUserId));
        if (match) {
          handleSelectChat(match);
        } else if (result.matchedUser) {
          const chatId = [String(user.id), String(targetUserId)].sort().join('_');
          handleSelectChat({ user: result.matchedUser, chatId });
        }
      }
    } catch (err) {
      console.error('Error starting chat:', err);
    }
  };

  const handlePassLike = async (targetUserId) => {
    try {
      await fetch(`${API_URL}/api/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ targetUserId, action: 'dislike' })
      });
      fetchIncomingLikes();
    } catch (err) {
      console.error('Error passing like:', err);
    }
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
        alert(`${targetName} заблокирован.`);
        setActiveChat(null);
        if (onClearActivePartner) onClearActivePartner();
        loadAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBackToMatches = () => {
    setActiveChat(null);
    if (onChatOpenChange) onChatOpenChange(false);
    if (onClearActivePartner) onClearActivePartner();
    loadAllData();
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
            src={getPhotoUrl(partner.photos?.[0])} 
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
            title="Заблокировать"
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
            <UserX size={14} /> Не писать
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
        <form 
          onSubmit={handleSendMessage} 
          className="glass" 
          style={{ 
            padding: '14px 16px', 
            paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
            display: 'flex', 
            gap: '10px', 
            alignItems: 'center', 
            borderTop: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(16, 12, 28, 0.98)',
            position: 'relative',
            zIndex: 100
          }}
        >
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

      <div style={{ zIndex: 1, position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Main Header & Sub-Tabs */}
        <div>
          <h2 style={{ fontSize: '22px', marginBottom: '14px' }}>Общение и Лайки</h2>

          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.04)', padding: '4px', borderRadius: '16px', gap: '4px' }}>
            <button 
              onClick={() => setActiveTab('likes')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                background: activeTab === 'likes' ? 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' : 'transparent',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <Heart size={15} color={incomingLikes.length > 0 ? '#ff5f5f' : '#fff'} fill={incomingLikes.length > 0 ? '#ff5f5f' : 'transparent'} />
              Кто меня лайкнул ({incomingLikes.length})
            </button>

            <button 
              onClick={() => setActiveTab('chats')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                background: activeTab === 'chats' ? 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' : 'transparent',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <MessageSquare size={15} />
              Диалоги ({matches.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Likes Received (Кто меня лайкнул) */}
        {activeTab === 'likes' && (
          <div>
            {loadingMatches ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Загрузка лайков...</div>
            ) : incomingLikes.length === 0 ? (
              <div className="glass-premium" style={{ padding: '35px', textAlign: 'center', borderRadius: '24px', color: 'var(--text-muted)' }}>
                <Heart size={40} color="var(--color-primary)" style={{ margin: 'auto', marginBottom: '12px', opacity: 0.8 }} />
                <h3 style={{ fontSize: '17px', color: '#fff', marginBottom: '6px' }}>Пока никто вас не лайкнул</h3>
                <p style={{ fontSize: '12px', maxWidth: '260px', margin: 'auto', lineHeight: '1.4' }}>
                  Продолжайте свайпать в ленте знакомств, чтобы вас чаще замечали!
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {incomingLikes.map((item) => {
                  const u = item.user;
                  return (
                    <div key={u.id} className="glass-premium" style={{ padding: '18px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <img 
                          src={getPhotoUrl(u.photos?.[0])} 
                          alt={u.name}
                          style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <h4 style={{ fontSize: '18px' }}>{u.name}, {u.age}</h4>
                            <span className="badge-verified" style={{ padding: '2px 6px', fontSize: '9px' }}>
                              ⚖️ {u.weight} кг
                            </span>
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Рост: {u.height} см {u.bio ? `• ${u.bio}` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons on incoming like */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => handlePassLike(u.id)}
                          className="btn btn-secondary"
                          style={{ padding: '10px 14px', fontSize: '12px', border: '1px solid rgba(255, 95, 95, 0.3)', color: '#ff5f5f' }}
                          title="Пропустить"
                        >
                          <X size={16} />
                        </button>

                        <button 
                          onClick={() => handleAcceptLike(u.id)}
                          className="btn btn-secondary"
                          style={{ flex: 1, padding: '10px', fontSize: '12px', color: 'var(--color-accent)', border: '1px solid rgba(0, 245, 212, 0.4)' }}
                        >
                          <Heart size={14} fill="var(--color-accent)" /> Лайк в ответ
                        </button>

                        <button 
                          onClick={() => handleWriteFirst(u.id)}
                          className="btn"
                          style={{ flex: 1, padding: '10px', fontSize: '12px' }}
                        >
                          <Send size={14} /> Написать первым
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Mutual Matches & Chats (Диалоги) */}
        {activeTab === 'chats' && (
          <div>
            {loadingMatches ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Загрузка диалогов...</div>
            ) : matches.length === 0 ? (
              <div className="glass-premium" style={{ padding: '35px', textAlign: 'center', borderRadius: '24px', color: 'var(--text-muted)' }}>
                <MessageSquare size={40} color="var(--text-muted)" style={{ margin: 'auto', marginBottom: '12px' }} />
                <h3 style={{ fontSize: '17px', color: '#fff', marginBottom: '6px' }}>Пока нет активных диалогов</h3>
                <p style={{ fontSize: '12px', maxWidth: '260px', margin: 'auto', lineHeight: '1.4' }}>
                  Отправьте взаимный лайк во вкладке «Кто меня лайкнул» или напишите первым!
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
                      src={getPhotoUrl(match.user.photos?.[0])} 
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
        )}

      </div>
    </div>
  );
}
