import React, { useState } from 'react';
import { Camera, CheckCircle, AlertTriangle, RefreshCw, ShieldCheck, UserCheck } from 'lucide-react';
import { getRussianErrorMessage } from '../utils/errorHandler';

export default function FaceCheckModal({ user, API_URL, tgUserId, onSuccess, onCancel }) {
  const [selfie, setSelfie] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSelfieChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelfie(file);
      setSelfiePreview(URL.createObjectURL(file));
    }
  };

  const handleVerifyFace = async () => {
    if (!selfie) {
      setError('Пожалуйста, сделайте селфи для проверки Face ID.');
      return;
    }

    setLoading(true);
    setError('');

    const data = new FormData();
    data.append('faceSelfie', selfie);

    try {
      const response = await fetch(`${API_URL}/api/verify-face`, {
        method: 'POST',
        headers: { 'x-dev-user-id': tgUserId },
        body: data
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Лицо на селфи не совпадает с фотографией профиля.');
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess(result.user);
      }, 1800);

    } catch (err) {
      console.error(err);
      setError(getRussianErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10, 8, 20, 0.95)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass-premium" style={{ padding: '40px 30px', borderRadius: '30px', maxWidth: '360px', width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(0, 245, 212, 0.15)', border: '2px solid var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserCheck size={36} color="var(--color-accent)" />
          </div>
          <h3 style={{ fontSize: '22px' }}>Face ID Подтвержден!</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            ИИ успешно подтвердил совпадение вашего лица с аватаркой профиля.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10, 8, 20, 0.92)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass-premium" style={{ padding: '25px', borderRadius: '28px', maxWidth: '380px', width: '100%', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'rgba(0, 245, 212, 0.1)', border: '1px solid rgba(0, 245, 212, 0.2)', marginBottom: '8px' }}>
            <ShieldCheck size={32} color="var(--color-accent)" />
          </div>
          <h3 style={{ fontSize: '20px' }}>Проверка Face ID</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
            Сделайте живое селфи. ИИ сверит ваше лицо с аватаркой профиля, чтобы исключить фейковые фотки из интернета.
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(255, 95, 95, 0.15)', border: '1px solid rgba(255, 95, 95, 0.3)', color: '#ff5f5f', padding: '10px', borderRadius: '12px', fontSize: '12px', textAlign: 'center', fontWeight: '500' }}>
            {error}
          </div>
        )}

        {/* Camera upload box */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <input 
            type="file" 
            accept="image/*" 
            capture="user"
            onChange={handleSelfieChange}
            style={{ display: 'none' }}
            id="face-id-camera-input"
          />
          
          <label 
            htmlFor="face-id-camera-input"
            style={{
              width: '180px',
              height: '180px',
              borderRadius: '50%',
              border: '2px dashed var(--color-accent)',
              background: selfiePreview ? `url(${selfiePreview}) center/cover no-repeat` : 'rgba(0, 245, 212, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-neon)'
            }}
          >
            {!selfiePreview && (
              <>
                <Camera size={36} color="var(--color-accent)" />
                <span style={{ fontSize: '11px', color: 'var(--color-accent)', marginTop: '8px', fontWeight: '600' }}>
                  Сделать селфи
                </span>
              </>
            )}
          </label>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
          {onCancel && (
            <button onClick={onCancel} className="btn btn-secondary" style={{ flex: 1, padding: '12px', fontSize: '13px' }}>
              Отмена
            </button>
          )}
          <button 
            onClick={handleVerifyFace} 
            className={`btn btn-accent ${loading ? 'btn-disabled' : ''}`} 
            disabled={loading}
            style={{ flex: 2, padding: '12px', fontSize: '13px' }}
          >
            {loading ? 'Проверка лица ИИ...' : 'Сверить с Аватаркой'}
          </button>
        </div>

      </div>
    </div>
  );
}
