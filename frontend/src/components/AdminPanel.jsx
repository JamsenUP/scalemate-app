import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, CheckCircle, Clock, Heart, Check, X, RefreshCw, AlertTriangle, Eye, Trash2, ShieldAlert, MessageSquare, UserX, Crown, Ban, AlertCircle } from 'lucide-react';

export default function AdminPanel({ API_URL, tgUserId, onBack }) {
  const [stats, setStats] = useState(null);
  const [allList, setAllList] = useState([]);
  const [pending, setPending] = useState([]);
  const [verifiedList, setVerifiedList] = useState([]);
  const [reports, setReports] = useState([]);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'all' | 'verified' | 'reports'
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // Inspector User Modal (Requirement #3)
  const [selectedUser, setSelectedUser] = useState(null);
  const [inspectorData, setInspectorData] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Warning & Ban Form states
  const [warnReason, setWarnReason] = useState('');
  const [banReason, setBanReason] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const getAuthHeaders = () => {
    const headers = {};
    const tgInit = window.Telegram?.WebApp?.initData;
    if (tgInit) headers['x-tg-init-data'] = tgInit;
    else if (tgUserId) headers['x-dev-user-id'] = tgUserId;
    return headers;
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const authHeaders = getAuthHeaders();
      const [statsRes, allRes, pendingRes, verifiedRes, reportsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`, { headers: authHeaders }),
        fetch(`${API_URL}/api/admin/all`, { headers: authHeaders }),
        fetch(`${API_URL}/api/admin/pending`, { headers: authHeaders }),
        fetch(`${API_URL}/api/admin/verified`, { headers: authHeaders }),
        fetch(`${API_URL}/api/admin/reports`, { headers: authHeaders })
      ]);

      const statsData = await statsRes.json();
      const allData = await allRes.json();
      const pendingData = await pendingRes.json();
      const verifiedData = await verifiedRes.json();
      const reportsData = await reportsRes.json();

      if (statsRes.ok) setStats(statsData.stats);
      if (allRes.ok) setAllList(allData.allUsers || []);
      if (pendingRes.ok) setPending(pendingData.pending || []);
      if (verifiedRes.ok) setVerifiedList(verifiedData.verified || []);
      if (reportsRes.ok) setReports(reportsData.reports || []);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInspectUser = async (u) => {
    setSelectedUser(u);
    setInspectLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/user/${u.id}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok) setInspectorData(data);
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
        setTimeout(() => setActionMessage(''), 3000);
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
        setTimeout(() => setActionMessage(''), 3000);
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
        setTimeout(() => setActionMessage(''), 3000);
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
              <div style={{ fontSize: '15px', fontWeight: '800' }}>{stats.totalUsers}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Всего</div>
            </div>
            <div className="glass" style={{ padding: '10px', borderRadius: '14px', textAlign: 'center' }}>
              <Clock size={16} color="#ffd700" style={{ margin: 'auto' }} />
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#ffd700' }}>{stats.pendingUsers}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Проверка</div>
            </div>
            <div className="glass" style={{ padding: '10px', borderRadius: '14px', textAlign: 'center' }}>
              <CheckCircle size={16} color="#00f5d4" style={{ margin: 'auto' }} />
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#00f5d4' }}>{stats.verifiedUsers}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Одобрено</div>
            </div>
            <div className="glass" style={{ padding: '10px', borderRadius: '14px', textAlign: 'center' }}>
              <Ban size={16} color="#ff5f5f" style={{ margin: 'auto' }} />
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#ff5f5f' }}>{stats.bannedUsers || 0}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Баны</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '16px', gap: '4px' }}>
          <button onClick={() => setActiveTab('pending')} style={{ flex: 1, padding: '8px', borderRadius: '12px', border: 'none', background: activeTab === 'pending' ? 'var(--color-primary)' : 'transparent', color: '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
            На проверке ({pending.length})
          </button>
          <button onClick={() => setActiveTab('all')} style={{ flex: 1, padding: '8px', borderRadius: '12px', border: 'none', background: activeTab === 'all' ? 'var(--color-secondary)' : 'transparent', color: '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
            Все ({allList.length})
          </button>
          <button onClick={() => setActiveTab('reports')} style={{ flex: 1, padding: '8px', borderRadius: '12px', border: 'none', background: activeTab === 'reports' ? '#ff5f5f' : 'transparent', color: '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
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
              <div className="glass" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Жалоб нет</div>
            ) : (
              reports.map(rep => (
                <div key={rep.id} className="glass-premium" style={{ padding: '14px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#ff5f5f', fontWeight: '700' }}>⚠️ Жалоба на отзыв от {rep.reviewer_name}</div>
                  <div style={{ fontSize: '12px' }}><strong>Отзыв:</strong> "{rep.comment}"</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}><strong>Причина жалобы:</strong> {rep.reason}</div>
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
            {(activeTab === 'pending' ? pending : allList).map(u => (
              <div key={u.id} className="glass-premium" style={{ padding: '14px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src={getPhotoUrl(u.photos?.[0])} alt={u.name} style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', border: u.isBanned ? '2px solid #ff5f5f' : '2px solid var(--color-primary)' }} />
                
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

                <div style={{ display: 'flex', gap: '6px' }}>
                  {/* Detailed Inspect Modal Button */}
                  <button onClick={() => handleInspectUser(u)} className="btn btn-secondary" style={{ padding: '8px', borderRadius: '12px' }} title="Инспектор">
                    <Eye size={16} />
                  </button>

                  {u.verificationStatus === 'pending_moderation' && (
                    <>
                      <button onClick={() => handleApprove(u.id)} className="btn btn-accent" style={{ padding: '8px', borderRadius: '12px' }} title="Одобрить">
                        <Check size={16} />
                      </button>
                      <button onClick={() => handleReject(u.id)} className="btn btn-secondary" style={{ padding: '8px', borderRadius: '12px', color: '#ff5f5f' }} title="Отклонить">
                        <X size={16} />
                      </button>
                    </>
                  )}

                  <button onClick={() => handleDeleteUser(u.id, u.name)} className="btn btn-secondary" style={{ padding: '8px', borderRadius: '12px', color: '#ff5f5f' }} title="Удалить">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Detailed Admin User Inspector Modal (Requirement #3) */}
      {selectedUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-premium" style={{ width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px' }}>Инспектор: {selectedUser.name}</h3>
              <button onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={22} /></button>
            </div>

            {inspectLoading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Загрузка чатов и файлов...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {/* Status Badges */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '10px', background: selectedUser.isBanned ? '#ff5f5f' : '#00f5d4', color: '#000', fontWeight: '700' }}>
                    {selectedUser.isBanned ? `БАН: ${selectedUser.banReason}` : 'Активен'}
                  </span>
                  <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '10px', background: 'rgba(255, 215, 0, 0.2)', color: '#ffd700', fontWeight: '700' }}>
                    Предупреждений: {selectedUser.warningsCount || 0}/3
                  </span>
                  {selectedUser.isAdmin && <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '10px', background: 'var(--color-primary)', color: '#fff' }}>Модератор 👑</span>}
                </div>

                {/* Uploaded Verification Photos & Live Selfies */}
                <div>
                  <h4 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>Загруженные фото верификации</h4>
                  <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
                    {selectedUser.verificationPhoto && (
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Фото верификации</div>
                        <img src={getPhotoUrl(selectedUser.verificationPhoto)} alt="Верификация" style={{ width: '90px', height: '90px', borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--color-accent)' }} />
                      </div>
                    )}
                    {selectedUser.verificationSelfie && (
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Камера / Селфи</div>
                        <img src={getPhotoUrl(selectedUser.verificationSelfie)} alt="Селфи" style={{ width: '90px', height: '90px', borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--color-primary)' }} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Warning Action Box (Requirement #3) */}
                <div className="glass" style={{ padding: '12px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ fontSize: '13px', color: '#ffd700' }}>⚠️ Вынести предупреждение</h4>
                  <input type="text" placeholder="Причина (например: Неправдивое фото)" className="input-field" value={warnReason} onChange={e => setWarnReason(e.target.value)} style={{ padding: '8px 12px', fontSize: '12px' }} />
                  <button onClick={handleIssueWarning} className="btn" style={{ padding: '8px', fontSize: '12px', background: '#ffd700', color: '#000' }}>
                    Вынести предупреждение ({selectedUser.warningsCount || 0}/3)
                  </button>
                </div>

                {/* Ban Action Box (Requirement #3) */}
                <div className="glass" style={{ padding: '12px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ fontSize: '13px', color: '#ff5f5f' }}>⛔ Заблокировать / Разблокировать</h4>
                  {selectedUser.isBanned ? (
                    <button onClick={() => handleUnbanUser(selectedUser.id)} className="btn btn-accent" style={{ padding: '8px', fontSize: '12px' }}>
                      Снять Бан
                    </button>
                  ) : (
                    <>
                      <input type="text" placeholder="Причина бана" className="input-field" value={banReason} onChange={e => setBanReason(e.target.value)} style={{ padding: '8px 12px', fontSize: '12px' }} />
                      <button onClick={handleBanUser} className="btn" style={{ padding: '8px', fontSize: '12px', background: '#ff5f5f' }}>
                        Заблокировать пользователя
                      </button>
                    </>
                  )}
                </div>

                {/* Toggle Moderator Role */}
                <button onClick={() => handleToggleMod(selectedUser.id, selectedUser.isAdmin)} className="btn btn-secondary" style={{ padding: '10px', fontSize: '12px' }}>
                  {selectedUser.isAdmin ? 'Снять роль Модератора' : 'Сделать Модератором 👑'}
                </button>

                {/* Chat Log Inspector (Requirement #3) */}
                <div>
                  <h4 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    История сообщений в чатах ({inspectorData?.chatLogs?.length || 0})
                  </h4>
                  {(!inspectorData?.chatLogs || inspectorData.chatLogs.length === 0) ? (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Нет сообщений.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                      {inspectorData.chatLogs.map(log => (
                        <div key={log.chatId} className="glass" style={{ padding: '10px', borderRadius: '12px', fontSize: '11px' }}>
                          <div style={{ fontWeight: '700', marginBottom: '4px' }}>Чат с {log.partner?.name || 'Пользователем'}</div>
                          {log.messages.map((m, i) => (
                            <div key={i} style={{ color: String(m.senderId) === String(selectedUser.id) ? 'var(--color-accent)' : '#fff' }}>
                              {m.text}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
