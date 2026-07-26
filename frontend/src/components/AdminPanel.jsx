import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, CheckCircle, Clock, Heart, MessageSquare, Check, X, RefreshCw } from 'lucide-react';

export default function AdminPanel({ API_URL, onBack }) {
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, pendingRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`),
        fetch(`${API_URL}/api/admin/pending`)
      ]);

      const statsData = await statsRes.json();
      const pendingData = await pendingRes.json();

      if (statsRes.ok) setStats(statsData.stats);
      if (pendingRes.ok) setPending(pendingData.pending);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        setActionMessage('✅ Верификация успешно одобрена!');
        setTimeout(() => setActionMessage(''), 3000);
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reason: 'Фото весов нечеткое или неоригинальное' })
      });

      if (response.ok) {
        setActionMessage('❌ Верификация отклонена.');
        setTimeout(() => setActionMessage(''), 3000);
        fetchAdminData();
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
        
        {/* Admin Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck color="var(--color-accent)" /> Модерация ScaleMate
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
              Панель управления и ручной проверки веса
            </p>
          </div>
          <button onClick={onBack} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '12px' }}>
            Назад
          </button>
        </div>

        {actionMessage && (
          <div style={{ background: 'rgba(0, 245, 212, 0.15)', border: '1px solid var(--color-accent)', color: 'var(--color-accent)', padding: '12px', borderRadius: '12px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>
            {actionMessage}
          </div>
        )}

        {/* Analytics Grid */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="glass" style={{ padding: '15px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Users color="var(--color-primary)" size={24} />
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ПОЛЬЗОВАТЕЛИ</span>
                <h3 style={{ fontSize: '20px' }}>{stats.totalUsers}</h3>
              </div>
            </div>

            <div className="glass" style={{ padding: '15px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CheckCircle color="var(--color-accent)" size={24} />
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ВЕРИФИЦИРОВАНО</span>
                <h3 style={{ fontSize: '20px' }}>{stats.verifiedUsers}</h3>
              </div>
            </div>

            <div className="glass" style={{ padding: '15px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Clock color="#ffb703" size={24} />
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ОЖИДАЮТ ПРОВЕРКИ</span>
                <h3 style={{ fontSize: '20px' }}>{stats.pendingVerifications}</h3>
              </div>
            </div>

            <div className="glass" style={{ padding: '15px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Heart color="var(--color-secondary)" size={24} />
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ВСЕГО СВАЙПОВ</span>
                <h3 style={{ fontSize: '20px' }}>{stats.totalLikes}</h3>
              </div>
            </div>
          </div>
        )}

        {/* Verification Queue Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
          <h3>Очередь верификации ({pending.length})</h3>
          <button onClick={fetchAdminData} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '11px' }}>
            <RefreshCw size={12} /> Обновить
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Загрузка заявок...</div>
        ) : pending.length === 0 ? (
          <div className="glass" style={{ padding: '30px', textAlign: 'center', borderRadius: '20px' }}>
            <CheckCircle size={40} color="var(--color-accent)" style={{ margin: 'auto', marginBottom: '10px' }} />
            <h4>Все заявки проверены!</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '5px' }}>
              Нет пользователей, ожидающих ручной проверки веса.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {pending.map((item, idx) => (
              <div key={idx} className="glass-premium" style={{ padding: '16px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontSize: '16px' }}>{item.user.name}, {item.user.age}</h4>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Заявленный вес: <strong style={{ color: '#fff' }}>{item.claimedWeight} кг</strong> (Рост {item.user.height} см)
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', background: 'rgba(255, 183, 3, 0.2)', color: '#ffb703', padding: '4px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                    На модерации
                  </span>
                </div>

                {/* Photos Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Фото Весов</span>
                    <img 
                      src={API_URL + item.photo} 
                      alt="Scale" 
                      style={{ width: '100%', height: '110px', borderRadius: '12px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Селфи / Профиль</span>
                    <img 
                      src={item.selfie ? (API_URL + item.selfie) : (item.user.photos?.[0] ? (API_URL + item.user.photos[0]) : '')} 
                      alt="Selfie" 
                      style={{ width: '100%', height: '110px', borderRadius: '12px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                  <button 
                    onClick={() => handleApprove(item.user.id)}
                    className="btn btn-accent" 
                    style={{ flex: 1, padding: '10px', fontSize: '13px', borderRadius: '12px' }}
                  >
                    <Check size={16} /> Одобрить
                  </button>
                  <button 
                    onClick={() => handleReject(item.user.id)}
                    className="btn btn-secondary" 
                    style={{ flex: 1, padding: '10px', fontSize: '13px', borderRadius: '12px', color: '#ff5f5f' }}
                  >
                    <X size={16} /> Отклонить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
