import React, { useState, useEffect } from 'react';
import { Heart, X, History, RotateCcw, Scale } from 'lucide-react';

export default function SwipeHistory({ API_URL, tgUserId, onBack }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

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

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/swipe-history`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (response.ok) {
        setHistory(result.history);
      }
    } catch (err) {
      console.error('Error fetching swipe history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeDecision = async (targetUserId, currentAction) => {
    const newAction = currentAction === 'like' ? 'dislike' : 'like';
    try {
      const response = await fetch(`${API_URL}/api/swipe-history/change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ targetUserId, newAction })
      });

      const result = await response.json();

      if (response.ok) {
        setToastMessage(newAction === 'like' ? '❤️ Изменено на лайк!' : '❌ Изменено на дизлайк!');
        setTimeout(() => setToastMessage(''), 3000);
        
        if (result.isMatch) {
          alert(`🎉 Взаимный мэтч с ${result.matchedUser.name}! Загляните во вкладку Чаты.`);
        }
        
        fetchHistory();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="screen-container">
      <div className="bg-mesh mesh-1"></div>
      <div className="bg-mesh mesh-2"></div>

      <div style={{ zIndex: 1, position: 'relative', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
            <History color="var(--color-primary)" /> История оценок
          </h2>
          <button onClick={onBack} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '12px' }}>
            Назад
          </button>
        </div>

        {toastMessage && (
          <div style={{ background: 'rgba(0, 245, 212, 0.15)', border: '1px solid var(--color-accent)', color: 'var(--color-accent)', padding: '12px', borderRadius: '12px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>
            {toastMessage}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Загрузка истории...</div>
        ) : history.length === 0 ? (
          <div className="glass" style={{ padding: '30px', textAlign: 'center', borderRadius: '20px' }}>
            <History size={40} color="var(--text-muted)" style={{ margin: 'auto', marginBottom: '10px' }} />
            <h4>История пуста</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '5px' }}>
              Вы еще никого не оценили в ленте знакомств.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {history.map((item, idx) => (
              <div key={idx} className="glass" style={{ display: 'flex', alignItems: 'center', padding: '12px', borderRadius: '16px', gap: '15px' }}>
                <img 
                  src={API_URL + item.targetUser.photos[0]} 
                  alt={item.targetUser.name} 
                  style={{ width: '55px', height: '55px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.08)' }}
                />
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', fontSize: '15px' }}>{item.targetUser.name}, {item.targetUser.age}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Scale size={12} /> {item.targetUser.weight} кг
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    {item.type === 'like' ? (
                      <span style={{ fontSize: '12px', background: 'rgba(0, 245, 212, 0.15)', color: 'var(--color-accent)', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Heart size={12} fill="currentColor" /> Лайк
                      </span>
                    ) : (
                      <span style={{ fontSize: '12px', background: 'rgba(255, 95, 95, 0.15)', color: '#ff5f5f', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <X size={12} /> Дизлайк
                      </span>
                    )}

                    <button 
                      onClick={() => handleChangeDecision(item.targetUser.id, item.type)}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'var(--text-muted)',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: '600'
                      }}
                    >
                      <RotateCcw size={10} /> Изменить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
