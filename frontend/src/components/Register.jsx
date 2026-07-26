import React, { useState } from 'react';
import { User, Calendar, Ruler, Scale, FileText, Heart, Camera } from 'lucide-react';
import { getRussianErrorMessage } from '../utils/errorHandler';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'
];

export default function Register({ onRegister, API_URL, tgUserId }) {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'female',
    preferredGender: 'male',
    height: '',
    weight: '',
    bio: ''
  });
  const [photos, setPhotos] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    if (e.target.files) {
      setPhotos(Array.from(e.target.files));
      setSelectedPreset(null);
    }
  };

  const handlePresetSelect = (index) => {
    setSelectedPreset(index);
    setPhotos([]);
  };

  const compressImage = async (file, maxWidth = 800, maxHeight = 800, quality = 0.75) => {
    try {
      if (!file || !(file instanceof Blob || file instanceof File)) {
        return file;
      }

      const filename = file.name || '';
      if (filename.toLowerCase().endsWith('.heic') || filename.toLowerCase().endsWith('.heif')) {
        console.log('HEIC format detected, bypassing canvas compression and using original file directly.');
        return file;
      }

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
              if (!img.width || !img.height) {
                resolve(file);
                return;
              }
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
                  if (!blob || blob.size === 0) {
                    resolve(file);
                    return;
                  }
                  const compressedFile = new File([blob], file.name || 'photo.jpg', {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  });
                  resolve(compressedFile);
                },
                'image/jpeg',
                quality
              );
            } catch (e) {
              console.warn('Canvas compression error, sending original file:', e);
              resolve(file);
            }
          };
        };
      });
    } catch (globalErr) {
      console.warn('Top-level compression exception, sending original file:', globalErr);
      return file;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.age || !formData.height || !formData.weight) {
      setError('Пожалуйста, заполните все обязательные поля.');
      return;
    }

    setLoading(true);
    setError('');

    const data = new FormData();
    data.append('name', formData.name);
    data.append('age', formData.age);
    data.append('gender', formData.gender);
    data.append('preferredGender', formData.preferredGender);
    data.append('height', formData.height);
    data.append('weight', formData.weight);
    data.append('bio', formData.bio);

    if (photos.length > 0) {
      // Compress and append profile photos client-side
      for (const photo of photos) {
        try {
          const compressed = await compressImage(photo);
          data.append('photos', compressed);
        } catch (err) {
          console.error('Image compression failed, using original', err);
          data.append('photos', photo);
        }
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

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Ошибка при регистрации');
      }

      const result = await response.json();
      onRegister(result.user);
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
        <div style={{ textAlign: 'center', marginBottom: '30px', marginTop: '10px' }}>
          <h1 style={{ fontSize: '32px', marginBottom: '10px', background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ScaleMate
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Пройди регистрацию и найди свою половинку на честных условиях!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-premium" style={{ padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          
          {error && (
            <div style={{ background: 'rgba(255, 95, 95, 0.1)', border: '1px solid rgba(255, 95, 95, 0.3)', color: '#ff5f5f', padding: '12px', borderRadius: '12px', fontSize: '14px', marginBottom: '15px', fontWeight: '500' }}>
              ⚠️ {error}
            </div>
          )}

          <div className="input-group">
            <span className="input-label"><User size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Ваше Имя *</span>
            <input 
              type="text" 
              name="name"
              placeholder="Как к вам обращаться?" 
              className="input-field" 
              value={formData.name}
              onChange={handleInputChange}
              required 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div className="input-group">
              <span className="input-label"><Calendar size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Возраст *</span>
              <input 
                type="number" 
                name="age"
                placeholder="18+" 
                className="input-field" 
                value={formData.age}
                onChange={handleInputChange}
                min="18"
                max="100"
                required 
              />
            </div>
            
            <div className="input-group">
              <span className="input-label"><Ruler size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Рост (см) *</span>
              <input 
                type="number" 
                name="height"
                placeholder="170" 
                className="input-field" 
                value={formData.height}
                onChange={handleInputChange}
                min="100"
                max="250"
                required 
              />
            </div>
          </div>

          <div className="input-group">
            <span className="input-label"><Scale size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Ваш Вес (кг) *</span>
            <input 
              type="number" 
              name="weight"
              placeholder="70.5" 
              className="input-field" 
              value={formData.weight}
              onChange={handleInputChange}
              min="30"
              max="300"
              step="0.1"
              required 
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '-4px' }}>
              💡 Вес нужно будет подтвердить на следующем шаге с помощью фото весов.
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <div className="input-group">
              <span className="input-label">Ваш пол</span>
              <select name="gender" className="input-field" value={formData.gender} onChange={handleInputChange} style={{ appearance: 'none', background: 'rgba(255, 255, 255, 0.04)' }}>
                <option value="female" style={{ background: 'var(--bg-secondary)' }}>Женский</option>
                <option value="male" style={{ background: 'var(--bg-secondary)' }}>Мужской</option>
              </select>
            </div>
            <div className="input-group">
              <span className="input-label"><Heart size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Ищу кого</span>
              <select name="preferredGender" className="input-field" value={formData.preferredGender} onChange={handleInputChange} style={{ appearance: 'none', background: 'rgba(255, 255, 255, 0.04)' }}>
                <option value="male" style={{ background: 'var(--bg-secondary)' }}>Мужчин</option>
                <option value="female" style={{ background: 'var(--bg-secondary)' }}>Женщин</option>
                <option value="all" style={{ background: 'var(--bg-secondary)' }}>Всех</option>
              </select>
            </div>
          </div>

          <div className="input-group">
            <span className="input-label"><FileText size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> О себе</span>
            <textarea 
              name="bio"
              placeholder="Расскажите о себе, своих увлечениях..." 
              className="input-field" 
              style={{ minHeight: '80px', resize: 'none' }}
              value={formData.bio}
              onChange={handleInputChange}
            />
          </div>

          <div className="input-group" style={{ marginBottom: '25px' }}>
            <span className="input-label"><Camera size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Фото профиля</span>
            
            {/* File Upload Option */}
            <input 
              type="file" 
              accept="image/*" 
              onChange={handlePhotoChange}
              style={{ display: 'none' }}
              id="profile-photos-input"
            />
            <label 
              htmlFor="profile-photos-input" 
              className="btn btn-secondary" 
              style={{ padding: '12px', fontSize: '14px', borderRadius: '12px', borderStyle: 'dashed' }}
            >
              Загрузить с телефона
            </label>
            {photos.length > 0 && (
              <span style={{ fontSize: '13px', color: 'var(--color-accent)', textAlign: 'center' }}>
                ✓ Выбрано файлов: {photos.length}
              </span>
            )}

          </div>

          <button 
            type="submit" 
            className={`btn ${loading ? 'btn-disabled' : ''}`}
            disabled={loading}
          >
            {loading ? 'Создание профиля...' : 'Далее: Подтвердить Вес'}
          </button>
        </form>
      </div>
    </div>
  );
}
