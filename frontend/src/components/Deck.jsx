import React, { useState, useEffect } from 'react';
import { Heart, X, MessageSquare, Scale, Check, Sliders, RotateCcw, Send, Sparkles, ShieldCheck, MapPin, User, ChevronLeft, ChevronRight, Share2, DollarSign, Star, Car, Home } from 'lucide-react';
import { POPULAR_SETTLEMENTS } from '../utils/cities';

export default function Deck({ user, API_URL, tgUserId, onNavigateToChat }) {
  const [feed, setFeed] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter modal state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minAge: 18,
    maxAge: 60,
    minHeight: 140,
    maxHeight: 210,
    minWeight: 35,
    maxWeight: 200,
    minIncome: 0,
    city: 'Все населенные пункты'
  });

  // Match state
  const [matchData, setMatchData] = useState(null);

  // Detailed User Profile Modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [modalUser, setModalUser] = useState(null);
  const [modalPhotoIndex, setModalPhotoIndex] = useState(0);
  const [modalReviews, setModalReviews] = useState([]);

  // Swipe drag gesture states
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  
  // Direct Message modal state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [directMsgText, setDirectMsgText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  useEffect(() => {
    fetchFeed();
  }, []);

  const getAuthHeaders = () => {
    const headers = {};
    const tgInit = window.Telegram?.WebApp?.initData;
    if (tgInit) headers['x-tg-init-data'] = tgInit;
    else headers['x-dev-user-id'] = tgUserId;
    return headers;
  };

  const fetchFeed = async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (filters.minAge) query.append('minAge', filters.minAge);
      if (filters.maxAge) query.append('maxAge', filters.maxAge);
      if (filters.minHeight) query.append('minHeight', filters.minHeight);
      if (filters.maxHeight) query.append('maxHeight', filters.maxHeight);
      if (filters.minWeight) query.append('minWeight', filters.minWeight);
      if (filters.maxWeight) query.append('maxWeight', filters.maxWeight);
      if (filters.minIncome) query.append('minIncome', filters.minIncome);
      if (filters.city && filters.city !== 'Все населенные пункты') query.append('city', filters.city);

      const response = await fetch(`${API_URL}/api/cards?${query.toString()}`, {
        headers: getAuthHeaders()
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ошибка загрузки карточек');

      setFeed(data.cards || []);
      setCurrentIndex(0);
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить анкеты');
    } finally {
      setLoading(false);
    }
  };

  const currentCard = feed[currentIndex];
  const hasCards = feed.length > 0 && currentIndex < feed.length;

  const handleSwipe = async (action) => {
    if (!currentCard) return;

    const targetUser = currentCard;
    setDragOffset({ x: action === 'like' ? 500 : -500, y: 0 });

    setTimeout(async () => {
      setDragOffset({ x: 0, y: 0 });
      setCurrentIndex(prev => prev + 1);

      try {
        const response = await fetch(`${API_URL}/api/like`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ targetUserId: targetUser.id, action })
        });

        const result = await response.json();
        if (result.isMatch && result.matchedUser) {
          setMatchData(result.matchedUser);
        }
      } catch (err) {
        console.error(err);
      }
    }, 250);
  };

  const handleSendDirectMessage = async (e) => {
    e.preventDefault();
    if (!directMsgText.trim() || !currentCard) return;

    setSendingMsg(true);
    try {
      const chatId = [user.id, currentCard.id].sort().join('_');

      // Add like first to trigger potential match
      await fetch(`${API_URL}/api/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ targetUserId: currentCard.id, action: 'like' })
      });

      // Send first message
      const res = await fetch(`${API_URL}/api/chats/${chatId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ text: directMsgText })
      });

      if (res.ok) {
        setShowMessageModal(false);
        setDirectMsgText('');
        onNavigateToChat(chatId, currentCard);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleOpenDetailedProfile = async (targetUser) => {
    setModalUser(targetUser);
    setModalPhotoIndex(0);
    setShowProfileModal(true);
    try {
      const res = await fetch(`${API_URL}/api/reviews/${targetUser.id}`, { headers: getAuthHeaders() });
      const d = await res.json();
      if (res.ok) setModalReviews(d.reviews || []);
    } catch (e) { console.error(e); }
  };

  // Touch Swipe Handlers
  const handleTouchStart = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setStartPos({ x: clientX, y: clientY });
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragOffset({
      x: clientX - startPos.x,
      y: clientY - startPos.y
    });
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragOffset.x > 100) handleSwipe('like');
    else if (dragOffset.x < -100) handleSwipe('dislike');
    else setDragOffset({ x: 0, y: 0 });
  };

  const getPhotoUrl = (p) => {
    if (!p) return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500';
    return p.startsWith('http') ? p : API_URL + p;
  };

  return (
    <div className="screen-container">
      <div className="bg-mesh mesh-1"></div>
      <div className="bg-mesh mesh-2"></div>

      {/* Filter Modal */}
      {showFilters && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-premium" style={{ width: '100%', maxWidth: '360px', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px' }}>Фильтры поиска 🔍</h3>
              <button onClick={() => setShowFilters(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div className="input-group">
              <span className="input-label">Населенный пункт (любой город, село)</span>
              <input 
                type="text"
                list="deck-settlements-datalist"
                placeholder="Все населенные пункты"
                className="input-field" 
                value={filters.city} 
                onChange={e => setFilters(prev => ({ ...prev, city: e.target.value }))} 
              />
              <datalist id="deck-settlements-datalist">
                <option value="Все населенные пункты" />
                {POPULAR_SETTLEMENTS.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>

            <div className="input-group">
              <span className="input-label">Возраст: {filters.minAge} - {filters.maxAge} лет</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="range" min="18" max="70" value={filters.minAge} onChange={e => setFilters(prev => ({ ...prev, minAge: Number(e.target.value) }))} style={{ flex: 1 }} />
                <input type="range" min="18" max="70" value={filters.maxAge} onChange={e => setFilters(prev => ({ ...prev, maxAge: Number(e.target.value) }))} style={{ flex: 1 }} />
              </div>
            </div>

            {user.gender === 'female' ? (
              <div className="input-group">
                <span className="input-label">Минимальный доход мужчин: {filters.minIncome.toLocaleString('ru-RU')} ₽/мес</span>
                <input type="range" min="0" max="1000000" step="50000" value={filters.minIncome} onChange={e => setFilters(prev => ({ ...prev, minIncome: Number(e.target.value) }))} />
              </div>
            ) : (
              <div className="input-group">
                <span className="input-label">Максимальный вес женщин: {filters.maxWeight} кг</span>
                <input type="range" min="35" max="200" value={filters.maxWeight} onChange={e => setFilters(prev => ({ ...prev, maxWeight: Number(e.target.value) }))} />
              </div>
            )}

            <button onClick={() => { fetchFeed(); setShowFilters(false); }} className="btn btn-accent" style={{ padding: '14px', borderRadius: '14px' }}>
              Применить фильтры
            </button>
          </div>
        </div>
      )}

      {/* Detailed Profile Modal */}
      {showProfileModal && modalUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-premium" style={{ width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '24px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px' }}>Профиль: {modalUser.name}</h3>
              <button onClick={() => setShowProfileModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={22} /></button>
            </div>

            <div style={{ position: 'relative', width: '100%', height: '320px', borderRadius: '20px', overflow: 'hidden' }}>
              <img src={getPhotoUrl(modalUser.photos?.[modalPhotoIndex])} alt={modalUser.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {modalUser.photos?.length > 1 && (
                <>
                  <button onClick={() => setModalPhotoIndex(prev => (prev > 0 ? prev - 1 : modalUser.photos.length - 1))} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer' }}>
                    <ChevronLeft size={22} />
                  </button>
                  <button onClick={() => setModalPhotoIndex(prev => (prev < modalUser.photos.length - 1 ? prev + 1 : 0))} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer' }}>
                    <ChevronRight size={22} />
                  </button>
                </>
              )}
            </div>

            <div className="glass" style={{ padding: '14px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Уровень доверия (Trust Score)</span>
                <strong style={{ color: 'var(--color-accent)' }}>{modalUser.trustScore || 85}%</strong>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${modalUser.trustScore || 85}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="glass" style={{ padding: '10px', borderRadius: '14px', fontSize: '13px' }}>
                📍 <strong>Населенный пункт:</strong> {modalUser.city || 'Москва'}
              </div>
              <div className="glass" style={{ padding: '10px', borderRadius: '14px', fontSize: '13px' }}>
                📏 <strong>Рост:</strong> {modalUser.height} см
              </div>
              {modalUser.gender === 'female' ? (
                <div className="glass" style={{ padding: '10px', borderRadius: '14px', fontSize: '13px' }}>
                  ⚖️ <strong>Вес:</strong> {modalUser.weight} кг
                </div>
              ) : (
                <div className="glass" style={{ padding: '10px', borderRadius: '14px', fontSize: '13px' }}>
                  💰 <strong>Доход:</strong> {parseInt(modalUser.income || 0).toLocaleString('ru-RU')} ₽
                </div>
              )}
              <div className="glass" style={{ padding: '10px', borderRadius: '14px', fontSize: '13px' }}>
                🛡️ <strong>Статус:</strong> {modalUser.isVerified ? 'Верифицирован ✅' : 'Обычный'}
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '4px' }}>О себе</h4>
              <p style={{ fontSize: '14px', lineHeight: '1.4' }}>{modalUser.bio || 'Пользователь пока не добавил описание.'}</p>
            </div>

            {modalUser.assets && modalUser.assets.length > 0 && (
              <div>
                <h4 style={{ fontSize: '14px', color: 'var(--color-accent)', marginBottom: '8px' }}>🏎️ Недвижимость и Автомобили</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {modalUser.assets.map((item, idx) => (
                    <div key={idx} className="glass" style={{ padding: '10px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {item.photo && (
                        <div style={{ position: 'relative', height: '140px', borderRadius: '10px', overflow: 'hidden' }}>
                          <img src={getPhotoUrl(item.photo)} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: item.type === 'car' ? 'rgba(0, 245, 212, 0.15)' : 'rgba(168, 85, 247, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {item.type === 'car' ? <Car color="#00f5d4" size={18} /> : <Home color="#a855f7" size={18} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: '700' }}>{item.title}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>~{parseInt(item.price || 0).toLocaleString('ru-RU')} ₽</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Отзывы встречавшихся ({modalReviews.length})</h4>
              {modalReviews.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Пока нет отзывов.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {modalReviews.map(r => (
                    <div key={r.id} className="glass" style={{ padding: '10px', borderRadius: '12px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <strong>{r.reviewer_name}</strong>
                        <span style={{ color: '#ffd700' }}>{'★'.repeat(r.rating)}</span>
                      </div>
                      <p>{r.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Main Deck Stack View */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', zIndex: 1 }}>
        
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 5px 10px 5px' }}>
          <span style={{ fontSize: '20px', fontWeight: '800', background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ScaleMate
          </span>

          <button 
            onClick={() => setShowFilters(true)}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
          >
            <Sliders size={14} color="var(--color-primary)" /> Фильтры
          </button>
        </div>

        {hasCards ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
            <div className="swipe-card-container">
              <div 
                className="swipe-card glass"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleTouchStart}
                onMouseMove={handleTouchMove}
                onMouseUp={handleTouchEnd}
                style={{
                  transform: `translate3d(${dragOffset.x}px, ${dragOffset.y * 0.4}px, 0px) rotate(${dragOffset.x * 0.08}deg)`,
                  transition: isDragging ? 'none' : 'transform 0.3s ease-out'
                }}
              >
                {dragOffset.x > 30 && <div className="swipe-badge like">ЛАЙК</div>}
                {dragOffset.x < -30 && <div className="swipe-badge dislike">ПРОПУСК</div>}

                <img src={getPhotoUrl(currentCard.photos[0])} alt={currentCard.name} className="card-image" />
                <div className="card-gradient" />
                <div className="card-info">
                  
                  <div className="badge-verified">
                    <Check size={12} strokeWidth={3} />
                    {currentCard.gender === 'male' 
                      ? `Доход ${parseInt(currentCard.income || 150000).toLocaleString('ru-RU')} ₽/мес` 
                      : `${currentCard.weight} кг (ИМТ ${currentCard.bmi})`}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <h2 style={{ fontSize: '24px' }}>{currentCard.name}, {currentCard.age}</h2>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <span>📍 {currentCard.city || 'Москва'}</span>
                    <span>•</span>
                    <span>Рост: {currentCard.height} см</span>
                  </div>

                  <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.85)', lineHeight: '1.4', marginTop: '3px' }}>
                    {currentCard.bio || 'Нет описания'}
                  </p>
                </div>
              </div>
            </div>

            <div className="swipe-buttons" style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '12px' }}>
              <button onClick={() => handleSwipe('dislike')} className="swipe-btn dislike" title="Пропустить">
                <X size={26} />
              </button>

              <button onClick={() => handleOpenDetailedProfile(currentCard)} className="swipe-btn" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }} title="Подробный профиль">
                <User size={22} />
              </button>

              <button onClick={() => setShowMessageModal(true)} className="swipe-btn message" title="Написать первое сообщение">
                <MessageSquare size={22} />
              </button>

              <button onClick={() => handleSwipe('like')} className="swipe-btn like" title="Понравилось">
                <Heart size={26} fill="currentColor" />
              </button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '20px' }}>
            <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.03)', marginBottom: '15px' }}>
              <Sparkles size={36} color="var(--color-primary)" />
            </div>
            <h3>Анкеты пока закончились</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px', maxWidth: '260px' }}>
              Вы просмотрели все доступные анкеты по заданным фильтрам.
            </p>
            <button onClick={() => { setFilters({ minAge: 18, maxAge: 60, minHeight: 140, maxHeight: 210, minWeight: 35, maxWeight: 200, minIncome: 0, city: 'Все населенные пункты' }); fetchFeed(); }} className="btn btn-secondary" style={{ marginTop: '15px', padding: '10px 20px', borderRadius: '20px', gap: '6px' }}>
              <RotateCcw size={16} /> Сбросить фильтры
            </button>
          </div>
        )}

      </div>

      {/* Direct Message Modal */}
      {showMessageModal && currentCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-premium" style={{ width: '100%', maxWidth: '360px', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '18px' }}>Написать {currentCard.name}</h3>
            
            <form onSubmit={handleSendDirectMessage} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <textarea 
                placeholder="Привет! Предлагаю познакомиться..." 
                className="input-field" 
                rows={3} 
                value={directMsgText} 
                onChange={e => setDirectMsgText(e.target.value)} 
                style={{ resize: 'none' }}
                required 
              />

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setShowMessageModal(false)} className="btn btn-secondary" style={{ flex: 1, padding: '12px' }}>Отмена</button>
                <button type="submit" className="btn btn-accent" disabled={sendingMsg} style={{ flex: 1, padding: '12px' }}>
                  {sendingMsg ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Match Overlay */}
      {matchData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10, 8, 19, 0.95)', backdropFilter: 'blur(15px)', zIndex: 3000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>💖</div>
          <h1 style={{ fontSize: '32px', color: 'var(--color-accent)', marginBottom: '8px' }}>Это Взаимно!</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '24px' }}>
            Вы и {matchData.name} понравились друг другу!
          </p>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '30px' }}>
            <img src={getPhotoUrl(user.photos?.[0])} alt={user.name} style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-primary)' }} />
            <img src={getPhotoUrl(matchData.photos?.[0])} alt={matchData.name} style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-accent)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '280px' }}>
            <button 
              onClick={() => {
                const chatId = [user.id, matchData.id].sort().join('_');
                setMatchData(null);
                onNavigateToChat(chatId, matchData);
              }}
              className="btn btn-accent"
              style={{ padding: '14px', borderRadius: '16px' }}
            >
              Написать прямо сейчас
            </button>

            <button 
              onClick={() => setMatchData(null)}
              className="btn btn-secondary"
              style={{ padding: '14px', borderRadius: '16px' }}
            >
              Продолжить смотреть
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
