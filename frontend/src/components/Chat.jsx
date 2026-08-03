import React, { useState, useEffect, useRef } from 'react';
import { Send, ArrowLeft, MessageSquare, Scale, CheckCircle2, UserX, Heart, Dices, Calendar, MapPin, Check, X } from 'lucide-react';

export default function Chat({ user, API_URL, tgUserId, activePartnerId, onClearActivePartner, onChatOpenChange }) {
  const [matches, setMatches] = useState([]);
  const [incomingLikes, setIncomingLikes] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // holds match object { user, chatId, lastMessage }
  const [activeTab, setActiveTab] = useState('likes'); // 'likes' | 'chats'
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [scheduledDates, setScheduledDates] = useState([]);
  
  // Date proposal modal
  const [showDateModal, setShowDateModal] = useState(false);
  const [dateVenue, setDateVenue] = useState('');
  const [dateYandexUrl, setDateYandexUrl] = useState('');
  const [dateTime, setDateTime] = useState('');

  // Dice roll animation
  const [rollingDice, setRollingDice] = useState(false);

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
    if (tgInit) headers['x-tg-init-data'] = tgInit;
    else headers['x-dev-user-id'] = tgUserId;
    return headers;
  };

  const getPhotoUrl = (p) => {
    if (!p) return 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
    return p.startsWith('http') ? p : API_URL + p;
  };

  const fetchMatches = async () => {
    try {
      const response = await fetch(`${API_URL}/api/matches`, { headers: getAuthHeaders() });
      const result = await response.json();
      if (response.ok) {
        setMatches(result.matches || []);
        return result.matches || [];
      }
    } catch (err) {
      console.error(err);
    }
    return [];
  };

  const fetchIncomingLikes = async () => {
    try {
      const response = await fetch(`${API_URL}/api/likes-received`, { headers: getAuthHeaders() });
      const result = await response.json();
      if (response.ok) setIncomingLikes(result.likes || []);
    } catch (err) {
      console.error(err);
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
      fetchScheduledDates(activeChat.chatId);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeChat]);

  const handleSelectChat = async (match) => {
    setActiveChat(match);
    if (onChatOpenChange) onChatOpenChange(true);
    setLoadingChat(true);
    await Promise.all([fetchMessages(match.chatId), fetchScheduledDates(match.chatId)]);
  };

  const fetchMessages = async (chatId) => {
    try {
      const response = await fetch(`${API_URL}/api/chats/${chatId}`, { headers: getAuthHeaders() });
      const result = await response.json();
      if (response.ok) {
        setMessages(result.messages || []);
        scrollToBottom();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingChat(false);
    }
  };

  const fetchScheduledDates = async (chatId) => {
    try {
      const response = await fetch(`${API_URL}/api/dates/${chatId}`, { headers: getAuthHeaders() });
      const result = await response.json();
      if (response.ok) setScheduledDates(result.dates || []);
    } catch (e) { console.error(e); }
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
      await fetch(`${API_URL}/api/chats/${activeChat.chatId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ text: textToSend })
      });
      fetchMatches();
    } catch (err) { console.error(err); }
  };

  // Requirement #19: Dice Roll Conflict Resolver 🎲
  const handleRollDice = async () => {
    if (!activeChat || rollingDice) return;
    setRollingDice(true);
    const roll = Math.floor(Math.random() * 6) + 1;
    const diceMessageText = `🎲 ${user.name} бросил(а) кубик: Выпало ${roll}!`;

    setTimeout(async () => {
      setRollingDice(false);
      try {
        await fetch(`${API_URL}/api/chats/${activeChat.chatId}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ text: diceMessageText })
        });
        fetchMessages(activeChat.chatId);
      } catch (e) { console.error(e); }
    }, 800);
  };

  // Requirement #13: Date Scheduler with Yandex Maps
  const handleCreateDateProposal = async (e) => {
    e.preventDefault();
    if (!dateVenue || !dateTime || !activeChat) return;

    try {
      const response = await fetch(`${API_URL}/api/dates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          chatId: activeChat.chatId,
          receiverId: activeChat.user.id,
          locationName: dateVenue,
          yandexMapUrl: dateYandexUrl || `https://yandex.ru/maps/?text=${encodeURIComponent(dateVenue)}`,
          dateTime
        })
      });
      if (response.ok) {
        setShowDateModal(false);
        setDateVenue('');
        setDateYandexUrl('');
        setDateTime('');
        fetchScheduledDates(activeChat.chatId);
        fetchMessages(activeChat.chatId);
      }
    } catch (err) { console.error(err); }
  };

  const handleRespondDate = async (dateId, status) => {
    try {
      await fetch(`${API_URL}/api/dates/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ dateId, status })
      });
      fetchScheduledDates(activeChat.chatId);
    } catch (e) { console.error(e); }
  };

  const handleBackToMatches = () => {
    setActiveChat(null);
    if (onChatOpenChange) onChatOpenChange(false);
    if (onClearActivePartner) onClearActivePartner();
    loadAllData();
  };

  const isUserOnline = (lastSeen) => {
    if (!lastSeen) return false;
    const diff = (new Date() - new Date(lastSeen)) / 1000 / 60;
    return diff < 5;
  };

  if (activeChat) {
    const partner = activeChat.user;
    const online = isUserOnline(partner.lastSeenAt);

    return (
      <div className="screen-container" style={{ padding: 0, paddingBottom: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        
        {/* Chat Header */}
        <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', zIndex: 10 }}>
          <button onClick={handleBackToMatches} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginRight: '10px' }}>
            <ArrowLeft size={24} />
          </button>
          
          <img 
            src={getPhotoUrl(partner.photos?.[0])} 
            alt={partner.name} 
            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', marginRight: '10px', border: '2px solid var(--color-accent)' }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '15px', fontWeight: '700' }}>{partner.name}</span>
              <span className="badge-verified" style={{ padding: '2px 6px', fontSize: '9px' }}>
                {partner.gender === 'male' ? `💰 ${parseInt(partner.income || 0).toLocaleString('ru-RU')} ₽` : `⚖️ ${partner.weight} кг`}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: online ? '#00f5d4' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: online ? '#00f5d4' : '#888' }} />
              {online ? 'В сети' : `Был(а): ${new Date(partner.lastSeenAt || partner.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`}
            </span>
          </div>

          {/* Action Tools: Date Scheduler & Dice Roll */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setShowDateModal(true)} 
              style={{ background: 'rgba(0, 245, 212, 0.15)', border: '1px solid rgba(0, 245, 212, 0.3)', color: '#00f5d4', padding: '6px 10px', borderRadius: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600' }}
              title="Назначить свидание"
            >
              <Calendar size={14} /> Свидание
            </button>

            <button 
              onClick={handleRollDice} 
              style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', color: '#a855f7', padding: '6px 10px', borderRadius: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600' }}
              title="Бросить кубик 🎲"
            >
              <Dices size={14} className={rollingDice ? 'spin' : ''} /> 🎲
            </button>
          </div>
        </div>

        {/* Scheduled Dates Cards in Timeline */}
        {scheduledDates.length > 0 && (
          <div style={{ padding: '10px 16px', background: 'rgba(0, 245, 212, 0.04)', borderBottom: '1px solid rgba(0, 245, 212, 0.1)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {scheduledDates.map(d => (
              <div key={d.id} className="glass" style={{ padding: '10px 14px', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-accent)' }}>📍 Свидание: {d.location_name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>🕒 {d.date_time}</div>
                </div>
                {d.status === 'pending' ? (
                  String(d.receiver_id) === String(user.id) ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => handleRespondDate(d.id, 'accepted')} className="btn" style={{ padding: '4px 10px', fontSize: '11px' }}><Check size={12} /> Принять</button>
                      <button onClick={() => handleRespondDate(d.id, 'declined')} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px', color: '#ff5f5f' }}><X size={12} /></button>
                    </div>
                  ) : <span style={{ fontSize: '11px', color: '#ffd700' }}>Ожидание ответа...</span>
                ) : (
                  <span style={{ fontSize: '11px', fontWeight: '700', color: d.status === 'accepted' ? '#00f5d4' : '#ff5f5f' }}>
                    {d.status === 'accepted' ? '✓ Принято!' : '✖ Отклонено'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Message Timeline */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(10, 8, 19, 0.5)' }}>
          {loadingChat ? (
            <div style={{ margin: 'auto', color: 'var(--text-muted)', fontSize: '14px' }}>Загрузка беседы...</div>
          ) : messages.length === 0 ? (
            <div style={{ margin: 'auto', textAlign: 'center', padding: '20px', maxWidth: '250px' }}>
              <MessageSquare size={32} color="var(--text-muted)" style={{ margin: 'auto', marginBottom: '10px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                Вы понравились друг другу! Напишите {partner.name} первым.
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
                    maxWidth: '78%',
                    padding: '12px 16px',
                    borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: isMe 
                      ? 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)' 
                      : 'rgba(255, 255, 255, 0.05)',
                    border: isMe ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    color: '#fff',
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

        {/* Fixed Input Form (Requirement #2) */}
        <form 
          onSubmit={handleSendMessage} 
          className="glass" 
          style={{ 
            padding: '12px 16px', 
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
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
            style={{ width: '44px', height: '44px', padding: 0, borderRadius: '50%', flexShrink: 0 }}
            disabled={!newMessage.trim()}
          >
            <Send size={18} />
          </button>
        </form>

        {/* Date Proposal Modal (Yandex Maps Integration) */}
        {showDateModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="glass-premium" style={{ width: '100%', maxWidth: '360px', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px' }}>Назначить свидание 📍</h3>
                <button onClick={() => setShowDateModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
              </div>

              <form onSubmit={handleCreateDateProposal} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="input-group">
                  <span className="input-label">Место / Заведение *</span>
                  <input type="text" placeholder="например: Ресторан Пушкинъ" className="input-field" value={dateVenue} onChange={e => setDateVenue(e.target.value)} required />
                </div>

                <div className="input-group">
                  <span className="input-label">Дата и время *</span>
                  <input type="text" placeholder="например: Пятница, 20:00" className="input-field" value={dateTime} onChange={e => setDateTime(e.target.value)} required />
                </div>

                <div className="input-group">
                  <span className="input-label">Ссылка Яндекс Карты (необязательно)</span>
                  <input type="text" placeholder="https://yandex.ru/maps/..." className="input-field" value={dateYandexUrl} onChange={e => setDateYandexUrl(e.target.value)} />
                </div>

                <button type="submit" className="btn btn-accent" style={{ padding: '14px', borderRadius: '14px' }}>
                  🚀 Отправить приглашение
                </button>
              </form>
            </div>
          </div>
        )}

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
                gap: '6px'
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
                gap: '6px'
              }}
            >
              <MessageSquare size={15} />
              Диалоги ({matches.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Likes Received */}
        {activeTab === 'likes' && (
          <div>
            {loadingMatches ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Загрузка лайков...</div>
            ) : incomingLikes.length === 0 ? (
              <div className="glass-premium" style={{ padding: '35px', textAlign: 'center', borderRadius: '24px', color: 'var(--text-muted)' }}>
                <Heart size={40} color="var(--color-primary)" style={{ margin: 'auto', marginBottom: '12px' }} />
                <h3 style={{ fontSize: '17px', color: '#fff', marginBottom: '6px' }}>Пока никто вас не лайкнул</h3>
                <p style={{ fontSize: '12px', maxWidth: '260px', margin: 'auto' }}>
                  Продолжайте свайпать в ленте знакомств!
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
                              {u.gender === 'male' ? `💰 ${parseInt(u.income || 0).toLocaleString('ru-RU')} ₽` : `⚖️ ${u.weight} кг`}
                            </span>
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            📍 {u.city || 'Москва'} | Рост: {u.height} см
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => fetch(`${API_URL}/api/like`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ targetUserId: u.id, action: 'dislike' }) }).then(fetchIncomingLikes)} className="btn btn-secondary" style={{ padding: '10px 14px', fontSize: '12px', color: '#ff5f5f' }} title="Пропустить">
                          <X size={16} />
                        </button>
                        <button onClick={() => fetch(`${API_URL}/api/like`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ targetUserId: u.id, action: 'like' }) }).then(loadAllData)} className="btn btn-secondary" style={{ flex: 1, padding: '10px', fontSize: '12px', color: 'var(--color-accent)' }}>
                          <Heart size={14} fill="var(--color-accent)" /> Взаимный лайк
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Conversations List */}
        {activeTab === 'chats' && (
          <div>
            {loadingMatches ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Загрузка диалогов...</div>
            ) : matches.length === 0 ? (
              <div className="glass-premium" style={{ padding: '35px', textAlign: 'center', borderRadius: '24px', color: 'var(--text-muted)' }}>
                <MessageSquare size={40} color="var(--text-muted)" style={{ margin: 'auto', marginBottom: '12px' }} />
                <h3 style={{ fontSize: '17px', color: '#fff', marginBottom: '6px' }}>Пока нет активных диалогов</h3>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {matches.map((match) => (
                  <div 
                    key={match.chatId} 
                    className="glass" 
                    style={{ display: 'flex', alignItems: 'center', padding: '14px', borderRadius: '16px', cursor: 'pointer' }}
                    onClick={() => handleSelectChat(match)}
                  >
                    <img 
                      src={getPhotoUrl(match.user.photos?.[0])} 
                      alt={match.user.name} 
                      style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', marginRight: '15px', border: '2px solid var(--color-accent)' }}
                    />
                    
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', fontSize: '15px' }}>{match.user.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📍 {match.user.city || 'Москва'}</span>
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
