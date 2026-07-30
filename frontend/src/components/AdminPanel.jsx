import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, CheckCircle, Clock, Heart, Check, X, RefreshCw, AlertTriangle, Eye, Trash2 } from 'lucide-react';

export default function AdminPanel({ API_URL, tgUserId, onBack }) {
  const [stats, setStats] = useState(null);
  const [allList, setAllList] = useState([]);
  const [pending, setPending] = useState([]);
  const [verifiedList, setVerifiedList] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'pending' | 'verified'
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
    } else if (tgUserId) {
      headers['x-dev-user-id'] = tgUserId;
    }
    return headers;
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const authHeaders = getAuthHeaders();
      const [statsRes, allRes, pendingRes, verifiedRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`, { headers: authHeaders }),
        fetch(`${API_URL}/api/admin/all`, { headers: authHeaders }),
        fetch(`${API_URL}/api/admin/pending`, { headers: authHeaders }),
        fetch(`${API_URL}/api/admin/verified`, { headers: authHeaders })
      ]);

      const statsData = await statsRes.json();
      const allData = await allRes.json();
      const pendingData = await pendingRes.json();
      const verifiedData = await verifiedRes.json();

      if (statsRes.ok) setStats(statsData.stats);
      if (allRes.ok) setAllList(allData.allUsers || []);
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
        body: JSON.stringify({ userId, reason: 'Отклонено модератором' })
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
        body: JSON.stringify({ userId, reason: 'Отозвано модератором' })
      });

      if (response.ok) {
        setActionMessage(`🔴 Верификация для ${name} отозвана.`);
        setTimeout(() => setActionMessage(''), 3000);
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (userId, name) => {
    if (!window.confirm(`Вы действительно хотите полностью удалить анкету ${name}?`)) return;

    try {
      const response = await fetch(`${API_URL}/api/admin/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        setActionMessage(`🗑️ Пользователь ${name} полностью удален.`);
        setTimeout(() => setActionMessage(''), 3000);
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="screen-container" style={{ paddingBottom: '90px' }}>
      <div className="bg-mesh mesh-1"></div>
      <div className="bg-mesh mesh-2"></div>

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <button onClick={() => setPreviewPhoto(null)} className="btn btn-secondary" style={{ position: 'absolute', top: 20, right: 20, padding: '10px' }}>
            <X size={20} />
          </button>
          <img src={previewPhoto} alt="Preview" style={{ maxWidth: '90%', maxHeight: '80vh', borderRadius: '16px', objectFit: 'contain' }} />
        </div>
      )}

      <div style={{ zIndex: 1, position: 'relative', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(0, 245, 212, 0.15)', border: '1px solid rgba(0, 245, 212, 0.3)', padding: '10px', borderRadius: '16px', color: 'var(--color-accent)' }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px' }}>Панель Модерации</h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Управление аскетами и верификацией</span>
            </div>
          </div>

          <button onClick={fetchAdminData} className="btn btn-secondary" style={{ padding: '8px 12px' }} title="Обновить данные">
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>

        {actionMessage && (
          <div style={{ background: 'rgba(0, 245, 212, 0.15)', border: '1px solid rgba(0, 245, 212, 0.4)', color: 'var(--color-accent)', padding: '12px', borderRadius: '16px', fontSize: '13px', fontWeight: '600', textAlign: 'center' }}>
            {actionMessage}
          </div>
        )}

        {/* Analytics Counters */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div className="glass-premium" style={{ padding: '12px', borderRadius: '16px', textAlign: 'center' }}>
              <Users size={18} color="var(--color-primary)" style={{ margin: 'auto', marginBottom: '4px' }} />
              <div style={{ fontSize: '18px', fontWeight: '800' }}>{stats.totalUsers}</div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Всего анкет</span>
            </div>

            <div className="glass-premium" style={{ padding: '12px', borderRadius: '16px', textAlign: 'center' }}>
              <CheckCircle size={18} color="var(--color-accent)" style={{ margin: 'auto', marginBottom: '4px' }} />
              <div style={{ fontSize: '18px', fontWeight: '800' }}>{stats.verifiedUsers}</div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Подтверждены</span>
            </div>

            <div className="glass-premium" style={{ padding: '12px', borderRadius: '16px', textAlign: 'center' }}>
              <Clock size={18} color="#ffb703" style={{ margin: 'auto', marginBottom: '4px' }} />
              <div style={{ fontSize: '18px', fontWeight: '800' }}>{stats.pendingVerifications}</div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>На проверке</span>
            </div>
          </div>
        )}

        {/* Tabs Switcher */}
        <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '16px', gap: '4px' }}>
          <button 
            onClick={() => setActiveTab('all')}
            style={{
              flex: 1,
              padding: '10px 4px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              background: activeTab === 'all' ? 'var(--color-primary)' : 'transparent',
              color: '#fff',
              transition: 'all 0.2s'
            }}
          >
            👥 Все профили ({allList.length})
          </button>
          <button 
            onClick={() => setActiveTab('pending')}
            style={{
              flex: 1,
              padding: '10px 4px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              background: activeTab === 'pending' ? 'var(--color-primary)' : 'transparent',
              color: '#fff',
              transition: 'all 0.2s'
            }}
          >
            ⏳ На проверке ({pending.length})
          </button>
          <button 
            onClick={() => setActiveTab('verified')}
            style={{
              flex: 1,
              padding: '10px 4px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              background: activeTab === 'verified' ? 'var(--color-primary)' : 'transparent',
              color: '#fff',
              transition: 'all 0.2s'
            }}
          >
            ✅ Подтверждены ({verifiedList.length})
          </button>
        </div>

        {/* List Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <RefreshCw size={30} className="spin" style={{ margin: 'auto', marginBottom: '10px' }} />
            Загрузка списка пользователей...
          </div>
        ) : activeTab === 'all' ? (
          /* TAB 1: ALL REGISTERED USERS */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {allList.length === 0 ? (
              <div className="glass-premium" style={{ padding: '30px', textAlign: 'center', borderRadius: '24px', color: 'var(--text-muted)' }}>
                Зарегистрированных пользователей пока нет.
              </div>
            ) : (
              allList.map((item, idx) => {
                const u = item.user;
                return (
                  <div key={idx} className="glass-premium" style={{ padding: '20px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img 
                        src={u.photos?.[0] ? (u.photos[0].startsWith('http') ? u.photos[0] : (API_URL + u.photos[0])) : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                        alt={u.name}
                        style={{ width: '55px', height: '55px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <h4 style={{ fontSize: '18px' }}>{u.name}, {u.age}</h4>
                          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '12px', background: u.isVerified ? 'rgba(0, 245, 212, 0.2)' : 'rgba(255, 183, 3, 0.2)', color: u.isVerified ? 'var(--color-accent)' : '#ffb703', fontWeight: '700' }}>
                            {u.isVerified ? '✅ Подтвержден' : '⏳ Не верифицирован'}
                          </span>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Рост: {u.height} см | Вес: {u.weight} кг {u.username ? `| @${u.username}` : ''}
                        </p>
                        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>
                          ID: {u.id} | Зарегистрирован: {new Date(item.registeredAt).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {!u.isVerified && (
                        <button 
                          onClick={() => handleApprove(u.id)}
                          className="btn"
                          style={{ flex: 1, padding: '8px 12px', fontSize: '12px', background: 'linear-gradient(135deg, var(--color-accent), #00b4d8)', color: '#0a0813' }}
                        >
                          <Check size={14} /> Подтвердить верификацию
                        </button>
                      )}

                      {u.isVerified && (
                        <button 
                          onClick={() => handleRevoke(u.id, u.name)}
                          className="btn btn-secondary"
                          style={{ flex: 1, padding: '8px 12px', fontSize: '12px', border: '1px solid rgba(255, 95, 95, 0.4)', color: '#ff5f5f' }}
                        >
                          <AlertTriangle size={14} /> Отозвать верификацию
                        </button>
                      )}

                      <button 
                        onClick={() => handleDeleteUser(u.id, u.name)}
                        className="btn btn-secondary"
                        style={{ padding: '8px 12px', fontSize: '12px', border: '1px solid rgba(255, 59, 48, 0.5)', color: '#ff3b30' }}
                        title="Удалить профиль"
                      >
                        <Trash2 size={14} /> Удалить
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : activeTab === 'pending' ? (
          /* TAB 2: PENDING VERIFICATION */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {pending.length === 0 ? (
              <div className="glass-premium" style={{ padding: '30px', textAlign: 'center', borderRadius: '24px', color: 'var(--text-muted)' }}>
                Неверифицированных анкет пока нет.
              </div>
            ) : (
              pending.map((item, idx) => {
                const u = item.user;
                const getPhotoUrl = (p) => p ? (p.startsWith('http') ? p : API_URL + p) : null;
                const scalePhotoUrl = getPhotoUrl(item.photo);
                const selfiePhotoUrl = getPhotoUrl(item.selfie);

                return (
                  <div key={idx} className="glass-premium" style={{ padding: '20px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img 
                        src={getPhotoUrl(u.photos?.[0]) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                        alt={u.name}
                        style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }}
                      />
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '18px' }}>{u.name}, {u.age}</h4>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Вес: <strong style={{ color: 'var(--color-accent)' }}>{item.claimedWeight} кг</strong> | Рост: {u.height} см {u.username ? `| @${u.username}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Photos Preview */}
                    {(scalePhotoUrl || selfiePhotoUrl) && (
                      <div style={{ display: 'grid', gridTemplateColumns: selfiePhotoUrl ? '1fr 1fr' : '1fr', gap: '10px' }}>
                        {scalePhotoUrl && (
                          <div style={{ position: 'relative' }}>
                            <img 
                              src={scalePhotoUrl} 
                              alt="Photo" 
                              style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '12px', cursor: 'pointer' }}
                              onClick={() => setPreviewPhoto(scalePhotoUrl)}
                            />
                            <span style={{ position: 'absolute', bottom: 5, left: 5, background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: '6px', fontSize: '10px' }}>
                              📸 Фото профиля / весов
                            </span>
                          </div>
                        )}
                        {selfiePhotoUrl && (
                          <div style={{ position: 'relative' }}>
                            <img 
                              src={selfiePhotoUrl} 
                              alt="Selfie" 
                              style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '12px', cursor: 'pointer' }}
                              onClick={() => setPreviewPhoto(selfiePhotoUrl)}
                            />
                            <span style={{ position: 'absolute', bottom: 5, left: 5, background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: '6px', fontSize: '10px' }}>
                              🤳 Селфи
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => handleReject(u.id)}
                        className="btn btn-secondary"
                        style={{ flex: 1, padding: '10px', fontSize: '13px', border: '1px solid rgba(255, 95, 95, 0.4)', color: '#ff5f5f' }}
                      >
                        <X size={16} /> Отклонить
                      </button>
                      <button 
                        onClick={() => handleApprove(u.id)}
                        className="btn"
                        style={{ flex: 2, padding: '10px', fontSize: '13px', background: 'linear-gradient(135deg, var(--color-accent), #00b4d8)', color: '#0a0813' }}
                      >
                        <Check size={16} /> Одобрить
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(u.id, u.name)}
                        className="btn btn-secondary"
                        style={{ padding: '10px 12px', fontSize: '13px', border: '1px solid rgba(255, 59, 48, 0.5)', color: '#ff3b30' }}
                        title="Удалить профиль"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* TAB 3: VERIFIED USERS */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {verifiedList.length === 0 ? (
              <div className="glass-premium" style={{ padding: '30px', textAlign: 'center', borderRadius: '24px', color: 'var(--text-muted)' }}>
                Подтвержденных пользователей пока нет.
              </div>
            ) : (
              verifiedList.map((item, idx) => {
                const u = item.user;
                return (
                  <div key={idx} className="glass-premium" style={{ padding: '20px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img 
                        src={u.photos?.[0] ? (u.photos[0].startsWith('http') ? u.photos[0] : (API_URL + u.photos[0])) : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                        alt={u.name}
                        style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-accent)' }}
                      />
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {u.name}, {u.age} <CheckCircle size={14} color="var(--color-accent)" />
                        </h4>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Подтвержденный вес: <strong style={{ color: 'var(--color-accent)' }}>{u.weight} кг</strong> | Рост: {u.height} см
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => handleRevoke(u.id, u.name)}
                        className="btn btn-secondary"
                        style={{ flex: 1, padding: '8px 12px', fontSize: '12px', border: '1px solid rgba(255, 95, 95, 0.4)', color: '#ff5f5f' }}
                      >
                        <AlertTriangle size={14} /> Отозвать верификацию
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(u.id, u.name)}
                        className="btn btn-secondary"
                        style={{ padding: '8px 12px', fontSize: '12px', border: '1px solid rgba(255, 59, 48, 0.5)', color: '#ff3b30' }}
                        title="Удалить профиль"
                      >
                        <Trash2 size={14} /> Удалить
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
