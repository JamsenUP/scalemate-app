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
    maxWeight: 120,
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
      const queryParams = new URLSearchParams();
      if (filters.minAge) queryParams.append('minAge', filters.minAge);
      if (filters.maxAge) queryParams.append('maxAge', filters.maxAge);
      if (filters.minHeight) queryParams.append('minHeight', filters.minHeight);
      if (filters.maxHeight) queryParams.append('maxHeight', filters.maxHeight);
      if (filters.minWeight) queryParams.append('minWeight', filters.minWeight);
      if (filters.maxWeight) queryParams.append('maxWeight', filters.maxWeight);
      if (filters.minIncome) queryParams.append('minIncome', filters.minIncome);
      if (filters.city && filters.city !== 'Все населенные пункты' && filters.city !== 'Все города') {
        queryParams.append('city', filters.city);
      }

      const response = await fetch(`${API_URL}/api/cards?${queryParams.toString()}`, {
        headers: getAuthHeaders()
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не удалось загрузить карточки');

      setFeed(result.cards || []);
      setCurrentIndex(0);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (action) => {
    if (currentIndex >= feed.length) return;
    const targetUser = feed[currentIndex];
    
    setCurrentIndex(prev => prev + 1);
    setDragOffset({ x: 0, y: 0 });

    try {
      const response = await fetch(`${API_URL}/api/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ targetUserId: targetUser.id, action })
      });

      const result = await response.json();
      if (result.isMatch) {
        setMatchData({ partner: result.matchedUser || targetUser });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenDetailedProfile = async (cardUser) => {
    setModalUser(cardUser);
    setModalPhotoIndex(0);
    setShowProfileModal(true);
    try {
      const res = await fetch(`${API_URL}/api/reviews/${cardUser.id}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok) setModalReviews(data.reviews || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendDirectMessage = async (e) => {
    e.preventDefault();
    const currentCard = feed[currentIndex];
    if (!directMsgText.trim() || !currentCard) return;

    setSendingMsg(true);
    try {
      const targetPartner = currentCard;
      await fetch(`${API_URL}/api/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ targetUserId: targetPartner.id, action: 'like' })
      });

      const chatId = [String(user.id), String(targetPartner.id)].sort().join('_');
      await fetch(`${API_URL}/api/chats/${chatId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ text: directMsgText })
      });

      setShowMessageModal(false);
      setDirectMsgText('');
      setCurrentIndex(prev => prev + 1);
      onNavigateToChat(targetPartner.id);
    } catch (err) {
      console.error(err);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleShareApp = () => {
    const text = encodeURIComponent('Присоединяйся к ScaleMate — честные знакомства с верификацией по всей России!');
    const url = encodeURIComponent('https://t.me/scalemate_bot');
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
  };

  const getPhotoUrl = (p) => {
    if (!p) return 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400';
    return p.startsWith('http') ? p : API_URL + p;
  };

  // Touch & Drag events
  const handleTouchStart = (e) => {
    setIsDragging(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setStartPos({ x: clientX, y: clientY });
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragOffset({ x: clientX - startPos.x, y: clientY - startPos.y });
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragOffset.x > 90) handleSwipe('like');
    else if (dragOffset.x < -90) handleSwipe('dislike');
    else setDragOffset({ x: 0, y: 0 });
  };

  const currentCard = feed[currentIndex];
  const hasCards = currentIndex < feed.length;

  return (
    <div className="screen-container">
      <div className="bg-mesh mesh-1"></div>
      <div className="bg-mesh mesh-2"></div>

      {/* Advanced Filters Modal with Settlement Autocomplete */}
      {showFilters && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-premium" style={{ width: '100%', maxWidth: '380px', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px' }}>Фильтры поиска</h3>
              <button onClick={() => setShowFilters(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {/* Any Settlement / Region Search Input */}
            <div className="input-group">
              <span className="input-label">Населенный пункт / Регион</span>
              <input 
                type="text"
                list="deck-settlements-datalist"
                placeholder="Все населенные пункты"
                className="input-field" 
                value={filters.city} 
                onChange={(e) => setFilters(prev => ({ ...prev, city: e.target.value }))} 
              />
              <datalist id="deck-settlements-datalist">
                <option value="Все населенные пункты" />
                {POPULAR_SETTLEMENTS.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            <div className="input-group">
              <span className="input-label">Возраст: {filters.minAge} - {filters.maxAge} лет</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="range" min="18" max="70" value={filters.minAge} onChange={e => setFilters(prev => ({ ...prev, minAge: Number(e.target.value) }))} style={{ flex: 1 }} />
                <input type="range" min="18" max="70" value={filters.maxAge} onChange={e => setFilters(prev => ({ ...prev, maxAge: Number(e.target.value) }))} style={{ flex: 1 }} />
              </div>
            </div>

            <div className="input-group">
              <span className="input-label">Рост: {filters.minHeight} - {filters.maxHeight} см</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="range" min="140" max="210" value={filters.minHeight} onChange={e => setFilters(prev => ({ ...prev, minHeight: Number(e.target.value) }))} style={{ flex: 1 }} />
                <input type="range" min="140" max="210" value={filters.maxHeight} onChange={e => setFilters(prev => ({ ...prev, maxHeight: Number(e.target.value) }))} style={{ flex: 1 }} />
              </div>
            </div>

            {user.gender === 'female' ? (
              <div className="input-group">
                <span className="input-label">Мин. Доход мужчины: {filters.minIncome ? parseInt(filters.minIncome).toLocaleString('ru-RU') : 0} ₽/мес</span>
                <input type="range" min="0" max="1000000" step="50000" value={filters.minIncome} onChange={e => setFilters(prev => ({ ...prev, minIncome: Number(e.target.value) }))} style={{ width: '100%' }} />
              </div>
            ) : (
              <div className="input-group">
                <span className="input-label">Вес девушки: {filters.minWeight} - {filters.maxWeight} кг</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="range" min="35" max="120" value={filters.minWeight} onChange={e => setFilters(prev => ({ ...prev, minWeight: Number(e.target.value) }))} style={{ flex: 1 }} />
                  <input type="range" min="35" max="120" value={filters.maxWeight} onChange={e => setFilters(prev => ({ ...prev, maxWeight: Number(e.target.value) }))} style={{ flex: 1 }} />
                </div>
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
                    <div key={idx} className="glass" style={{ padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {item.type === 'car' ? <Car color="#00f5d4" size={20} /> : <Home color="#a855f7" size={20} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '700' }}>{item.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>~{parseInt(item.price || 0).toLocaleString('ru-RU')} ₽</div>
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
              Вы просмотрели доступные анкеты. Попробуйте обновить фильтр или пригласить друзей!
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px', width: '100%', maxWidth: '260px' }}>
              <button onClick={fetchFeed} className="btn btn-secondary" style={{ padding: '12px', fontSize: '13px' }}>
                <RotateCcw size={15} /> Обновить ленту
              </button>

              <button onClick={handleShareApp} className="btn btn-accent" style={{ padding: '12px', fontSize: '13px', gap: '6px' }}>
                <Share2 size={15} /> Поделиться с друзьями
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
