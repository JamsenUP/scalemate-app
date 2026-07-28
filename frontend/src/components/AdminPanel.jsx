import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, CheckCircle, Clock, Heart, Check, X, RefreshCw, AlertTriangle, Eye } from 'lucide-react';

export default function AdminPanel({ API_URL, onBack }) {
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [verifiedList, setVerifiedList] = useState([]);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'verified'
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState(null);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const getAuthHeaders = () => {
    const headers = {};
    const tgInit = window.Telegram?.WebApp?.initData;
    if (tgInit) {
      headers['x-tg-init-data'] = tgInit;
    }
    return headers;
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const authHeaders = getAuthHeaders();
      const [statsRes, pendingRes, verifiedRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`, { headers: authHeaders }),
        fetch(`${API_URL}/api/admin/pending`, { headers: authHeaders }),
        fetch(`${API_URL}/api/admin/verified`, { headers: authHeaders })
      ]);

      const statsData = await statsRes.json();
      const pendingData = await pendingRes.json();
      const verifiedData = await verifiedRes.json();

      if (statsRes.ok) setStats(statsData.stats);
      if (pendingRes.ok) setPending(pendingData.pending || []);
      if (verifiedRes.ok) setVerifiedList(verifiedData.verified || []);
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
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
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
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
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

  const handleRevoke = async (userId, name) => {
    if (!window.confirm(`Вы действительно хотите отозвать верификацию у пользователя ${name}?`)) return;

    try {
      const response = await fetch(`${API_URL}/api/admin/revoke`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ userId, reason: 'Верификация отменена администратором @jamsenbang' })
      });

      if (response.ok) {
        setActionMessage(`🔴 Верификация пользователя ${name} отменена.`);
        setTimeout(() => setActionMessage(''), 3500);
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
              Управление и повторная проверка фото весов
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

        {/* Tabs for Moderation */}
        <div style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.04)', padding: '6px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setActiveTab('pending')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'pending' ? 'var(--color-primary)' : 'transparent',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Clock size={14} /> На проверке ({pending.length})
          </button>

          <button
            onClick={() => setActiveTab('verified')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'verified' ? 'var(--color-secondary)' : 'transparent',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <CheckCircle size={14} /> Все подтвержденные ({verifiedList.length})
          </button>
        </div>

        {/* Controls Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={fetchAdminData} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px' }}>
            <RefreshCw size={12} /> Обновить список
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Загрузка...</div>
        ) : activeTab === 'pending' ? (
          /* TAB 1: PENDING MODERATION */
          pending.length === 0 ? (
            <div className="glass" style={{ padding: '30px', textAlign: 'center', borderRadius: '20px' }}>
              <CheckCircle size={40} color="var(--color-accent)" style={{ margin: 'auto', marginBottom: '10px' }} />
              <h4>Очередь пуста!</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '5px' }}>
                Нет пользователей, ожидающих проверки фото весов.
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
                        Вес: <strong style={{ color: '#fff' }}>{item.claimedWeight} кг</strong> (Рост {item.user.height} см)
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', background: 'rgba(255, 183, 3, 0.2)', color: '#ffb703', padding: '4px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                      На модерации
                    </span>
                  </div>

                  {/* Photos Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Фото Весов / Тела</span>
                      <img 
                        src={item.photo ? (API_URL + item.photo) : ''} 
                        alt="Verification photo" 
                        onClick={() => setPreviewPhoto(item.photo ? (API_URL + item.photo) : null)}
                        style={{ width: '100%', height: '110px', borderRadius: '12px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Селфи / Аватар</span>
                      <img 
                        src={item.selfie ? (API_URL + item.selfie) : (item.user.photos?.[0] ? (API_URL + item.user.photos[0]) : '')} 
                        alt="Selfie" 
                        onClick={() => setPreviewPhoto(item.selfie ? (API_URL + item.selfie) : (item.user.photos?.[0] ? (API_URL + item.user.photos[0]) : null))}
                        style={{ width: '100%', height: '110px', borderRadius: '12px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
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
          )
        ) : (
          /* TAB 2: VERIFIED USERS (RE-MODERATION & REVOKE) */
          verifiedList.length === 0 ? (
            <div className="glass" style={{ padding: '30px', textAlign: 'center', borderRadius: '20px' }}>
              <Users size={40} color="var(--text-muted)" style={{ margin: 'auto', marginBottom: '10px' }} />
              <h4>Верифицированных нет</h4>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {verifiedList.map((item, idx) => (
                <div key={idx} className="glass" style={{ padding: '16px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(0, 245, 212, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {item.user.name}, {item.user.age}
                        <CheckCircle size={14} color="var(--color-accent)" />
                      </h4>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Вес: <strong style={{ color: '#fff' }}>{item.claimedWeight || item.user.weight} кг</strong> (Рост {item.user.height} см)
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', background: 'rgba(0, 245, 212, 0.15)', color: 'var(--color-accent)', padding: '4px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                      Подтвержден
                    </span>
                  </div>

                  {/* Verification Photos */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Фото проверки веса</span>
                      {item.photo ? (
                        <img 
                          src={API_URL + item.photo} 
                          alt="Verified Photo" 
                          onClick={() => setPreviewPhoto(API_URL + item.photo)}
                          style={{ width: '100%', height: '100px', borderRadius: '10px', objectFit: 'cover', cursor: 'pointer' }}
                        />
                      ) : (
                        <div style={{ height: '100px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                          (Системное подтверждение)
                        </div>
                      )}
                    </div>

                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Аватарка / Селфи</span>
                      <img 
                        src={item.user.photos?.[0] ? (API_URL + item.user.photos[0]) : (item.selfie ? (API_URL + item.selfie) : '')} 
                        alt="Avatar" 
                        onClick={() => setPreviewPhoto(item.user.photos?.[0] ? (API_URL + item.user.photos[0]) : (item.selfie ? (API_URL + item.selfie) : null))}
                        style={{ width: '100%', height: '100px', borderRadius: '10px', objectFit: 'cover', cursor: 'pointer' }}
                      />
                    </div>
                  </div>

                  {/* Revoke Button */}
                  <button 
                    onClick={() => handleRevoke(item.user.id, item.user.name)}
                    className="btn" 
                    style={{ 
                      marginTop: '4px', 
                      background: 'rgba(255, 95, 95, 0.15)', 
                      border: '1px solid rgba(255, 95, 95, 0.3)', 
                      color: '#ff5f5f', 
                      padding: '10px', 
                      fontSize: '12px', 
                      borderRadius: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    <AlertTriangle size={15} /> Отозвать верификацию (Заблокировать)
                  </button>
                </div>
              ))}
            </div>
          )
        )}

      </div>

      {/* Full Photo Modal */}
      {previewPhoto && (
        <div 
          onClick={() => setPreviewPhoto(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <img 
            src={previewPhoto} 
            alt="Full Preview" 
            style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '16px', objectFit: 'contain' }} 
          />
        </div>
      )}
    </div>
  );
}
