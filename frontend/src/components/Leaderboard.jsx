import React, { useState, useEffect } from 'react';
import { Trophy, Crown, Heart, DollarSign, MapPin, Sparkles, Medal } from 'lucide-react';

const CITIES = ['Все города', 'Москва', 'Санкт-Петербург', 'Казань', 'Новосибирск', 'Екатеринбург', 'Нижний Новгород', 'Сочи'];

export default function Leaderboard({ user, API_URL, tgUserId }) {
  const [tab, setTab] = useState('male'); // 'male' (income) | 'female' (likes)
  const [selectedCity, setSelectedCity] = useState('Все города');
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [tab, selectedCity]);

  const getAuthHeaders = () => {
    const headers = {};
    const tgInit = window.Telegram?.WebApp?.initData;
    if (tgInit) headers['x-tg-init-data'] = tgInit;
    else headers['x-dev-user-id'] = tgUserId;
    return headers;
  };

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const cityParam = selectedCity !== 'Все города' ? `&city=${encodeURIComponent(selectedCity)}` : '';
      const response = await fetch(`${API_URL}/api/leaderboard?gender=${tab}${cityParam}`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (response.ok) {
        setLeaders(result.leaderboard || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getPhotoUrl = (p) => {
    if (!p) return 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
    return p.startsWith('http') ? p : API_URL + p;
  };

  return (
    <div className="screen-container">
      <div className="bg-mesh mesh-1"></div>
      <div className="bg-mesh mesh-2"></div>

      <div style={{ zIndex: 1, position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'rgba(255, 215, 0, 0.15)', border: '1px solid rgba(255, 215, 0, 0.3)', marginBottom: '10px' }}>
            <Trophy size={30} color="#ffd700" />
          </div>
          <h2 style={{ fontSize: '24px', background: 'linear-gradient(135deg, #ffd700, #ff8c00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Топ Анкет ScaleMate 🏆
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Рейтинг самых лучших профилей сервиса
          </p>
        </div>

        {/* Tab Switcher: Men (Income) vs Women (Likes) */}
        <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.04)', padding: '4px', borderRadius: '16px', gap: '4px' }}>
          <button
            onClick={() => setTab('male')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              background: tab === 'male' ? 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' : 'transparent',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <DollarSign size={16} color="#00f5d4" /> Топ Мужчин (Доход)
          </button>
          
          <button
            onClick={() => setTab('female')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              background: tab === 'female' ? 'linear-gradient(135deg, #ff007f, #7928ca)' : 'transparent',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Crown size={16} color="#ff007f" /> Топ Девушек (Лайки)
          </button>
        </div>

        {/* City Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {CITIES.map(c => (
            <button
              key={c}
              onClick={() => setSelectedCity(c)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: selectedCity === c ? '1px solid var(--color-accent)' : '1px solid rgba(255,255,255,0.08)',
                background: selectedCity === c ? 'rgba(0, 245, 212, 0.15)' : 'rgba(255,255,255,0.03)',
                color: selectedCity === c ? 'var(--color-accent)' : 'var(--text-muted)',
                fontSize: '12px',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                fontWeight: selectedCity === c ? '700' : '400'
              }}
            >
              <MapPin size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              {c}
            </button>
          ))}
        </div>

        {/* Leaderboard List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Загрузка лидеров...
          </div>
        ) : leaders.length === 0 ? (
          <div className="glass-premium" style={{ padding: '30px', textAlign: 'center', borderRadius: '24px', color: 'var(--text-muted)' }}>
            <Sparkles size={32} style={{ margin: 'auto', marginBottom: '10px' }} />
            <p>В этом городе пока нет лидеров. Будьте первыми!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {leaders.map((item, index) => {
              const rank = index + 1;
              const isTop1 = rank === 1;
              const isTop2 = rank === 2;
              const isTop3 = rank === 3;

              return (
                <div 
                  key={item.id} 
                  className="glass-premium" 
                  style={{ 
                    padding: '14px', 
                    borderRadius: '20px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    border: isTop1 ? '1px solid rgba(255, 215, 0, 0.5)' : isTop2 ? '1px solid rgba(192, 192, 192, 0.5)' : isTop3 ? '1px solid rgba(205, 127, 50, 0.5)' : '1px solid rgba(255,255,255,0.05)',
                    background: isTop1 ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.08), rgba(16, 12, 28, 0.9))' : 'rgba(255,255,255,0.03)'
                  }}
                >
                  {/* Rank Badge */}
                  <div style={{ width: '32px', textAlign: 'center', fontWeight: '800', fontSize: '16px' }}>
                    {isTop1 ? '🥇' : isTop2 ? '🥈' : isTop3 ? '🥉' : `#${rank}`}
                  </div>

                  {/* Avatar */}
                  <img 
                    src={getPhotoUrl(item.photos?.[0])} 
                    alt={item.name}
                    style={{ 
                      width: '52px', 
                      height: '52px', 
                      borderRadius: '50%', 
                      objectFit: 'cover',
                      border: isTop1 ? '2px solid #ffd700' : '2px solid var(--color-primary)'
                    }} 
                  />

                  {/* Details */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '16px' }}>{item.name}, {item.age}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📍 {item.city}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Рост: {item.height} см {item.gender === 'female' ? `| Вес: ${item.weight} кг` : ''}
                    </div>
                  </div>

                  {/* Parameter Badge */}
                  <div style={{ textAlign: 'right' }}>
                    {tab === 'male' ? (
                      <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--color-accent)' }}>
                        💰 {parseInt(item.income || 0).toLocaleString('ru-RU')} ₽
                      </span>
                    ) : (
                      <span style={{ fontSize: '14px', fontWeight: '800', color: '#ff007f', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Heart size={14} fill="#ff007f" /> {item.likesCount || 0}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
