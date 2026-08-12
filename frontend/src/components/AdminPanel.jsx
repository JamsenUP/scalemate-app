import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, CheckCircle, Clock, Heart, Check, X, RefreshCw, AlertTriangle, Eye, Trash2, ShieldAlert, MessageSquare, UserX, Crown, Ban, AlertCircle, Star, Car, Home, Camera, MapPin, Ruler, Scale, DollarSign, Maximize2 } from 'lucide-react';
import ImageViewerModal from './ImageViewerModal';

export default function AdminPanel({ API_URL, tgUserId, onBack }) {
  const [stats, setStats] = useState(null);
  const [allList, setAllList] = useState([]);
  const [pending, setPending] = useState([]);
  const [verifiedList, setVerifiedList] = useState([]);
  const [reports, setReports] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // 'pending' | 'all' | 'verified' | 'reports'
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');

  // Full-screen photo viewer state
  const [viewingPhotos, setViewingPhotos] = useState(null); // { photos: [], index: 0 }

  const openFullscreen = (photoUrls, index = 0, e = null) => {
    if (e) e.stopPropagation();
    if (!photoUrls) return;
    const array = Array.isArray(photoUrls) ? photoUrls : [photoUrls];
    const fullUrls = array.map(p => getPhotoUrl(p)).filter(Boolean);
    if (fullUrls.length > 0) {
      setViewingPhotos({ photos: fullUrls, index });
    }
  };

  // Inspector User Modal (Requirement #3 & Full Read-Only Profile View)
  const [selectedUser, setSelectedUser] = useState(null);
  const [inspectorData, setInspectorData] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [profileSubTab, setProfileSubTab] = useState('info'); // 'info' | 'photos' | 'assets' | 'reviews' | 'chats'
  const [showBanInput, setShowBanInput] = useState(false);
  const [showWarnInput, setShowWarnInput] = useState(false);

  // Warning & Ban Form states
  const [warnReason, setWarnReason] = useState('');
  const [banReason, setBanReason] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const getAuthHeaders = () => {
    const headers = {};
    const tgInit = window.Telegram?.WebApp?.initData;
    const devId = localStorage.getItem('scalemate_dev_user_id') || tgUserId || 'scalemate_dating';
    if (tgInit) headers['x-tg-init-data'] = tgInit;
    headers['x-dev-user-id'] = devId;
    return headers;
  };

  const fetchAdminData = async () => {
    setLoading(true);
    const authHeaders = getAuthHeaders();

    try {
      const statsRes = await fetch(`${API_URL}/api/admin/stats`, { headers: authHeaders });
      if (statsRes.ok) {
        const d = await statsRes.json();
        setStats(d.stats);
      }
    } catch (e) { console.error('Stats fetch error:', e); }

    try {
      const allRes = await fetch(`${API_URL}/api/admin/all`, { headers: authHeaders });
      if (allRes.ok) {
        const d = await allRes.json();
        setAllList(d.allUsers || []);
      }
    } catch (e) { console.error('All users fetch error:', e); }

    try {
      const pendingRes = await fetch(`${API_URL}/api/admin/pending`, { headers: authHeaders });
      if (pendingRes.ok) {
        const d = await pendingRes.json();
        setPending(d.pending || []);
      }
    } catch (e) { console.error('Pending fetch error:', e); }

    try {
      const verifiedRes = await fetch(`${API_URL}/api/admin/verified`, { headers: authHeaders });
      if (verifiedRes.ok) {
        const d = await verifiedRes.json();
        setVerifiedList(d.verified || []);
      }
    } catch (e) { console.error('Verified fetch error:', e); }

    try {
      const reportsRes = await fetch(`${API_URL}/api/admin/reports`, { headers: authHeaders });
      if (reportsRes.ok) {
        const d = await reportsRes.json();
        setReports(d.reports || []);
      }
    } catch (e) { console.error('Reports fetch error:', e); }

    setLoading(false);
  };

  const handleInspectUser = async (u) => {
    setSelectedUser(u);
    setProfileSubTab('info');
    setShowBanInput(false);
    setShowWarnInput(false);
    setInspectLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/user/${u.id}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok) {
        setInspectorData(data);
        if (data.user) setSelectedUser(data.user);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setInspectLoading(false);
    }
  };

  const handleIssueWarning = async () => {
    if (!selectedUser || !warnReason.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/warn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userId: selectedUser.id, reason: warnReason })
      });
      if (res.ok) {
        setActionMessage('⚠️ Предупреждение вынесено!');
        setWarnReason('');
        setShowWarnInput(false);
        handleInspectUser(selectedUser);
        fetchAdminData();
      }
    } catch (e) { console.error(e); }
  };

  const handleBanUser = async () => {
    if (!selectedUser || !banReason.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userId: selectedUser.id, reason: banReason })
      });
      if (res.ok) {
        setActionMessage('⛔ Пользователь заблокирован!');
        setBanReason('');
        setShowBanInput(false);
        handleInspectUser(selectedUser);
        fetchAdminData();
      }
    } catch (e) { console.error(e); }
  };

  const handleUnbanUser = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/unban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        setActionMessage('✅ Пользователь разблокирован.');
        if (selectedUser) handleInspectUser(selectedUser);
        fetchAdminData();
      }
    } catch (e) { console.error(e); }
  };

  const handleToggleMod = async (userId, currentState) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/toggle-mod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userId, isAdmin: !currentState })
      });
      if (res.ok) {
        setActionMessage('👑 Права модератора обновлены.');
        if (selectedUser) handleInspectUser(selectedUser);
        fetchAdminData();
      }
    } catch (e) { console.error(e); }
  };

  const handleApprove = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userId })
      });
      if (response.ok) {
        setActionMessage('✅ Верификация одобрена!');
        if (selectedUser) handleInspectUser(selectedUser);
        fetchAdminData();
      }
    } catch (err) { console.error(err); }
  };

  const handleReject = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userId, reason: 'Отклонено модератором' })
      });
      if (response.ok) {
        setActionMessage('❌ Верификация отклонена.');
        if (selectedUser) handleInspectUser(selectedUser);
        fetchAdminData();
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteUser = async (userId, name) => {
    if (!window.confirm(`Вы действительно хотите удалить профиль ${name}?`)) return;
    try {
      const response = await fetch(`${API_URL}/api/admin/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userId })
      });
      if (response.ok) {
        setActionMessage('🗑 Пользователь удален.');
        setSelectedUser(null);
        fetchAdminData();
      }
    } catch (err) { console.error(err); }
  };

  const handleResolveReport = async (reportId, action) => {
    try {
      await fetch(`${API_URL}/api/admin/reports/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ reportId, action })
      });
      setActionMessage('Решение сохранено.');
      fetchAdminData();
    } catch (e) { console.error(e); }
  };

  const getPhotoUrl = (p) => {
    if (!p) return 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
    return p.startsWith('http') ? p : API_URL + p;
  };

  // Determine current active list
  let currentList = [];
  if (activeTab === 'pending') currentList = pending;
  else if (activeTab === 'all') currentList = allList;
  else if (activeTab === 'verified') currentList = verifiedList;

  return (
    <div className="screen-container">
      <div className="bg-mesh mesh-1"></div>
      <div className="bg-mesh mesh-2"></div>

      <div style={{ zIndex: 1, position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
          <div>
            <h2 style={{ fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck color="var(--color-accent)" size={24} /> Модерация
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Панель управления анкет и безопасности</p>
          </div>

          <button onClick={onBack} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '12px', borderRadius: '16px' }}>
            Назад в Профиль
          </button>
        </div>

        {actionMessage && (
          <div style={{ background: 'rgba(0, 245, 212, 0.15)', border: '1px solid rgba(0, 245, 212, 0.3)', color: '#00f5d4', padding: '10px 14px', borderRadius: '14px', fontSize: '13px', fontWeight: '600' }}>
            {actionMessage}
          </div>
        )}

        {/* Stats Grid */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
            <div className="glass" style={{ padding: '10px', borderRadius: '14px', textAlign: 'center' }}>
              <Users size={16} color="var(--color-primary)" style={{ margin: 'auto' }} />
              <div style={{ fontSize: '15px', fontWeight: '800' }}>{stats.totalUsers || allList.length}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Всего</div>
            </div>
            <div className="glass" style={{ padding: '10px', borderRadius: '14px', textAlign: 'center' }}>
              <Clock size={16} color="#ffd700" style={{ margin: 'auto' }} />
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#ffd700' }}>{pending.length}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Проверка</div>
            </div>
            <div className="glass" style={{ padding: '10px', borderRadius: '14px', textAlign: 'center' }}>
              <CheckCircle size={16} color="#00f5d4" style={{ margin: 'auto' }} />
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#00f5d4' }}>{verifiedList.length}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Одобрено</div>
            </div>
            <div className="glass" style={{ padding: '10px', borderRadius: '14px', textAlign: 'center' }}>
              <ShieldAlert size={16} color="#ff5f5f" style={{ margin: 'auto' }} />
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#ff5f5f' }}>{reports.length}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Жалобы</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '16px', gap: '4px', overflowX: 'auto' }}>
          <button onClick={() => setActiveTab('all')} style={{ flex: 1, padding: '8px 6px', borderRadius: '12px', border: 'none', background: activeTab === 'all' ? 'var(--color-primary)' : 'transparent', color: '#fff', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Все профили ({allList.length})
          </button>
          <button onClick={() => setActiveTab('pending')} style={{ flex: 1, padding: '8px 6px', borderRadius: '12px', border: 'none', background: activeTab === 'pending' ? 'var(--color-primary)' : 'transparent', color: '#fff', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Проверка ({pending.length})
          </button>
          <button onClick={() => setActiveTab('verified')} style={{ flex: 1, padding: '8px 6px', borderRadius: '12px', border: 'none', background: activeTab === 'verified' ? 'var(--color-secondary)' : 'transparent', color: '#fff', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Одобренные ({verifiedList.length})
          </button>
          <button onClick={() => setActiveTab('reports')} style={{ flex: 1, padding: '8px 6px', borderRadius: '12px', border: 'none', background: activeTab === 'reports' ? '#ff5f5f' : 'transparent', color: '#fff', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Жалобы ({reports.length})
          </button>
        </div>

        {/* List Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Загрузка модерации...</div>
        ) : activeTab === 'reports' ? (
          /* Reports Moderation List */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {reports.length === 0 ? (
              <div className="glass-premium" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', borderRadius: '20px' }}>
                <ShieldCheck size={32} color="#00f5d4" style={{ margin: 'auto', marginBottom: '8px' }} />
                Жалоб на отзывы нет. Все чисто!
              </div>
            ) : (
              reports.map(rep => (
                <div key={rep.id} className="glass-premium" style={{ padding: '14px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#ff5f5f', fontWeight: '700' }}>⚠️ Жалоба от пользователя #{rep.reporter_id}</div>
                  <div style={{ fontSize: '12px' }}><strong>Автор отзыва:</strong> {rep.reviewer_name}</div>
                  <div style={{ fontSize: '12px' }}><strong>Текст отзыва:</strong> "{rep.comment}"</div>
                  <div style={{ fontSize: '12px', color: '#ffd700' }}><strong>Причина жалобы:</strong> {rep.reason}</div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button onClick={() => handleResolveReport(rep.id, 'delete')} className="btn" style={{ padding: '6px 12px', fontSize: '11px', background: '#ff5f5f' }}>Удалить отзыв</button>
                    <button onClick={() => handleResolveReport(rep.id, 'dismiss')} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px' }}>Отклонить жалобу</button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Users Moderation List */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {currentList.length === 0 ? (
              <div className="glass-premium" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', borderRadius: '20px' }}>
                <Users size={32} style={{ margin: 'auto', marginBottom: '8px' }} />
                {activeTab === 'pending' ? (
                  <>
                    <p style={{ marginBottom: '10px' }}>Нет пользователей, ожидающих проверки.</p>
                    <button onClick={() => setActiveTab('all')} className="btn btn-accent" style={{ padding: '8px 14px', fontSize: '12px', margin: 'auto' }}>
                      Открыть Все Профили ({allList.length})
                    </button>
                  </>
                ) : 'Список пользователей пуст.'}
              </div>
            ) : (
              currentList.map(u => (
                <div 
                  key={u.id} 
                  className="glass-premium" 
                  onClick={() => handleInspectUser(u)} 
                  style={{ padding: '14px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <img src={getPhotoUrl(u.photos?.[0])} alt={u.name} style={{ width: '54px', height: '54px', borderRadius: '50%', objectFit: 'cover', border: u.isBanned ? '2px solid #ff5f5f' : '2px solid var(--color-primary)' }} />
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '15px' }}>{u.name}, {u.age}</strong>
                      {u.isBanned && <span style={{ fontSize: '10px', background: '#ff5f5f', color: '#fff', padding: '2px 6px', borderRadius: '10px' }}>БАН</span>}
                      {u.warningsCount > 0 && <span style={{ fontSize: '10px', background: '#ffd700', color: '#000', padding: '2px 6px', borderRadius: '10px' }}>⚠️ {u.warningsCount}/3</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      📍 {u.city || 'Москва'} | {u.gender === 'male' ? `💰 ${parseInt(u.income || 0).toLocaleString('ru-RU')} ₽` : `⚖️ ${u.weight} кг`}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleInspectUser(u)} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '12px', borderRadius: '12px', gap: '4px' }}>
                      <Eye size={14} /> Открыть
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* FULL READ-ONLY PROFILE VIEWER MODAL FOR MODERATION */}
      {selectedUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(14px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
          <div className="glass-premium" style={{ width: '100%', maxWidth: '440px', maxHeight: '94vh', overflowY: 'auto', borderRadius: '24px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Top Moderation Controls Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Просмотр анкети (Read-Only)
                </span>
                <h3 style={{ fontSize: '17px', margin: 0 }}>{selectedUser.name}, {selectedUser.age}</h3>
              </div>

              <button onClick={() => setSelectedUser(null)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '14px' }}>
                <X size={16} /> Закрыть
              </button>
            </div>

            {/* Moderation Status Badges */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', background: selectedUser.isBanned ? '#ff5f5f' : 'rgba(0, 245, 212, 0.2)', color: selectedUser.isBanned ? '#fff' : '#00f5d4', fontWeight: '700' }}>
                {selectedUser.isBanned ? `БАН: ${selectedUser.banReason}` : 'Статус: Активен'}
              </span>

              <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', background: 'rgba(255, 215, 0, 0.15)', color: '#ffd700', fontWeight: '700' }}>
                Предупреждений: {selectedUser.warningsCount || 0}/3
              </span>

              {selectedUser.isAdmin && (
                <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', background: 'var(--color-primary)', color: '#fff', fontWeight: '700' }}>
                  Модератор 👑
                </span>
              )}
            </div>

            {/* Moderation Actions Quick Tools */}
            <div className="glass" style={{ padding: '12px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Действия модератора:</div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selectedUser.verificationStatus === 'pending_moderation' && (
                  <>
                    <button onClick={() => handleApprove(selectedUser.id)} className="btn btn-accent" style={{ flex: 1, padding: '8px', fontSize: '11px', gap: '4px' }}>
                      <Check size={14} /> Одобрить
                    </button>
                    <button onClick={() => handleReject(selectedUser.id)} className="btn btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '11px', color: '#ff5f5f', gap: '4px' }}>
                      <X size={14} /> Отклонить
                    </button>
                  </>
                )}

                <button onClick={() => setShowWarnInput(!showWarnInput)} className="btn" style={{ flex: 1, padding: '8px', fontSize: '11px', background: '#ffd700', color: '#000', gap: '4px' }}>
                  <AlertTriangle size={14} /> Предупредить
                </button>

                {selectedUser.isBanned ? (
                  <button onClick={() => handleUnbanUser(selectedUser.id)} className="btn btn-accent" style={{ flex: 1, padding: '8px', fontSize: '11px', gap: '4px' }}>
                    <ShieldCheck size={14} /> Разбанить
                  </button>
                ) : (
                  <button onClick={() => setShowBanInput(!showBanInput)} className="btn" style={{ flex: 1, padding: '8px', fontSize: '11px', background: '#ff5f5f', color: '#fff', gap: '4px' }}>
                    <Ban size={14} /> Забанить
                  </button>
                )}

                <button onClick={() => handleToggleMod(selectedUser.id, selectedUser.isAdmin)} className="btn btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '11px', gap: '4px' }}>
                  <Crown size={14} /> {selectedUser.isAdmin ? 'Снять Мод' : '+Модератор'}
                </button>

                <button onClick={() => setProfileSubTab('chats')} className="btn btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '11px', gap: '4px' }}>
                  <MessageSquare size={14} /> Переписки ({inspectorData?.chatLogs?.length || 0})
                </button>
              </div>

              {showWarnInput && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <input type="text" placeholder="Причина предупреждения..." className="input-field" value={warnReason} onChange={e => setWarnReason(e.target.value)} style={{ padding: '6px 10px', fontSize: '12px' }} />
                  <button onClick={handleIssueWarning} className="btn" style={{ padding: '6px 12px', background: '#ffd700', color: '#000', fontSize: '11px' }}>Вынести</button>
                </div>
              )}

              {showBanInput && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <input type="text" placeholder="Причина бана..." className="input-field" value={banReason} onChange={e => setBanReason(e.target.value)} style={{ padding: '6px 10px', fontSize: '12px' }} />
                  <button onClick={handleBanUser} className="btn" style={{ padding: '6px 12px', background: '#ff5f5f', color: '#fff', fontSize: '11px' }}>Забанить</button>
                </div>
              )}
            </div>

            {/* EXACT AUTHENTIC USER PROFILE INTERFACE (READ-ONLY) */}
            <div className="glass-premium" style={{ padding: '20px', borderRadius: '20px', textAlign: 'center', position: 'relative' }}>
              
              <div style={{ position: 'relative', width: '90px', height: '90px', margin: 'auto', marginBottom: '12px' }}>
                <img 
                  src={getPhotoUrl(selectedUser.photos?.[0])} 
                  alt={selectedUser.name} 
                  style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-primary)' }}
                />
                {selectedUser.isVerified && (
                  <div style={{ position: 'absolute', bottom: '2px', right: '2px', background: 'var(--color-accent)', borderRadius: '50%', padding: '4px', display: 'flex', border: '2px solid #0a0813' }}>
                    <CheckCircle size={14} color="#000" />
                  </div>
                )}
              </div>

              <h2 style={{ fontSize: '20px', marginBottom: '2px' }}>{selectedUser.name}, {selectedUser.age}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '10px' }}>📍 {selectedUser.city || 'Москва'}</p>

              {/* Trust Score 0-100% Bar */}
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: '14px', maxWidth: '260px', margin: 'auto', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Рейтинг Доверия:</span>
                  <strong style={{ color: 'var(--color-accent)' }}>{selectedUser.trustScore || 85}%</strong>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${selectedUser.trustScore || 85}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))' }} />
                </div>
              </div>

              {/* Sub-Tabs: Info - Photos - Assets - Reviews - Chats */}
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '14px', gap: '3px', overflowX: 'auto' }}>
                <button onClick={() => setProfileSubTab('info')} style={{ flex: 1, padding: '6px 4px', borderRadius: '10px', border: 'none', background: profileSubTab === 'info' ? 'var(--color-primary)' : 'transparent', color: '#fff', fontSize: '10px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Инфо
                </button>
                <button onClick={() => setProfileSubTab('photos')} style={{ flex: 1, padding: '6px 4px', borderRadius: '10px', border: 'none', background: profileSubTab === 'photos' ? 'var(--color-primary)' : 'transparent', color: '#fff', fontSize: '10px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Галерея ({selectedUser.photos?.length || 0})
                </button>
                <button onClick={() => setProfileSubTab('assets')} style={{ flex: 1, padding: '6px 4px', borderRadius: '10px', border: 'none', background: profileSubTab === 'assets' ? 'var(--color-secondary)' : 'transparent', color: '#fff', fontSize: '10px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Имущество ({selectedUser.assets?.length || 0})
                </button>
                <button onClick={() => setProfileSubTab('reviews')} style={{ flex: 1, padding: '6px 4px', borderRadius: '10px', border: 'none', background: profileSubTab === 'reviews' ? 'var(--color-accent)' : 'transparent', color: profileSubTab === 'reviews' ? '#000' : '#fff', fontSize: '10px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Отзывы ({inspectorData?.reviews?.length || 0})
                </button>
                <button onClick={() => setProfileSubTab('chats')} style={{ flex: 1, padding: '6px 4px', borderRadius: '10px', border: 'none', background: profileSubTab === 'chats' ? '#ff5f5f' : 'transparent', color: '#fff', fontSize: '10px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Чаты ({inspectorData?.chatLogs?.length || 0})
                </button>
              </div>

            </div>

            {/* Sub-Tab 1: Profile Parameters & Info */}
            {profileSubTab === 'info' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="glass" style={{ padding: '10px', borderRadius: '12px', fontSize: '12px' }}>
                    📏 <strong>Рост:</strong> {selectedUser.height} см
                  </div>
                  {selectedUser.gender === 'female' ? (
                    <div className="glass" style={{ padding: '10px', borderRadius: '12px', fontSize: '12px' }}>
                      ⚖️ <strong>Вес:</strong> {selectedUser.weight} кг
                    </div>
                  ) : (
                    <div className="glass" style={{ padding: '10px', borderRadius: '12px', fontSize: '12px' }}>
                      💰 <strong>Доход:</strong> {parseInt(selectedUser.income || 0).toLocaleString('ru-RU')} ₽
                    </div>
                  )}
                </div>

                <div className="glass" style={{ padding: '12px', borderRadius: '12px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>О себе:</span>
                  <p style={{ fontSize: '13px', lineHeight: '1.4', margin: 0 }}>{selectedUser.bio || 'Описание не указано.'}</p>
                </div>

                {/* Uploaded Verification Screenshots */}
                {(selectedUser.verificationPhoto || selectedUser.verificationSelfie) && (
                  <div className="glass" style={{ padding: '12px', borderRadius: '12px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                      📸 Фото проверки верификации (нажмите для просмотра на весь экран):
                    </span>
                    <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
                      {selectedUser.verificationPhoto && (
                        <div 
                          onClick={(e) => openFullscreen([selectedUser.verificationPhoto, selectedUser.verificationSelfie].filter(Boolean), 0, e)}
                          style={{ cursor: 'pointer', position: 'relative' }}
                        >
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '2px' }}>Загруженное фото 🔍</div>
                          <img src={getPhotoUrl(selectedUser.verificationPhoto)} alt="Верификация" style={{ width: '90px', height: '90px', borderRadius: '12px', objectFit: 'cover', border: '2px solid var(--color-accent)' }} />
                        </div>
                      )}
                      {selectedUser.verificationSelfie && (
                        <div 
                          onClick={(e) => openFullscreen([selectedUser.verificationPhoto, selectedUser.verificationSelfie].filter(Boolean), selectedUser.verificationPhoto ? 1 : 0, e)}
                          style={{ cursor: 'pointer', position: 'relative' }}
                        >
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '2px' }}>Камера / Селфи 🔍</div>
                          <img src={getPhotoUrl(selectedUser.verificationSelfie)} alt="Селфи" style={{ width: '90px', height: '90px', borderRadius: '12px', objectFit: 'cover', border: '2px solid var(--color-primary)' }} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sub-Tab 2: User Photo Gallery */}
            {profileSubTab === 'photos' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {selectedUser.photos?.map((photoUrl, idx) => (
                  <div 
                    key={idx} 
                    className="glass" 
                    onClick={(e) => openFullscreen(selectedUser.photos, idx, e)}
                    style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', height: '140px', cursor: 'pointer' }}
                  >
                    <img src={getPhotoUrl(photoUrl)} alt={`Фото ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s', ':hover': { opacity: 1 } }}>
                      <Maximize2 size={24} color="#fff" />
                    </div>
                    {idx === 0 && (
                      <span style={{ position: 'absolute', top: '6px', left: '6px', fontSize: '9px', background: 'var(--color-primary)', color: '#fff', padding: '2px 6px', borderRadius: '8px', fontWeight: '700' }}>
                        ★ Главная
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Sub-Tab 3: Assets Showcase */}
            {profileSubTab === 'assets' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(!selectedUser.assets || selectedUser.assets.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    У пользователя нет добавленных активов.
                  </div>
                ) : (
                  selectedUser.assets.map(item => (
                    <div key={item.id} className="glass" style={{ padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: item.type === 'car' ? 'rgba(0, 245, 212, 0.15)' : 'rgba(168, 85, 247, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.type === 'car' ? <Car size={16} color="#00f5d4" /> : <Home size={16} color="#a855f7" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: '13px' }}>{item.title}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--color-accent)' }}>~{parseInt(item.price || 0).toLocaleString('ru-RU')} ₽</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Sub-Tab 4: Avito-style Reviews */}
            {profileSubTab === 'reviews' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(!inspectorData?.reviews || inspectorData.reviews.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    У пользователя пока нет отзывов.
                  </div>
                ) : (
                  inspectorData.reviews.map(r => (
                    <div key={r.id} className="glass" style={{ padding: '10px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '12px' }}>{r.reviewer_name}</strong>
                        <div style={{ display: 'flex', color: '#ffd700', gap: '2px' }}>
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} size={10} fill={i < r.rating ? '#ffd700' : 'transparent'} color="#ffd700" />
                          ))}
                        </div>
                      </div>
                      <p style={{ fontSize: '12px', margin: 0, color: 'rgba(255,255,255,0.9)' }}>{r.comment}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Sub-Tab 5: Full Chat Inspector Timeline */}
            {profileSubTab === 'chats' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(!inspectorData?.chatLogs || inspectorData.chatLogs.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    У пользователя нет активных переписок.
                  </div>
                ) : (
                  inspectorData.chatLogs.map(log => (
                    <div key={log.chatId} className="glass" style={{ padding: '10px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontWeight: '700', fontSize: '12px', color: 'var(--color-accent)' }}>
                        💬 Диалог с {log.partner?.name || 'Партнёром'} (ID: {log.partner?.id})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                        {log.messages.map((m, i) => {
                          const isSender = String(m.senderId) === String(selectedUser.id);
                          return (
                            <div key={i} style={{ alignSelf: isSender ? 'flex-end' : 'flex-start', background: isSender ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '8px', fontSize: '11px', maxWidth: '85%' }}>
                              {m.text}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Delete Profile Dangerous Button */}
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <button onClick={() => handleDeleteUser(selectedUser.id, selectedUser.name)} className="btn" style={{ width: '100%', padding: '10px', background: '#ff5f5f', fontSize: '12px', gap: '6px' }}>
                <Trash2 size={14} /> Полностью удалить профиль
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Full-Screen Photo Viewer */}
      {viewingPhotos && (
        <ImageViewerModal
          photos={viewingPhotos.photos}
          initialIndex={viewingPhotos.index}
          onClose={() => setViewingPhotos(null)}
        />
      )}

    </div>
  );
}
