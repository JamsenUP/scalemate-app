import React, { useState } from 'react';
import { User, Calendar, Ruler, Scale, FileText, Heart, Camera, LogIn, UserPlus, MapPin, DollarSign } from 'lucide-react';
import { getRussianErrorMessage } from '../utils/errorHandler';

const CITIES_PRESETS = ['Москва', 'Санкт-Петербург', 'Казань', 'Новосибирск', 'Екатеринбург', 'Нижний Новгород', 'Сочи', 'Краснодар', 'Уфа', 'Самара'];

export default function Register({ onRegister, API_URL, tgUserId }) {
  const [activeTab, setActiveTab] = useState('register'); // 'register' | 'login'
  const [loginQuery, setLoginQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'female',
    preferredGender: 'male',
    height: '',
    weight: '60',
    income: '150000',
    city: 'Москва',
    bio: ''
  });
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'gender') {
      const opposite = value === 'male' ? 'female' : 'male';
      setFormData(prev => ({ 
        ...prev, 
        gender: value, 
        preferredGender: opposite 
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePhotoChange = (e) => {
    if (e.target.files) {
      setPhotos(Array.from(e.target.files));
    }
  };

  const compressImage = async (file, maxWidth = 800, maxHeight = 800, quality = 0.75) => {
    try {
      if (!file || !(file instanceof Blob || file instanceof File)) return file;
      const filename = file.name || '';
      if (filename.toLowerCase().endsWith('.heic') || filename.toLowerCase().endsWith('.heif')) return file;

      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.onerror = () => resolve(file);
          img.src = event.target.result;
          img.onload = () => {
            try {
              if (!img.width || !img.height) return resolve(file);
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;

              if (width > height) {
                if (width > maxWidth) {
                  height = Math.round((height * maxWidth) / width);
                  width = maxWidth;
                }
              } else {
                if (height > maxHeight) {
                  width = Math.round((width * maxHeight) / height);
                  height = maxHeight;
                }
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, width, height);

              canvas.toBlob(
                (blob) => {
                  if (!blob || blob.size === 0) return resolve(file);
                  resolve(new File([blob], file.name || 'photo.jpg', { type: 'image/jpeg', lastModified: Date.now() }));
                },
                'image/jpeg',
                quality
              );
            } catch {
              resolve(file);
            }
          };
        };
      });
    } catch {
      return file;
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginQuery.trim()) {
      setError('Введите ваше имя или Telegram username');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dev-user-id': tgUserId
        },
        body: JSON.stringify({ query: loginQuery })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Ошибка входа');
      }

      if (result.user) {
        const idToStore = result.user.telegramId || result.user.id;
        localStorage.setItem('scalemate_dev_user_id', idToStore);
        onRegister(result.user);
      }
    } catch (err) {
      console.error(err);
      setError(getRussianErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Requirement #15: Strict Name Validation
    const nameTrim = formData.name.trim();
    if (!nameTrim || /\s/.test(nameTrim) || !/^[a-zA-Zа-яА-ЯёЁ]+$/.test(nameTrim)) {
      setError('Пожалуйста, укажите только Ваше одно Имя (без фамилии, отчества, цифр и пробелов).');
      return;
    }

    if (!formData.age || !formData.height) {
      setError('Пожалуйста, заполните все обязательные поля.');
      return;
    }

    if (photos.length === 0) {
      setError('Загрузите хотя бы 1 личную фотографию с лицом.');
      return;
    }

    setLoading(true);
    setError('');

    const data = new FormData();
    data.append('name', nameTrim);
    data.append('age', formData.age);
    data.append('gender', formData.gender);
    data.append('preferredGender', formData.preferredGender);
    data.append('height', formData.height);
    data.append('weight', formData.weight);
    data.append('income', formData.income);
    data.append('city', formData.city);
    data.append('bio', formData.bio);

    for (const photo of photos) {
      try {
        const compressed = await compressImage(photo);
        data.append('photos', compressed);
      } catch {
        data.append('photos', photo);
      }
    }

    try {
      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: {
          'x-dev-user-id': tgUserId
        },
        body: data
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Ошибка при регистрации');
      }

      if (result.user) {
        const idToStore = result.user.telegramId || result.user.id;
        localStorage.setItem('scalemate_dev_user_id', idToStore);
        onRegister(result.user);
      }
    } catch (err) {
      console.error(err);
      setError(getRussianErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen-container">
      <div className="bg-mesh mesh-1"></div>
      <div className="bg-mesh mesh-2"></div>

      <div style={{ zIndex: 1, position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px', marginTop: '10px' }}>
          <h1 style={{ fontSize: '32px', marginBottom: '8px', background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ScaleMate
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Знакомства на честных условиях!
          </p>
        </div>

        {/* Tab switcher: Register vs Login */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '16px', marginBottom: '20px', gap: '4px' }}>
          <button 
            type="button"
            onClick={() => { setActiveTab('register'); setError(''); }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              background: activeTab === 'register' ? 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' : 'transparent',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <UserPlus size={15} /> Создать профиль
          </button>
          
          <button 
            type="button"
            onClick={() => { setActiveTab('login'); setError(''); }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              background: activeTab === 'login' ? 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' : 'transparent',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <LogIn size={15} /> Войти в аккаунт
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(255, 95, 95, 0.15)', border: '1px solid rgba(255, 95, 95, 0.3)', color: '#ff5f5f', padding: '12px', borderRadius: '12px', fontSize: '13px', marginBottom: '15px', fontWeight: '500' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Tab 1: Registration Form */}
        {activeTab === 'register' ? (
          <form onSubmit={handleSubmit} className="glass-premium" style={{ padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            
            <div className="input-group">
              <span className="input-label"><User size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Ваше Имя (только Имя) *</span>
              <input 
                type="text" 
                name="name"
                placeholder="Только Имя (например: Анна, Алексей)" 
                className="input-field" 
                value={formData.name}
                onChange={handleInputChange}
                required 
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                ℹ️ Без фамилии, отчества и никнеймов.
              </span>
            </div>

            <div className="input-group">
              <span className="input-label"><MapPin size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Ваш Город *</span>
              <select name="city" className="input-field" value={formData.city} onChange={handleInputChange} style={{ appearance: 'none', background: 'rgba(255, 255, 255, 0.04)' }}>
                {CITIES_PRESETS.map(c => (
                  <option key={c} value={c} style={{ background: 'var(--bg-secondary)' }}>{c}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="input-group">
                <span className="input-label"><Calendar size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Возраст *</span>
                <input 
                  type="text"
                  inputMode="numeric"
                  name="age"
                  placeholder="18+" 
                  className="input-field" 
                  value={formData.age}
                  onChange={handleInputChange}
                  required 
                />
              </div>
              
              <div className="input-group">
                <span className="input-label"><Ruler size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Рост (см) *</span>
                <input 
                  type="text"
                  inputMode="numeric"
                  name="height"
                  placeholder="170" 
                  className="input-field" 
                  value={formData.height}
                  onChange={handleInputChange}
                  required 
                />
              </div>
            </div>

            <div className="input-group">
              <span className="input-label">Ваш пол</span>
              <select name="gender" className="input-field" value={formData.gender} onChange={handleInputChange} style={{ appearance: 'none', background: 'rgba(255, 255, 255, 0.04)' }}>
                <option value="female" style={{ background: 'var(--bg-secondary)' }}>Женский (Поиск Мужчин)</option>
                <option value="male" style={{ background: 'var(--bg-secondary)' }}>Мужской (Поиск Женщин)</option>
              </select>
            </div>

            {formData.gender === 'female' ? (
              <div className="input-group">
                <span className="input-label"><Scale size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Ваш Вес (кг) *</span>
                <input 
                  type="text"
                  inputMode="decimal"
                  name="weight"
                  placeholder="60.5" 
                  className="input-field" 
                  value={formData.weight}
                  onChange={handleInputChange}
                  required 
                />
              </div>
            ) : (
              <div className="input-group">
                <span className="input-label"><DollarSign size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Ежемесячный доход (₽/мес) *</span>
                <input 
                  type="number"
                  name="income"
                  placeholder="150000" 
                  className="input-field" 
                  value={formData.income}
                  onChange={handleInputChange}
                  required 
                />
              </div>
            )}

            <div className="input-group">
              <span className="input-label"><FileText size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> О себе</span>
              <textarea 
                name="bio"
                placeholder="Расскажите о себе, интересах..." 
                className="input-field" 
                style={{ minHeight: '75px', resize: 'none' }}
                value={formData.bio}
                onChange={handleInputChange}
              />
            </div>

            <div className="input-group" style={{ marginBottom: '20px' }}>
              <span className="input-label"><Camera size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Фото профиля (Настоящее лицо) *</span>
              
              <input 
                type="file" 
                accept="image/*" 
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
                id="profile-photos-input"
                multiple
              />
              <label 
                htmlFor="profile-photos-input" 
                className="btn btn-secondary" 
                style={{ padding: '12px', fontSize: '14px', borderRadius: '12px', borderStyle: 'dashed' }}
              >
                📸 Загрузить фото с камеры / галереи
              </label>
              {photos.length > 0 && (
                <span style={{ fontSize: '13px', color: 'var(--color-accent)', textAlign: 'center', marginTop: '4px' }}>
                  ✓ Выбрано фотографий: {photos.length}
                </span>
              )}
            </div>

            <button 
              type="submit" 
              className={`btn ${loading ? 'btn-disabled' : ''}`}
              disabled={loading}
              style={{ padding: '14px', fontSize: '15px' }}
            >
              {loading ? 'Создание профиля...' : (formData.gender === 'female' ? 'Далее: Подтвердить Вес ⚖️' : 'Далее: Проверка Дохода 💰')}
            </button>
          </form>
        ) : (
          /* Tab 2: Login Form for Cross-Device / Web Users */
          <form onSubmit={handleLoginSubmit} className="glass-premium" style={{ padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '6px' }}>Восстановление сессии</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Введите ваше Имя, Telegram Username или ID для синхронизации аккаунта!
              </p>
            </div>

            <div className="input-group">
              <span className="input-label"><User size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Имя или Telegram Username *</span>
              <input 
                type="text" 
                placeholder="Например: admin или @username" 
                className="input-field" 
                value={loginQuery}
                onChange={(e) => setLoginQuery(e.target.value)}
                required 
              />
            </div>

            <button 
              type="submit" 
              className={`btn btn-accent ${loading ? 'btn-disabled' : ''}`}
              disabled={loading}
              style={{ padding: '14px', fontSize: '15px', borderRadius: '14px' }}
            >
              {loading ? 'Поиск профиля...' : '🔑 Найти и Войти в Аккаунт'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
