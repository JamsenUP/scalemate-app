import React, { useState, useEffect } from 'react';
import { Heart, X, Star, Sparkles, Scale, Info, Check, ShieldAlert, Sliders, RotateCcw } from 'lucide-react';

export default function Deck({ user, API_URL, tgUserId, onNavigateToChat }) {
  const [feed, setFeed] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter modal state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minWeight: 40,
    maxWeight: 110,
    minHeight: 150,
    maxHeight: 200
  });

  // Match state
  const [matchData, setMatchData] = useState(null);


  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/feed`, {
        headers: {
          'x-dev-user-id': tgUserId
        }
      });
      
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Не удалось загрузить ленту');
      }

      setFeed(result.feed);
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
    
    // Optimistically advance card
    setCurrentIndex(prev => prev + 1);

    try {
      const response = await fetch(`${API_URL}/api/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dev-user-id': tgUserId
        },
        body: JSON.stringify({
          targetUserId: targetUser.id,
          action // 'like' or 'dislike'
        })
      });

      if (!response.ok) {
        throw new Error('Ошибка отправки лайка');
      }

      const result = await response.json();
      if (result.isMatch) {
        // Show Match screen!
        setMatchData({
          partner: targetUser
        });
      }

    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="screen-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="bg-mesh mesh-1"></div>
        <div style={{ textAlign: 'center' }}>
          <Sparkles className="spin" size={40} color="var(--color-primary)" style={{ animation: 'spin 2s linear infinite', marginBottom: '15px' }} />
          <p style={{ color: 'var(--text-muted)' }}>Подбираем честные анкеты...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="screen-container" style={{ justifyContent: 'center', alignItems: 'center', padding: '30px', textAlign: 'center' }}>
        <div className="glass-premium" style={{ padding: '30px', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
          <ShieldAlert size={48} color="#ff5f5f" />
          <h3>Доступ Ограничен</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.5' }}>
            {error}
          </p>
          <button onClick={fetchFeed} className="btn" style={{ padding: '12px 20px', fontSize: '14px' }}>
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  // Apply filter to feed
  const filteredFeed = feed.filter(profile => {
    if (profile.weight < filters.minWeight || profile.weight > filters.maxWeight) return false;
    if (profile.height < filters.minHeight || profile.height > filters.maxHeight) return false;
    return true;
  });

  const hasCards = currentIndex < filteredFeed.length;
  const currentCard = hasCards ? filteredFeed[currentIndex] : null;

  return (
    <div className="screen-container" style={{ overflow: 'hidden', paddingBottom: '20px' }}>
      <div className="bg-mesh mesh-1"></div>
      <div className="bg-mesh mesh-2"></div>

      {/* Filter Modal */}
      {showFilters && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(10, 8, 19, 0.92)',
          backdropFilter: 'blur(20px)',
          zIndex: 500,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          animation: 'fadeIn 0.3s ease'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h2 style={{ fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders color="var(--color-primary)" /> Фильтры поиска
              </h2>
              <button 
                onClick={() => setShowFilters(false)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Weight Slider Group */}
            <div className="glass-premium" style={{ padding: '16px', borderRadius: '16px', marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span className="input-label">Диапазон веса (кг)</span>
                <strong style={{ color: 'var(--color-accent)' }}>{filters.minWeight} — {filters.maxWeight} кг</strong>
              </div>
              
              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Мин: {filters.minWeight} кг</span>
                  <input 
                    type="range" 
                    min="35" 
                    max="150" 
                    value={filters.minWeight}
                    onChange={(e) => setFilters(prev => ({ ...prev, minWeight: Number(e.target.value) }))}
                    style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Макс: {filters.maxWeight} кг</span>
                  <input 
                    type="range" 
                    min="35" 
                    max="150" 
                    value={filters.maxWeight}
                    onChange={(e) => setFilters(prev => ({ ...prev, maxWeight: Number(e.target.value) }))}
                    style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                  />
                </div>
              </div>
            </div>

            {/* Height Slider Group */}
            <div className="glass-premium" style={{ padding: '16px', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span className="input-label">Диапазон роста (см)</span>
                <strong style={{ color: 'var(--color-secondary)' }}>{filters.minHeight} — {filters.maxHeight} см</strong>
              </div>
              
              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Мин: {filters.minHeight} см</span>
                  <input 
                    type="range" 
                    min="140" 
                    max="220" 
                    value={filters.minHeight}
                    onChange={(e) => setFilters(prev => ({ ...prev, minHeight: Number(e.target.value) }))}
                    style={{ width: '100%', accentColor: 'var(--color-secondary)' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Макс: {filters.maxHeight} см</span>
                  <input 
                    type="range" 
                    min="140" 
                    max="220" 
                    value={filters.maxHeight}
                    onChange={(e) => setFilters(prev => ({ ...prev, maxHeight: Number(e.target.value) }))}
                    style={{ width: '100%', accentColor: 'var(--color-secondary)' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Filter Action Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => {
                setFilters({ minWeight: 40, maxWeight: 110, minHeight: 150, maxHeight: 200 });
                setCurrentIndex(0);
              }}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '12px' }}
            >
              <RotateCcw size={16} /> Сбросить
            </button>
            <button 
              onClick={() => {
                setCurrentIndex(0);
                setShowFilters(false);
              }}
              className="btn"
              style={{ flex: 2, padding: '12px' }}
            >
              Применить фильтры
            </button>
          </div>
        </div>
      )}

      {/* Match Overlay */}
      {matchData && (
        <div className="match-overlay">
          <div className="bg-mesh mesh-1" style={{ opacity: 0.3, width: '400px', height: '400px' }}></div>
          <h1 className="match-title">Взаимный интерес!</h1>
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '16px' }}>
            Вы понравились друг другу с <strong>{matchData.partner.name}</strong>!
          </p>
          
          <div className="match-photos">
            <img 
              src={user.photos?.[0] || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
              alt="Me" 
              className="match-avatar" 
            />
            <div style={{ fontSize: '30px', animation: 'pulse 1.5s infinite' }}>❤️</div>
            <img 
              src={API_URL + matchData.partner.photos?.[0] || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'} 
              alt={matchData.partner.name} 
              className="match-avatar partner" 
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', maxWidth: '280px' }}>
            <button 
              onClick={() => {
                const partnerId = matchData.partner.id;
                setMatchData(null);
                onNavigateToChat(partnerId);
              }} 
              className="btn"
            >
              Написать сообщение
            </button>
            <button 
              onClick={() => setMatchData(null)} 
              className="btn btn-secondary"
            >
              Продолжить поиск
            </button>
          </div>
        </div>
      )}

      {/* Card Deck Deck */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 5px' }}>
          <span style={{ fontSize: '18px', fontWeight: '800', background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ScaleMate
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              onClick={() => setShowFilters(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#fff',
                padding: '5px 10px',
                borderRadius: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: '600'
              }}
            >
              <Sliders size={12} color="var(--color-primary)" /> Фильтры
            </button>

            <span className="badge-verified" style={{ fontSize: '10px' }}>
              <Scale size={10} /> Вес проверен
            </span>
          </div>
        </div>


        {hasCards ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
            <div className="swipe-card-container">
              <div className="swipe-card glass">
                <img 
                  src={API_URL + currentCard.photos[0]} 
                  alt={currentCard.name} 
                  className="card-image" 
                />
                <div className="card-gradient"></div>
                <div className="card-info">
                  
                  {/* Verified Weight Badge */}
                  <div className="badge-verified">
                    <Check size={12} strokeWidth={3} />
                    {currentCard.weight} кг подтверждено (ИМТ {currentCard.bmi})
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <h2 style={{ fontSize: '26px' }}>{currentCard.name}, {currentCard.age}</h2>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <span>Рост: {currentCard.height} см</span>
                    <span>•</span>
                    <span>Вес: {currentCard.weight} кг</span>
                  </div>

                  <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.85)', lineHeight: '1.4', marginTop: '5px' }}>
                    {currentCard.bio || 'Нет описания'}
                  </p>
                </div>
              </div>
            </div>

            {/* Swipes Controller Buttons */}
            <div className="swipe-buttons">
              <button onClick={() => handleSwipe('dislike')} className="swipe-btn dislike">
                <X size={26} />
              </button>
              <button onClick={() => handleSwipe('like')} className="swipe-btn like">
                <Heart size={26} fill="currentColor" />
              </button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '20px' }}>
            <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.03)', marginBottom: '15px' }}>
              <Sparkles size={32} color="var(--text-muted)" />
            </div>
            <h3>Анкеты закончились</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px', maxWidth: '250px' }}>
              Попробуйте обновить ленту или изменить настройки поиска позже.
            </p>
            <button onClick={fetchFeed} className="btn btn-secondary" style={{ marginTop: '20px', padding: '10px 18px', fontSize: '13px' }}>
              Обновить ленту
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
