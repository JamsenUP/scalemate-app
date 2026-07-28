import React, { useState } from 'react';
import { Scale, Ruler, CheckCircle2, ShieldAlert, AlertCircle, LogOut, Edit3, Camera, Save, X } from 'lucide-react';

export default function Profile({ user, onReVerify, onResetProfile, onOpenAdmin, onOpenHistory, onOpenFaceCheck, onUpdateUser, API_URL }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user.name || '',
    age: user.age || '',
    height: user.height || '',
    bio: user.bio || '',
    preferredGender: user.preferredGender || 'male'
  });
  const [photoFiles, setPhotoFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Determine BMI Category and Color
  const getBmiDetails = (bmi) => {
    if (!bmi) return { label: 'Нет данных', color: '#9f9cb0' };
    if (bmi < 18.5) return { label: 'Дефицит массы тела', color: '#00f5d4' };
    if (bmi >= 18.5 && bmi < 25) return { label: 'Нормальный вес', color: '#00f5d4' };
    if (bmi >= 25 && bmi < 30) return { label: 'Избыточный вес', color: '#ffb703' };
    return { label: 'Ожирение', color: '#ff5f5f' };
  };

  const bmiDetails = getBmiDetails(user.bmi);

  const getAuthHeaders = () => {
    const headers = {};
    const tgInit = window.Telegram?.WebApp?.initData;
    if (tgInit) {
      headers['x-tg-init-data'] = tgInit;
    }
    return headers;
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('age', formData.age);
      data.append('height', formData.height);
      data.append('bio', formData.bio);
      data.append('preferredGender', formData.preferredGender);

      if (photoFiles.length > 0) {
        photoFiles.forEach(file => data.append('photos', file));
      }

      const response = await fetch(`${API_URL}/api/profile/edit`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: data
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Не удалось сохранить профиль');
      }

      if (onUpdateUser && result.user) {
        onUpdateUser(result.user);
      }
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen-container" style={{ paddingBottom: '90px' }}>
      <div className="bg-mesh mesh-1"></div>
      <div className="bg-mesh mesh-2"></div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-premium" style={{ width: '100%', maxWidth: '380px', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 color="var(--color-primary)" size={18} /> Редактировать Профиль
              </h3>
              <button onClick={() => setIsEditing(false)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                <X size={16} />
              </button>
            </div>

            {error && (
              <div style={{ background: 'rgba(255, 95, 95, 0.1)', color: '#ff5f5f', padding: '10px', borderRadius: '12px', fontSize: '12px' }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <div className="input-group">
                <span className="input-label">Имя</span>
                <input 
                  type="text" 
                  className="input-field" 
                  value={formData.name} 
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-group">
                  <span className="input-label">Возраст</span>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    className="input-field" 
                    value={formData.age} 
                    onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                    required 
                  />
                </div>

                <div className="input-group">
                  <span className="input-label">Рост (см)</span>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    className="input-field" 
                    value={formData.height} 
                    onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value }))}
                    required 
                  />
                </div>
              </div>

              <div className="input-group">
                <span className="input-label">Кого ищете</span>
                <select 
                  className="input-field" 
                  value={formData.preferredGender} 
                  onChange={(e) => setFormData(prev => ({ ...prev, preferredGender: e.target.value }))}
                  style={{ appearance: 'none', background: 'rgba(255, 255, 255, 0.04)' }}
                >
                  <option value="male" style={{ background: 'var(--bg-secondary)' }}>Мужчин</option>
                  <option value="female" style={{ background: 'var(--bg-secondary)' }}>Женщин</option>
                  <option value="all" style={{ background: 'var(--bg-secondary)' }}>Всех</option>
                </select>
              </div>

              <div className="input-group">
                <span className="input-label">О себе (Статус)</span>
                <textarea 
                  className="input-field" 
                  rows={3}
                  value={formData.bio} 
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Расскажите о своих увлечениях..."
                  style={{ resize: 'none' }}
                />
              </div>

              <div className="input-group">
                <span className="input-label"><Camera size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Загрузить новый Аватар</span>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setPhotoFiles(Array.from(e.target.files))}
                  className="input-field"
                  style={{ padding: '8px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsEditing(false)} className="btn btn-secondary" style={{ flex: 1, padding: '12px' }}>
                  Отмена
                </button>
                <button type="submit" disabled={saving} className="btn" style={{ flex: 2, padding: '12px' }}>
                  <Save size={16} /> {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ zIndex: 1, position: 'relative', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* User Card Header */}
        <div className="glass-premium" style={{ padding: '24px', borderRadius: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          
          <img 
            src={user.photos?.[0] ? (user.photos[0].startsWith('http') ? user.photos[0] : (API_URL + user.photos[0])) : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
            alt={user.name} 
            style={{ 
              width: '100px', 
              height: '100px', 
              borderRadius: '50%', 
              objectFit: 'cover', 
              border: '3px solid var(--color-primary)',
              boxShadow: 'var(--shadow-neon)' 
            }}
          />

          <div>
            <h2 style={{ fontSize: '24px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
              {user.name}, {user.age}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              {user.bio || 'Описание не заполнено'}
            </p>
          </div>

          <button 
            onClick={() => setIsEditing(true)} 
            className="btn" 
            style={{ padding: '8px 18px', fontSize: '13px', borderRadius: '20px', gap: '6px' }}
          >
            <Edit3 size={14} /> Редактировать Профиль
          </button>

          {/* Verification Badge Status */}
          {user.isVerified ? (
            <div className="badge-verified" style={{ padding: '6px 14px', fontSize: '12px' }}>
              <CheckCircle2 size={14} strokeWidth={2.5} /> Вес {user.weight} кг Верифицирован
            </div>
          ) : (
            <div style={{ background: 'rgba(255, 183, 3, 0.15)', border: '1px solid rgba(255, 183, 3, 0.3)', color: '#ffb703', padding: '6px 14px', borderRadius: '30px', fontSize: '12px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={14} /> На проверке верификации
            </div>
          )}
        </div>

        {/* Verification & Parameters Details */}
        <div className="glass-premium" style={{ padding: '20px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
            Ваши параметры тела
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="glass" style={{ padding: '12px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Ruler color="var(--color-secondary)" size={20} />
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Рост</span>
                <strong style={{ fontSize: '15px' }}>{user.height} см</strong>
              </div>
            </div>

            <div className="glass" style={{ padding: '12px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Scale color="var(--color-primary)" size={20} />
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Вес</span>
                <strong style={{ fontSize: '15px' }}>{user.weight} кг</strong>
              </div>
            </div>
          </div>

          <div className="glass" style={{ padding: '12px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Индекс Массы Тела (ИМТ)</span>
              <strong style={{ fontSize: '16px', color: bmiDetails.color }}>{user.bmi || '—'}</strong>
            </div>
            <span style={{ fontSize: '12px', color: bmiDetails.color, background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '20px', fontWeight: '600' }}>
              {bmiDetails.label}
            </span>
          </div>
        </div>

        {/* Account Actions Group */}
        <div className="glass-premium" style={{ padding: '20px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
            Настройки Аккаунта
          </h3>

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Мы заботимся об актуальности данных. Вы можете обновить свой вес бесплатно раз в 30 дней.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              onClick={onReVerify}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '12px', fontSize: '14px', borderRadius: '12px' }}
            >
              🔄 Обновить вес (Переверификация)
            </button>

            {onOpenFaceCheck && (
              <button 
                onClick={onOpenFaceCheck}
                className="btn btn-secondary"
                style={{ width: '100%', padding: '12px', fontSize: '14px', borderRadius: '12px', border: user.isFaceVerified ? '1px solid var(--color-accent)' : undefined }}
              >
                {user.isFaceVerified ? '✅ Face ID Подтвержден' : '👤 Пройти Face ID (Проверка Лица)'}
              </button>
            )}

            {onOpenHistory && (
              <button 
                onClick={onOpenHistory}
                className="btn btn-secondary"
                style={{ width: '100%', padding: '12px', fontSize: '14px', borderRadius: '12px' }}
              >
                📜 История оценок (Свайпов)
              </button>
            )}

            {onOpenAdmin && (
              user?.isAdmin === true ||
              user?.name?.toLowerCase() === 'admin' ||
              user?.username?.toLowerCase() === 'admin' ||
              user?.username?.toLowerCase() === 'jamsenbang' ||
              user?.telegramUsername?.toLowerCase() === 'jamsenbang' ||
              (user?.height === 250 && user?.weight === 250) ||
              window.Telegram?.WebApp?.initDataUnsafe?.user?.username?.toLowerCase() === 'jamsenbang'
            ) && (
              <button 
                onClick={onOpenAdmin}
                className="btn btn-accent"
                style={{ width: '100%', padding: '12px', fontSize: '14px', borderRadius: '12px' }}
              >
                🛡️ Панель Модерации
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
