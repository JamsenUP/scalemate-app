import React, { useState, useEffect, useRef } from 'react';
import { Shuffle, Send, Heart, SkipForward, XCircle, ShieldCheck, User, Sparkles, Filter, AlertCircle, ArrowLeft } from 'lucide-react';

export default function AnonChat({ user, API_URL, tgUserId, onNavigateToChats }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'searching' | 'matched' | 'closed'
  const [preferredGender, setPreferredGender] = useState('any'); // 'any' | 'female' | 'male'
  const [roomId, setRoomId] = useState(null);
  const [partner, setPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [userLiked, setUserLiked] = useState(false);
  const [partnerLiked, setPartnerLiked] = useState(false);
  const [isMutual, setIsMutual] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [notification, setNotification] = useState(null);

  const messagesEndRef = useRef(null);

  const getHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    const tgInit = window.Telegram?.WebApp?.initData;
    if (tgInit) {
      headers['x-tg-init-data'] = tgInit;
    } else {
      headers['x-dev-user-id'] = tgUserId;
    }
    return headers;
  };

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check initial status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  // Polling during search or match
  useEffect(() => {
    let timer;
    if (status === 'searching') {
      timer = setInterval(checkStatus, 1500);
    } else if (status === 'matched' && roomId) {
      timer = setInterval(fetchMessages, 1500);
    }
    return () => clearInterval(timer);
  }, [status, roomId]);

  const showToast = (text) => {
    setNotification(text);
    setTimeout(() => setNotification(null), 3000);
  };

  const checkStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/anon-chat/status`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        if (data.status === 'matched') {
          setStatus('matched');
          setRoomId(data.roomId);
          setPartner(data.partner);
          setUserLiked(data.userLiked || false);
          setPartnerLiked(data.partnerLiked || false);
          setIsMutual(data.isMutual || false);
        } else if (data.status === 'searching') {
          setStatus('searching');
        } else if (status !== 'matched') {
          setStatus('idle');
        }
      }
    } catch (err) {
      console.error('Check status error:', err);
    }
  };

  const startSearch = async () => {
    setStatus('searching');
    setMessages([]);
    setPartner(null);
    setRoomId(null);
    setUserLiked(false);
    setPartnerLiked(false);
    setIsMutual(false);

    try {
      const res = await fetch(`${API_URL}/api/anon-chat/join`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ preferredGender })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.status === 'matched') {
          setStatus('matched');
          setRoomId(data.roomId);
          setPartner(data.partner);
        } else {
          setStatus('searching');
        }
      } else {
        setStatus('idle');
        showToast(data.error || 'Ошибка входа в очередь');
      }
    } catch (err) {
      console.error('Start search error:', err);
      setStatus('idle');
    }
  };

  const cancelSearch = async () => {
    try {
      await fetch(`${API_URL}/api/anon-chat/leave`, {
        method: 'POST',
        headers: getHeaders()
      });
    } catch (err) {
      console.error('Cancel search error:', err);
    }
    setStatus('idle');
  };

  const fetchMessages = async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`${API_URL}/api/anon-chat/messages?roomId=${roomId}`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        if (data.status === 'closed') {
          setStatus('closed');
          showToast('Собеседник завершил диалог');
        } else {
          setMessages(data.messages || []);
          if (data.partner) setPartner(data.partner);
          setUserLiked(data.userLiked || false);
          setPartnerLiked(data.partnerLiked || false);
          setIsMutual(data.isMutual || false);
        }
      }
    } catch (err) {
      console.error('Fetch messages error:', err);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !roomId || sendingMsg) return;

    const textToSend = inputText;
    setInputText('');
    setSendingMsg(true);

    try {
      const res = await fetch(`${API_URL}/api/anon-chat/message`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ roomId, text: textToSend })
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setMessages(prev => [...prev, data.message]);
      } else if (data.error) {
        showToast(data.error);
      }
    } catch (err) {
      console.error('Send message error:', err);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleNext = async () => {
    setStatus('searching');
    setMessages([]);
    setPartner(null);
    setUserLiked(false);
    setPartnerLiked(false);
    setIsMutual(false);

    try {
      const res = await fetch(`${API_URL}/api/anon-chat/next`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ preferredGender })
      });
      const data = await res.json();
      if (res.ok && data.status === 'matched') {
        setStatus('matched');
        setRoomId(data.roomId);
        setPartner(data.partner);
      }
    } catch (err) {
      console.error('Next partner error:', err);
    }
  };

  const handleLike = async () => {
    if (!roomId || userLiked) return;
    setUserLiked(true);
    try {
      const res = await fetch(`${API_URL}/api/anon-chat/like`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ roomId })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.mutual) {
          setIsMutual(true);
          showToast('🎉 Взаимная симпатия! Собеседник добавлен в ваши постоянные чаты!');
        } else {
          showToast('Вы высказали симпатию! Ждем ответа собеседника...');
        }
      }
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  const handleLeave = async () => {
    await cancelSearch();
    setStatus('idle');
  };

  // Render State 1: Start Screen
  if (status === 'idle') {
    return (
      <div className="screen-container" style={{ padding: '20px', justifyContent: 'center', alignItems: 'center' }}>
        <div className="bg-mesh mesh-1"></div>
        <div className="bg-mesh mesh-2"></div>

        <div className="glass-premium" style={{ width: '100%', maxWidth: '400px', padding: '32px 24px', borderRadius: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(255, 75, 110, 0.2), rgba(150, 50, 250, 0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.15)', boxShadow: '0 0 30px rgba(255, 75, 110, 0.3)' }}>
            <Shuffle size={38} style={{ color: 'var(--color-primary)' }} />
          </div>

          <div>
            <h2 style={{ fontSize: '26px', fontWeight: '800', background: 'linear-gradient(135deg, #fff, var(--color-primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Случайный Рулетка-Чат
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px', lineHeight: '1.5' }}>
              Быстрый поиск собеседника без лишних ожиданий! Общайтесь в реальном времени, видьте верификацию веса и сохраняйте понравившихся людей.
            </p>
          </div>

          {/* Gender Filter Selection */}
          <div style={{ width: '100%', background: 'rgba(255,255,255,0.04)', borderRadius: '20px', padding: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Filter size={14} /> Кого вы ищете?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {[
                { id: 'any', label: 'Неважно 🎲' },
                { id: 'female', label: 'Девушку 👩' },
                { id: 'male', label: 'Парня 👨' }
              ].map((item) => {
                const isActive = preferredGender === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    style={{
                      padding: '10px 4px',
                      fontSize: '13px',
                      borderRadius: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.25s ease',
                      background: isActive 
                        ? 'linear-gradient(135deg, var(--color-primary), var(--color-accent))' 
                        : 'rgba(255, 255, 255, 0.05)',
                      border: isActive ? '2px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.12)',
                      color: isActive ? '#ffffff' : 'var(--text-muted)',
                      boxShadow: isActive ? '0 0 18px rgba(255, 75, 110, 0.4)' : 'none',
                      fontWeight: isActive ? '700' : '500',
                      transform: isActive ? 'scale(1.04)' : 'scale(1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onClick={() => setPreferredGender(item.id)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', padding: '16px', borderRadius: '20px', fontSize: '16px', fontWeight: '700', boxShadow: '0 8px 25px rgba(255, 75, 110, 0.4)' }} onClick={startSearch}>
            Начать поиск собеседника 🎲
          </button>
        </div>
      </div>
    );
  }

  // Render State 2: Searching Screen
  if (status === 'searching') {
    return (
      <div className="screen-container" style={{ padding: '20px', justifyContent: 'center', alignItems: 'center' }}>
        <div className="bg-mesh mesh-1"></div>

        <div className="glass-premium" style={{ width: '100%', maxWidth: '380px', padding: '40px 24px', borderRadius: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '28px', alignItems: 'center' }}>
          
          {/* Animated Radar Pulse */}
          <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', border: '2px solid var(--color-primary)', animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite', opacity: 0.7 }}></div>
            <div style={{ position: 'absolute', width: '75%', height: '75%', borderRadius: '50%', border: '2px solid var(--color-accent)', animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite 0.5s', opacity: 0.5 }}></div>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px var(--color-primary)', zIndex: 2 }}>
              <Sparkles size={28} color="#fff" />
            </div>
          </div>
          <style>{`
            @keyframes ping {
              75%, 100% { transform: scale(1.6); opacity: 0; }
            }
          `}</style>

          <div>
            <h3 style={{ fontSize: '22px', fontWeight: '700' }}>Ищем подходящего человека...</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>
              Фильтр: {preferredGender === 'female' ? 'Девушки 👩' : preferredGender === 'male' ? 'Парни 👨' : 'Любой пол 🎲'}
            </p>
          </div>

          <button className="btn btn-glass" style={{ width: '100%', padding: '14px', borderRadius: '16px', color: '#ff5f5f', borderColor: 'rgba(255,95,95,0.3)' }} onClick={cancelSearch}>
            <XCircle size={18} style={{ marginRight: '8px' }} /> Отменить поиск
          </button>
        </div>
      </div>
    );
  }

  // Render State 3: Connected Live Chat Screen
  return (
    <div className="screen-container" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0', paddingBottom: '70px', overflow: 'hidden' }}>
      
      {/* Toast Notification */}
      {notification && (
        <div style={{ position: 'fixed', top: '15px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'rgba(20, 15, 35, 0.95)', border: '1px solid var(--color-primary)', padding: '10px 18px', borderRadius: '20px', color: '#fff', fontSize: '13px', boxShadow: '0 8px 25px rgba(0,0,0,0.5)', textAlign: 'center', maxWidth: '90%' }}>
          {notification}
        </div>
      )}

      {/* Header with Partner Profile Banner */}
      <div style={{ padding: '12px 16px', background: 'rgba(15, 12, 28, 0.95)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => setShowProfileModal(true)}>
          <div style={{ position: 'relative' }}>
            <img 
              src={partner?.photos?.[0] || partner?.verificationSelfie || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'} 
              alt={partner?.name || 'Собеседник'} 
              style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }}
            />
            {partner?.isVerified && (
              <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', background: '#00e676', borderRadius: '50%', padding: '2px', display: 'flex' }}>
                <ShieldCheck size={12} color="#000" />
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {partner?.name || 'Собеседник'}, {partner?.age || 22}
              {partner?.isVerified && (
                <span style={{ fontSize: '11px', color: '#00e676', background: 'rgba(0,230,118,0.15)', padding: '2px 6px', borderRadius: '8px' }}>
                  ⚖️ {partner?.weight} кг
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {status === 'closed' ? '🔴 Дилог завершен' : '🟢 На связи • Нажмите для профиля'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-glass" style={{ padding: '8px 12px', borderRadius: '12px', fontSize: '12px' }} onClick={handleNext}>
            <SkipForward size={16} /> Сменить
          </button>
        </div>
      </div>

      {/* Control Action Bar */}
      <div style={{ display: 'flex', gap: '8px', padding: '10px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'space-around' }}>
        <button 
          className={`btn ${userLiked ? 'btn-primary' : 'btn-glass'}`} 
          style={{ flex: 1, padding: '10px', fontSize: '13px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          onClick={handleLike}
          disabled={userLiked || status === 'closed'}
        >
          <Heart size={16} fill={userLiked ? '#fff' : 'none'} color={userLiked ? '#fff' : 'var(--color-primary)'} />
          {isMutual ? 'В контактах 💖' : userLiked ? 'Симпатия отправлена' : 'Нравится 💖'}
        </button>

        <button 
          className="btn btn-glass" 
          style={{ flex: 1, padding: '10px', fontSize: '13px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#ff5f5f', borderColor: 'rgba(255,95,95,0.2)' }}
          onClick={handleLeave}
        >
          <XCircle size={16} /> Завершить
        </button>
      </div>

      {/* Messages List Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* Intro banner */}
        <div style={{ textAlign: 'center', margin: '8px 0', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '12px', color: 'var(--text-muted)' }}>
          🎲 Вы подключились к случайному разговору с <b>{partner?.name || 'собеседником'}</b>! Напишите приветствие.
        </div>

        {messages.map((msg, i) => {
          const isMe = String(msg.sender_id) === String(user?.id || tgUserId);
          return (
            <div 
              key={msg.id || i}
              style={{
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                maxWidth: '78%',
                padding: '12px 16px',
                borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                background: isMe ? 'linear-gradient(135deg, var(--color-primary), var(--color-accent))' : 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: '14px',
                lineHeight: '1.4',
                boxShadow: isMe ? '0 4px 15px rgba(255, 75, 110, 0.3)' : 'none',
                wordBreak: 'break-word'
              }}
            >
              {msg.text}
              <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px', textAlign: 'right' }}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Message Form */}
      {status === 'closed' ? (
        <div style={{ padding: '16px', textAlign: 'center', background: 'rgba(255,95,95,0.15)', color: '#ff5f5f', fontSize: '14px', fontWeight: '600' }}>
          Собеседник вышел. <button className="btn btn-primary" style={{ marginLeft: '10px', padding: '6px 14px', fontSize: '12px' }} onClick={handleNext}>Искать следующего 🎲</button>
        </div>
      ) : (
        <form onSubmit={sendMessage} style={{ padding: '12px 16px', background: 'rgba(15, 12, 28, 0.98)', borderTop: '1px solid rgba(255,255,255,0.12)', display: 'flex', gap: '10px', alignItems: 'center', zIndex: 100 }}>
          <input
            type="text"
            placeholder="Напишите сообщение..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '24px', padding: '12px 18px', color: '#fff', fontSize: '14px', outline: 'none' }}
          />
          <button type="submit" className="btn btn-primary" style={{ width: '46px', height: '46px', borderRadius: '50%', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={!inputText.trim()}>
            <Send size={18} />
          </button>
        </form>
      )}

      {/* Partner Full Profile Modal */}
      {showProfileModal && partner && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-premium" style={{ width: '100%', maxWidth: '360px', padding: '24px', borderRadius: '28px', position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowProfileModal(false)}>
              <XCircle size={20} />
            </button>

            <img 
              src={partner.photos?.[0] || partner.verificationSelfie || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'} 
              alt={partner.name} 
              style={{ width: '100%', height: '260px', objectFit: 'cover', borderRadius: '20px' }}
            />

            <div>
              <div style={{ fontSize: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {partner.name}, {partner.age}
                {partner.isVerified && <ShieldCheck size={20} color="#00e676" />}
              </div>

              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                📍 {partner.city || 'Москва'} • {partner.gender === 'female' ? 'Девушка' : 'Парень'}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                <span style={{ background: 'rgba(0,230,118,0.15)', color: '#00e676', padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
                  ⚖️ Вес: {partner.weight} кг (Верифицирован)
                </span>
                <span style={{ background: 'rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: '12px', fontSize: '12px' }}>
                  📏 Рост: {partner.height} см
                </span>
              </div>

              {partner.bio && (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '12px', lineHeight: '1.4', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '14px' }}>
                  "{partner.bio}"
                </p>
              )}
            </div>

            <button className="btn btn-primary" style={{ width: '100%', padding: '12px', borderRadius: '16px' }} onClick={() => setShowProfileModal(false)}>
              Вернуться к чату
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
