import React, { useState, useEffect } from 'react';
import { Heart, MessageSquare, Star, PlusCircle, Camera, MapPin, Sparkles, X, UserCheck } from 'lucide-react';
import { getRussianErrorMessage } from '../utils/errorHandler';

export default function DateStories({ user, API_URL, tgUserId }) {
  const [stories, setStories] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form states for new date story
  const [partnerName, setPartnerName] = useState('');
  const [storyText, setStoryText] = useState('');
  const [rating, setRating] = useState(5);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStories();
    fetchMatches();
  }, []);

  const getAuthHeaders = () => {
    const headers = {};
    const tgInit = window.Telegram?.WebApp?.initData;
    if (tgInit) headers['x-tg-init-data'] = tgInit;
    else headers['x-dev-user-id'] = tgUserId;
    return headers;
  };

  const fetchStories = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/stories`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (response.ok) {
        setStories(result.stories || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatches = async () => {
    try {
      const response = await fetch(`${API_URL}/api/matches`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (response.ok && result.matches) {
        setMatches(result.matches);
        if (result.matches.length > 0) {
          setPartnerName(result.matches[0].user.name);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleLikeStory = async (storyId) => {
    try {
      const response = await fetch(`${API_URL}/api/stories/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ storyId })
      });
      const result = await response.json();
      if (response.ok && result.story) {
        setStories(prev => prev.map(s => s.id === storyId ? result.story : s));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitStory = async (e) => {
    e.preventDefault();
    if (!partnerName) {
      setError('Выберите партнёра из списка ваших диалогов.');
      return;
    }
    if (!storyText.trim()) {
      setError('Пожалуйста, напишите историю вашего свидания.');
      return;
    }

    setSubmitting(true);
    setError('');

    const data = new FormData();
    data.append('partnerName', partnerName);
    data.append('story', storyText);
    data.append('rating', rating);
    if (photo) data.append('photo', photo);

    try {
      const response = await fetch(`${API_URL}/api/stories`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: data
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Ошибка добавления истории');

      setShowModal(false);
      setStoryText('');
      setPhoto(null);
      setPhotoPreview(null);
      fetchStories();
    } catch (err) {
      setError(getRussianErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const getPhotoUrl = (p) => {
    if (!p) return null;
    return p.startsWith('http') ? p : API_URL + p;
  };

  return (
    <div className="screen-container">
      <div className="bg-mesh mesh-1"></div>
      <div className="bg-mesh mesh-2"></div>

      <div style={{ zIndex: 1, position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Header & Add Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
          <div>
            <h2 style={{ fontSize: '22px' }}>Форум Свиданий 💬</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Реальные истории встреч пар ScaleMate</p>
          </div>

          <button 
            onClick={() => { fetchMatches(); setShowModal(true); }} 
            className="btn btn-accent"
            style={{ padding: '8px 14px', fontSize: '12px', borderRadius: '20px', gap: '6px' }}
          >
            <PlusCircle size={15} /> Поделиться
          </button>
        </div>

        {/* Stories Feed */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Загрузка историй...</div>
        ) : stories.length === 0 ? (
          <div className="glass-premium" style={{ padding: '35px', textAlign: 'center', borderRadius: '24px', color: 'var(--text-muted)' }}>
            <Sparkles size={36} color="var(--color-primary)" style={{ margin: 'auto', marginBottom: '10px' }} />
            <h3 style={{ fontSize: '17px', color: '#fff', marginBottom: '6px' }}>Пока нет историй свиданий</h3>
            <p style={{ fontSize: '12px', maxWidth: '260px', margin: 'auto' }}>
              Встретились с кем-то из ScaleMate? Будьте первыми, кто расскажет, как прошло свидание!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {stories.map(s => (
              <div key={s.id} className="glass-premium" style={{ padding: '18px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* Author Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img 
                    src={s.user_photo ? getPhotoUrl(s.user_photo) : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                    alt={s.user_name}
                    style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '15px' }}>{s.user_name}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>свидание с {s.partner_name}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📍 {s.city || 'Москва'}</span>
                  </div>

                  {/* Rating Stars */}
                  <div style={{ display: 'flex', color: '#ffd700', gap: '2px' }}>
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={14} fill={i < (s.rating || 5) ? '#ffd700' : 'transparent'} color="#ffd700" />
                    ))}
                  </div>
                </div>

                {/* Story Content */}
                <p style={{ fontSize: '14px', lineHeight: '1.5', color: 'rgba(255,255,255,0.9)', whiteSpace: 'pre-wrap' }}>
                  {s.story}
                </p>

                {/* Attached Photo */}
                {s.photo && (
                  <img 
                    src={getPhotoUrl(s.photo)} 
                    alt="Свидание" 
                    style={{ width: '100%', maxHeight: '250px', borderRadius: '16px', objectFit: 'cover' }}
                  />
                )}

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                  <button 
                    onClick={() => handleLikeStory(s.id)}
                    style={{ background: 'none', border: 'none', color: '#ff5f5f', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600' }}
                  >
                    <Heart size={16} fill="#ff5f5f" /> {s.likes_count || 0} Рады за пару
                  </button>

                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {new Date(s.created_at).toLocaleDateString('ru-RU')}
                  </span>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>

      {/* Add Story Modal with Partner Selector */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-premium" style={{ width: '100%', maxWidth: '400px', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px' }}>Рассказать о свидании</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {error && (
              <div style={{ background: 'rgba(255, 95, 95, 0.15)', border: '1px solid rgba(255, 95, 95, 0.3)', color: '#ff5f5f', padding: '10px', borderRadius: '12px', fontSize: '12px' }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmitStory} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Dropdown to pick partner from active matches */}
              <div className="input-group">
                <span className="input-label"><UserCheck size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Выберите партнёра по общению *</span>
                {matches.length > 0 ? (
                  <select 
                    className="input-field" 
                    value={partnerName} 
                    onChange={(e) => setPartnerName(e.target.value)}
                    style={{ appearance: 'none', background: 'rgba(255, 255, 255, 0.04)' }}
                  >
                    {matches.map(m => (
                      <option key={m.user.id} value={m.user.name} style={{ background: 'var(--bg-secondary)' }}>
                        {m.user.name}, {m.user.age} лет (📍 {m.user.city || 'Москва'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontSize: '12px', color: '#ffb703', background: 'rgba(255, 183, 3, 0.12)', border: '1px solid rgba(255, 183, 3, 0.3)', padding: '12px', borderRadius: '12px', lineHeight: '1.4' }}>
                    ⚠️ У вас пока нет совпадений. Начните общение с кем-то в чате, чтобы рассказать о свидании!
                  </div>
                )}
              </div>

              <div className="input-group">
                <span className="input-label">Оценка свидания (от 1 до 5 звезд)</span>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  {[1, 2, 3, 4, 5].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setRating(num)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '10px',
                        border: rating === num ? '1px solid #ffd700' : '1px solid rgba(255,255,255,0.1)',
                        background: rating === num ? 'rgba(255, 215, 0, 0.2)' : 'transparent',
                        color: rating === num ? '#ffd700' : '#fff',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      {num} ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-group">
                <span className="input-label">Ваша история *</span>
                <textarea 
                  placeholder="Расскажите, как прошло ваше свидание..."
                  className="input-field"
                  style={{ minHeight: '100px', resize: 'none' }}
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <span className="input-label">Фото со свидания (необязательно)</span>
                <input type="file" accept="image/*" onChange={handlePhotoChange} id="story-photo" style={{ display: 'none' }} />
                <label htmlFor="story-photo" className="btn btn-secondary" style={{ padding: '10px', fontSize: '13px', borderRadius: '12px', borderStyle: 'dashed' }}>
                  <Camera size={16} /> {photo ? '✓ Фото выбрано' : 'Загрузить фото'}
                </label>
              </div>

              <button 
                type="submit" 
                className={`btn btn-accent ${submitting || matches.length === 0 ? 'btn-disabled' : ''}`} 
                disabled={submitting || matches.length === 0} 
                style={{ padding: '14px', borderRadius: '14px', marginTop: '10px' }}
              >
                {submitting ? 'Опубликование...' : '🚀 Опубликовать в форум'}
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
