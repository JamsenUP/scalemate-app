import React, { useState, useEffect } from 'react';
import { User, Calendar, Ruler, Scale, DollarSign, ShieldCheck, AlertCircle, Edit3, Camera, CheckCircle2, Lock, Eye, LogOut, MapPin, Star, Car, Home, Plus, ShieldAlert, Award, MessageCircle } from 'lucide-react';
import { getRussianErrorMessage } from '../utils/errorHandler';
import { POPULAR_SETTLEMENTS } from '../utils/cities';

export default function Profile({ user, onReVerify, onResetProfile, onOpenAdmin, onOpenHistory, onOpenFaceCheck, onUpdateUser, API_URL, tgUserId }) {
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'assets' | 'reviews'
  const [isEditing, setIsEditing] = useState(false);
  const [reviews, setReviews] = useState([]);
  
  // Edit Form State
  const [formData, setFormData] = useState({
    name: user.name || '',
    age: user.age || '',
    height: user.height || '',
    weight: user.weight || '',
    income: user.income || 0,
    city: user.city || 'Москва',
    bio: user.bio || ''
  });

  // Assets Form State
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [assetType, setAssetType] = useState('car'); // 'car' | 'estate'
  const [assetTitle, setAssetTitle] = useState('');
  const [assetPrice, setAssetPrice] = useState('');
  const [assetPhoto, setAssetPhoto] = useState(null);

  // Review Report Modal
  const [reportReviewId, setReportReviewId] = useState(null);
  const [reportReason, setReportReason] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchReviews();
  }, [user.id]);

  const getAuthHeaders = () => {
    const headers = {};
    const tgInit = window.Telegram?.WebApp?.initData;
    if (tgInit) headers['x-tg-init-data'] = tgInit;
    else headers['x-dev-user-id'] = tgUserId;
    return headers;
  };

  const fetchReviews = async () => {
    try {
      const response = await fetch(`${API_URL}/api/reviews/${user.id}`, { headers: getAuthHeaders() });
      const result = await response.json();
      if (response.ok) setReviews(result.reviews || []);
    } catch (e) { console.error(e); }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/profile/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          name: formData.name,
          age: parseInt(formData.age),
          height: parseInt(formData.height),
          weight: parseFloat(formData.weight),
          income: parseInt(formData.income),
          city: formData.city.trim(),
          bio: formData.bio
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Ошибка сохранения');

      onUpdateUser(result.user);
      setIsEditing(false);
    } catch (err) {
      setError(getRussianErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAddAsset = async (e) => {
    e.preventDefault();
    if (!assetTitle || !assetPrice) return;

    const newAsset = {
      id: Date.now(),
      type: assetType,
      title: assetTitle,
      price: parseInt(assetPrice)
    };

    const updatedAssets = [...(user.assets || []), newAsset];
    try {
      const response = await fetch(`${API_URL}/api/assets/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ assets: updatedAssets })
      });
      const result = await response.json();
      if (response.ok) {
        onUpdateUser(result.user);
        setShowAssetModal(false);
        setAssetTitle('');
        setAssetPrice('');
      }
    } catch (e) { console.error(e); }
  };

  const handleReportReview = async (e) => {
    e.preventDefault();
    if (!reportReviewId || !reportReason) return;

    try {
      await fetch(`${API_URL}/api/reviews/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ reviewId: reportReviewId, reason: reportReason })
      });
      alert('Жалоба отправлена модераторам на рассмотрение!');
      setReportReviewId(null);
      setReportReason('');
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
        
        {/* Header Profile Section */}
        <div className="glass-premium" style={{ padding: '24px', borderRadius: '24px', textAlign: 'center', position: 'relative' }}>
          
          <div style={{ position: 'relative', width: '100px', height: '100px', margin: 'auto', marginBottom: '14px' }}>
            <img 
              src={getPhotoUrl(user.photos?.[0])} 
              alt={user.name} 
              style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-primary)' }}
            />
            {user.isVerified && (
              <div style={{ position: 'absolute', bottom: '2px', right: '2px', background: 'var(--color-accent)', borderRadius: '50%', padding: '4px', display: 'flex', border: '2px solid #0a0813' }}>
                <CheckCircle2 size={16} color="#000" />
              </div>
            )}
          </div>

          <h2 style={{ fontSize: '22px', marginBottom: '4px' }}>{user.name}, {user.age}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>📍 {user.city || 'Москва'}</p>

          {/* Trust Score 0-100% Bar */}
          <div style={{ background: 'rgba(255,255,255,0.04)', padding: '10px 14px', borderRadius: '16px', maxWidth: '280px', margin: 'auto', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Рейтинг Доверия:</span>
              <strong style={{ color: 'var(--color-accent)' }}>{user.trustScore || 85}%</strong>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${user.trustScore || 85}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))' }} />
            </div>
          </div>

          {/* Sub-Tabs: Info - Assets - Reviews */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '16px', gap: '4px' }}>
            <button onClick={() => setActiveTab('info')} style={{ flex: 1, padding: '8px', borderRadius: '12px', border: 'none', background: activeTab === 'info' ? 'var(--color-primary)' : 'transparent', color: '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
              Инфо
            </button>
            <button onClick={() => setActiveTab('assets')} style={{ flex: 1, padding: '8px', borderRadius: '12px', border: 'none', background: activeTab === 'assets' ? 'var(--color-secondary)' : 'transparent', color: '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
              Имущество
            </button>
            <button onClick={() => setActiveTab('reviews')} style={{ flex: 1, padding: '8px', borderRadius: '12px', border: 'none', background: activeTab === 'reviews' ? 'var(--color-accent)' : 'transparent', color: activeTab === 'reviews' ? '#000' : '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
              Отзывы ({reviews.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Profile Info & Parameters */}
        {activeTab === 'info' && (
          <div className="glass-premium" style={{ padding: '20px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px' }}>Профильные данные</h3>
              <button onClick={() => setIsEditing(!isEditing)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '16px', gap: '4px' }}>
                <Edit3 size={14} /> {isEditing ? 'Отмена' : 'Редактировать'}
              </button>
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                {error && <div style={{ color: '#ff5f5f', fontSize: '12px' }}>⚠️ {error}</div>}

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <span className="input-label">Имя (только имя)</span>
                  <input type="text" className="input-field" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} required />
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <span className="input-label">Населенный пункт</span>
                  <input 
                    type="text"
                    list="profile-settlements-datalist"
                    placeholder="Введите населенный пункт..."
                    className="input-field" 
                    value={formData.city} 
                    onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))} 
                    required 
                  />
                  <datalist id="profile-settlements-datalist">
                    {POPULAR_SETTLEMENTS.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
                  <div className="input-group" style={{ marginBottom: 0, minWidth: 0 }}>
                    <span className="input-label">Возраст</span>
                    <input type="number" className="input-field" value={formData.age} onChange={e => setFormData(prev => ({ ...prev, age: e.target.value }))} required />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0, minWidth: 0 }}>
                    <span className="input-label">Рост (см)</span>
                    <input type="number" className="input-field" value={formData.height} onChange={e => setFormData(prev => ({ ...prev, height: e.target.value }))} required />
                  </div>
                </div>

                {user.gender === 'female' ? (
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <span className="input-label">Вес (кг)</span>
                    <input type="number" className="input-field" value={formData.weight} onChange={e => setFormData(prev => ({ ...prev, weight: e.target.value }))} required />
                  </div>
                ) : (
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <span className="input-label">Доход (₽/мес)</span>
                    <input type="number" className="input-field" value={formData.income} onChange={e => setFormData(prev => ({ ...prev, income: e.target.value }))} required />
                  </div>
                )}

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <span className="input-label">О себе</span>
                  <textarea className="input-field" rows={2} value={formData.bio} onChange={e => setFormData(prev => ({ ...prev, bio: e.target.value }))} style={{ resize: 'none' }} />
                </div>

                <button type="submit" className="btn btn-accent" disabled={loading} style={{ padding: '12px', borderRadius: '12px' }}>
                  {loading ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
                  <div className="glass" style={{ padding: '12px', borderRadius: '14px', fontSize: '13px', minWidth: 0 }}>
                    📏 <strong>Рост:</strong> {user.height} см
                  </div>
                  {user.gender === 'female' ? (
                    <div className="glass" style={{ padding: '12px', borderRadius: '14px', fontSize: '13px', minWidth: 0 }}>
                      ⚖️ <strong>Вес:</strong> {user.weight} кг
                    </div>
                  ) : (
                    <div className="glass" style={{ padding: '12px', borderRadius: '14px', fontSize: '13px', minWidth: 0 }}>
                      💰 <strong>Доход:</strong> {parseInt(user.income || 0).toLocaleString('ru-RU')} ₽
                    </div>
                  )}
                </div>

                <div className="glass" style={{ padding: '14px', borderRadius: '14px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>О себе:</span>
                  <p style={{ fontSize: '14px', lineHeight: '1.4' }}>{user.bio || 'Описание не указано.'}</p>
                </div>
              </div>
            )}

            {/* Quick Action Navigation Buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
              <button onClick={onOpenHistory} className="btn btn-secondary" style={{ flex: 1, padding: '10px', fontSize: '12px', borderRadius: '12px' }}>
                <Eye size={14} /> История свайпов
              </button>
              
              <button onClick={onOpenFaceCheck} className="btn btn-secondary" style={{ flex: 1, padding: '10px', fontSize: '12px', borderRadius: '12px' }}>
                <Camera size={14} /> Biometric FaceCheck
              </button>

              {(user.isAdmin || user.name === 'admin') && (
                <button onClick={onOpenAdmin} className="btn btn-accent" style={{ width: '100%', padding: '12px', fontSize: '13px', borderRadius: '12px', gap: '6px' }}>
                  <ShieldCheck size={16} /> Панель Модерации
                </button>
              )}
            </div>

          </div>
        )}

        {/* Tab 2: Assets Showcase (Cars & Real Estate) */}
        {activeTab === 'assets' && (
          <div className="glass-premium" style={{ padding: '20px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px' }}>Недвижимость и Автомобили 🏎️</h3>
              <button onClick={() => setShowAssetModal(true)} className="btn btn-accent" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '16px', gap: '4px' }}>
                <Plus size={14} /> Добавить
              </button>
            </div>

            {(!user.assets || user.assets.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
                У вас пока нет добавленных активов. Нажмите «Добавить», чтобы показать ваши автомобили или недвижимость!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {user.assets.map((item) => (
                  <div key={item.id} className="glass" style={{ padding: '14px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: item.type === 'car' ? 'rgba(0, 245, 212, 0.15)' : 'rgba(168, 85, 247, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.type === 'car' ? <Car size={20} color="#00f5d4" /> : <Home size={20} color="#a855f7" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: '15px' }}>{item.title}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--color-accent)', marginTop: '2px' }}>
                        ~{parseInt(item.price || 0).toLocaleString('ru-RU')} ₽
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Avito-style User Reviews */}
        {activeTab === 'reviews' && (
          <div className="glass-premium" style={{ padding: '20px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '16px' }}>Отзывы пользователей ⭐</h3>

            {reviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
                Пока никто не оставил отзыв. Отзывы могут оставлять только пользователи, с которыми вы общались в чате!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {reviews.map(r => (
                  <div key={r.id} className="glass" style={{ padding: '14px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={getPhotoUrl(r.reviewer_photo)} alt={r.reviewer_name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                        <strong style={{ fontSize: '14px' }}>{r.reviewer_name}</strong>
                      </div>
                      
                      <div style={{ display: 'flex', color: '#ffd700', gap: '2px' }}>
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={12} fill={i < r.rating ? '#ffd700' : 'transparent'} color="#ffd700" />
                        ))}
                      </div>
                    </div>

                    <p style={{ fontSize: '13px', lineHeight: '1.4', color: 'rgba(255,255,255,0.9)' }}>{r.comment}</p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString('ru-RU')}</span>
                      <button onClick={() => setReportReviewId(r.id)} style={{ background: 'none', border: 'none', color: '#ff5f5f', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ShieldAlert size={12} /> Пожаловаться
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Add Asset Modal */}
      {showAssetModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-premium" style={{ width: '100%', maxWidth: '360px', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '18px' }}>Добавить Имущество</h3>
            
            <form onSubmit={handleAddAsset} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="input-group">
                <span className="input-label">Тип</span>
                <select className="input-field" value={assetType} onChange={e => setAssetType(e.target.value)}>
                  <option value="car">🏎️ Автомобиль</option>
                  <option value="estate">🏠 Недвижимость</option>
                </select>
              </div>

              <div className="input-group">
                <span className="input-label">Название / Модель *</span>
                <input type="text" placeholder="например: BMW M5 или Квартира 100м²" className="input-field" value={assetTitle} onChange={e => setAssetTitle(e.target.value)} required />
              </div>

              <div className="input-group">
                <span className="input-label">Примерная стоимость (₽) *</span>
                <input type="number" placeholder="5000000" className="input-field" value={assetPrice} onChange={e => setAssetPrice(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowAssetModal(false)} className="btn btn-secondary" style={{ flex: 1, padding: '12px' }}>Отмена</button>
                <button type="submit" className="btn btn-accent" style={{ flex: 1, padding: '12px' }}>Добавить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Review Modal */}
      {reportReviewId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-premium" style={{ width: '100%', maxWidth: '360px', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '18px', color: '#ff5f5f' }}>Жалоба на отзыв</h3>
            
            <form onSubmit={handleReportReview} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="input-group">
                <span className="input-label">Причина жалобы *</span>
                <textarea placeholder="Опишите, почему данный отзыв не соответствует действительности..." className="input-field" style={{ minHeight: '80px', resize: 'none' }} value={reportReason} onChange={e => setReportReason(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setReportReviewId(null)} className="btn btn-secondary" style={{ flex: 1, padding: '12px' }}>Отмена</button>
                <button type="submit" className="btn" style={{ flex: 1, padding: '12px', background: '#ff5f5f' }}>Отправить</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
