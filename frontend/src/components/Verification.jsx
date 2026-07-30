import React, { useState } from 'react';
import { Scale, Upload, Camera, CheckCircle, AlertTriangle, RefreshCw, DollarSign, CreditCard } from 'lucide-react';
import { getRussianErrorMessage } from '../utils/errorHandler';

export default function Verification({ user, onVerificationSuccess, API_URL, tgUserId }) {
  const isMale = user?.gender === 'male';

  // Women states (Scale verification)
  const [mode, setMode] = useState('scales'); // 'scales' | 'no_scales'
  const [scalePhoto, setScalePhoto] = useState(null);
  const [scalePhotoPreview, setScalePhotoPreview] = useState(null);
  const [selfiePhoto, setSelfiePhoto] = useState(null);
  const [selfiePhotoPreview, setSelfiePhotoPreview] = useState(null);
  const [fullBodyPhoto, setFullBodyPhoto] = useState(null);
  const [fullBodyPhotoPreview, setFullBodyPhotoPreview] = useState(null);

  // Men states (Bank Screenshot Income verification)
  const [incomeAmount, setIncomeAmount] = useState(user?.income || 150000);
  const [bankPhoto, setBankPhoto] = useState(null);
  const [bankPhotoPreview, setBankPhotoPreview] = useState(null);

  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleBankPhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBankPhoto(file);
      setBankPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleFullBodyChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFullBodyPhoto(file);
      setFullBodyPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleScalePhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setScalePhoto(file);
      setScalePhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSelfiePhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelfiePhoto(file);
      setSelfiePhotoPreview(URL.createObjectURL(file));
    }
  };

  const compressImage = async (file, maxWidth = 800, maxHeight = 800, quality = 0.75) => {
    try {
      if (!file || !(file instanceof Blob || file instanceof File)) return file;
      const filename = file.name || '';
      if (filename.toLowerCase().endsWith('.heic') || filename.toLowerCase().endsWith('.heif')) {
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
            } catch (e) {
              resolve(file);
            }
          };
        };
      });
    } catch {
      return file;
    }
  };

  // Male income submission handler
  const handleVerifyIncome = async () => {
    if (!bankPhoto) {
      setError('Пожалуйста, загрузите скриншот из мобильного банка.');
      return;
    }

    setLoading(true);
    setError('');

    const data = new FormData();
    data.append('income', incomeAmount);

    try {
      const compressed = await compressImage(bankPhoto);
      data.append('incomePhoto', compressed);
    } catch {
      data.append('incomePhoto', bankPhoto);
    }

    try {
      const response = await fetch(`${API_URL}/api/verify-income`, {
        method: 'POST',
        headers: { 'x-dev-user-id': tgUserId },
        body: data
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Ошибка при отправке скриншота дохода');
      }

      setSuccess(true);
      setTimeout(() => {
        onVerificationSuccess(result.user);
      }, 2000);
    } catch (err) {
      console.error(err);
      setError(getRussianErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Female moderation request
  const handleRequestModeration = async () => {
    setLoading(true);
    setError('');
    const data = new FormData();
    if (fullBodyPhoto) {
      try {
        const compressed = await compressImage(fullBodyPhoto);
        data.append('fullBodyPhoto', compressed);
      } catch (e) {
        data.append('fullBodyPhoto', fullBodyPhoto);
      }
    }

    try {
      const response = await fetch(`${API_URL}/api/request-moderation`, {
        method: 'POST',
        headers: { 'x-dev-user-id': tgUserId },
        body: data
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Ошибка отправки на модерацию');
      onVerificationSuccess(result.user);
    } catch (err) {
      setError(getRussianErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Female weight verification via AI
  const handleVerify = async () => {
    if (!scalePhoto) {
      setError('Необходимо загрузить фото весов.');
      return;
    }

    setLoading(true);
    setScanning(true);
    setError('');

    const data = new FormData();
    try {
      const compressedScale = await compressImage(scalePhoto);
      data.append('scalePhoto', compressedScale);
      if (selfiePhoto) {
        const compressedSelfie = await compressImage(selfiePhoto);
        data.append('selfiePhoto', compressedSelfie);
      }
    } catch {
      data.append('scalePhoto', scalePhoto);
      if (selfiePhoto) data.append('selfiePhoto', selfiePhoto);
    }

    try {
      const response = await fetch(`${API_URL}/api/verify-weight`, {
        method: 'POST',
        headers: { 'x-dev-user-id': tgUserId },
        body: data
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Верификация веса отклонена AI.');

      setScanning(false);
      setSuccess(true);
      setTimeout(() => {
        onVerificationSuccess(result.user);
      }, 2000);
    } catch (err) {
      console.error(err);
      setError(getRussianErrorMessage(err));
      setScanning(false);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="screen-container" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div className="bg-mesh mesh-1"></div>
        <div className="bg-mesh mesh-2"></div>
        <div className="glass-premium" style={{ padding: '40px 30px', borderRadius: '30px', maxWidth: '90%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(0, 245, 212, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--color-accent)', boxShadow: 'var(--shadow-accent)' }}>
            <CheckCircle size={40} color="var(--color-accent)" style={{ margin: 'auto' }} />
          </div>
          <h2 style={{ fontSize: '26px' }}>{isMale ? 'Скриншот Дохода Отправлен!' : 'Вес Верифицирован!'}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
            {isMale 
              ? `Скриншот вашего дохода (${parseInt(incomeAmount).toLocaleString('ru-RU')} ₽/мес) успешно отправлен модератору на верификацию.`
              : `Наш AI проверил фото весов. Вес ${user.weight} кг подтвержден.`}
          </p>
          <div style={{ color: 'var(--color-accent)', fontWeight: '700', fontSize: '14px', marginTop: '10px' }}>
            Открытие ленты знакомств...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-container">
      <div className="bg-mesh mesh-1"></div>
      <div className="bg-mesh mesh-2"></div>

      <div style={{ zIndex: 1, position: 'relative' }}>
        
        {/* Male Verification Interface */}
        {isMale ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '25px', marginTop: '10px' }}>
              <div style={{ display: 'inline-flex', padding: '14px', borderRadius: '50%', background: 'rgba(0, 245, 212, 0.15)', border: '1px solid rgba(0, 245, 212, 0.3)', marginBottom: '12px' }}>
                <CreditCard size={34} color="var(--color-accent)" />
              </div>
              <h2>Верификация Дохода 💰</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>
                Подтверждение ежемесячного дохода для честных знакомств
              </p>
            </div>

            <div className="glass-premium" style={{ padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {error && (
                <div style={{ background: 'rgba(255, 95, 95, 0.15)', border: '1px solid rgba(255, 95, 95, 0.3)', color: '#ff5f5f', padding: '12px', borderRadius: '12px', fontSize: '13px', fontWeight: '500', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <div>{error}</div>
                </div>
              )}

              <div style={{ background: 'rgba(0, 245, 212, 0.08)', padding: '16px', borderRadius: '16px', fontSize: '13px', lineHeight: '1.5', border: '1px solid rgba(0, 245, 212, 0.2)' }}>
                <h4 style={{ color: 'var(--color-accent)', marginBottom: '6px', fontWeight: '700' }}>📌 ИНСТРУКЦИЯ ПО ВЕРИФИКАЦИИ:</h4>
                <ol style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-muted)' }}>
                  <li>Откройте ваше банковское приложение (Сбер, Т-Банк, Альфа, ВТБ и др.).</li>
                  <li>Сделайте скриншот экрана с указанием месячного дохода или баланса.</li>
                  <li>Загрузите скриншот ниже и укажите сумму дохода.</li>
                </ol>
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <span className="input-label">Заявленный доход в месяц (₽/мес) *</span>
                <input 
                  type="number"
                  className="input-field" 
                  value={incomeAmount}
                  onChange={(e) => setIncomeAmount(e.target.value)}
                  placeholder="200000"
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span className="input-label" style={{ textAlign: 'center' }}>Скриншот из Мобильного Банка *</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleBankPhotoChange} 
                  style={{ display: 'none' }}
                  id="bank-photo-upload"
                />
                <label 
                  htmlFor="bank-photo-upload"
                  style={{
                    height: '170px',
                    borderRadius: '16px',
                    border: '1px dashed rgba(0, 245, 212, 0.4)',
                    background: bankPhotoPreview ? `url(${bankPhotoPreview}) center/cover no-repeat` : 'rgba(0, 245, 212, 0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    position: 'relative'
                  }}
                >
                  {!bankPhotoPreview && (
                    <>
                      <Upload size={32} color="var(--color-accent)" />
                      <span style={{ fontSize: '13px', color: 'var(--color-accent)', marginTop: '8px', fontWeight: '600' }}>
                        Загрузить скриншот из банка
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        (Сбербанк, Т-Банк, Альфа-Банк и др.)
                      </span>
                    </>
                  )}
                </label>
              </div>

              <button 
                onClick={handleVerifyIncome}
                className={`btn btn-accent ${loading ? 'btn-disabled' : ''}`}
                disabled={loading}
                style={{ padding: '16px', fontSize: '15px', borderRadius: '16px', marginTop: '6px' }}
              >
                {loading ? 'Отправка модератору...' : '🚀 Отправить и Войти в Приложение'}
              </button>
            </div>
          </div>
        ) : (
          /* Female Weight Verification Interface */
          <div>
            <div style={{ textAlign: 'center', marginBottom: '25px', marginTop: '10px' }}>
              <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'rgba(138, 43, 226, 0.15)', border: '1px solid rgba(138, 43, 226, 0.3)', marginBottom: '12px' }}>
                <Scale size={32} color="var(--color-secondary)" />
              </div>
              <h2>Верификация Веса ⚖️</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>
                Заявленный вес: <strong style={{ color: '#fff', fontSize: '16px' }}>{user.weight} кг</strong>
              </p>
            </div>

            <div className="glass-premium" style={{ padding: '20px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Mode Switcher Tabs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '14px' }}>
                <button
                  onClick={() => { setMode('scales'); setError(''); }}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '10px',
                    border: 'none',
                    background: mode === 'scales' ? 'var(--color-primary)' : 'transparent',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  ⚖️ Есть весы (ИИ)
                </button>
                <button
                  onClick={() => { setMode('no_scales'); setError(''); }}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '10px',
                    border: 'none',
                    background: mode === 'no_scales' ? 'var(--color-secondary)' : 'transparent',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  📷 Нет весов (Модерация)
                </button>
              </div>

              {error && (
                <div style={{ background: 'rgba(255, 95, 95, 0.1)', border: '1px solid rgba(255, 95, 95, 0.3)', color: '#ff5f5f', padding: '12px', borderRadius: '12px', fontSize: '13px', fontWeight: '500', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <div>{error}</div>
                </div>
              )}

              {mode === 'scales' ? (
                <>
                  <div style={{ background: 'rgba(138, 43, 226, 0.08)', padding: '16px', borderRadius: '16px', fontSize: '13px', lineHeight: '1.5', border: '1px solid rgba(138, 43, 226, 0.15)' }}>
                    <h4 style={{ color: 'var(--color-secondary)', marginBottom: '6px', fontWeight: '700' }}>ИНСТРУКЦИЯ:</h4>
                    <ol style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-muted)' }}>
                      <li>Встаньте на напольные весы.</li>
                      <li>Сделайте чёткое фото дисплея весов, на котором видны цифры.</li>
                      <li>Сделайте селфи на весах, чтобы подтвердить, что вес ваш.</li>
                    </ol>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span className="input-label" style={{ textAlign: 'center' }}>Фото Весов *</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleScalePhotoChange} 
                        style={{ display: 'none' }}
                        id="scale-photo-upload"
                      />
                      <label 
                        htmlFor="scale-photo-upload"
                        style={{
                          height: '130px',
                          borderRadius: '16px',
                          border: '1px dashed rgba(255,255,255,0.15)',
                          background: scalePhotoPreview ? `url(${scalePhotoPreview}) center/cover no-repeat` : 'rgba(255,255,255,0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          position: 'relative'
                        }}
                      >
                        {!scalePhotoPreview && (
                          <>
                            <Upload size={24} color="var(--text-muted)" />
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Выбрать фото</span>
                          </>
                        )}
                        {scanning && <div className="laser-line"></div>}
                      </label>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span className="input-label" style={{ textAlign: 'center' }}>Селфи на Весах</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleSelfiePhotoChange} 
                        style={{ display: 'none' }}
                        id="selfie-photo-upload"
                      />
                      <label 
                        htmlFor="selfie-photo-upload"
                        style={{
                          height: '130px',
                          borderRadius: '16px',
                          border: '1px dashed rgba(255,255,255,0.15)',
                          background: selfiePhotoPreview ? `url(${selfiePhotoPreview}) center/cover no-repeat` : 'rgba(255,255,255,0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          position: 'relative'
                        }}
                      >
                        {!selfiePhotoPreview && (
                          <>
                            <Camera size={24} color="var(--text-muted)" />
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Выбрать селфи</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>

                  <button 
                    onClick={handleVerify}
                    className={`btn btn-accent ${loading ? 'btn-disabled' : ''}`}
                    style={{ marginTop: '10px', padding: '16px', fontSize: '15px', borderRadius: '16px' }}
                    disabled={loading}
                  >
                    {scanning ? (
                      <>
                        <RefreshCw className="spin" size={18} style={{ animation: 'spin 1.5s linear infinite' }} />
                        AI сканирование весов...
                      </>
                    ) : 'Запустить AI-Верификацию'}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ background: 'rgba(0, 245, 212, 0.08)', padding: '16px', borderRadius: '16px', fontSize: '13px', lineHeight: '1.5', border: '1px solid rgba(0, 245, 212, 0.2)' }}>
                    <h4 style={{ color: 'var(--color-accent)', marginBottom: '6px', fontWeight: '700' }}>ПРОВЕРКА ПО ФОТО:</h4>
                    <p style={{ color: 'var(--text-muted)' }}>
                      Загрузите ваше фото во весь рост для модерации.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span className="input-label" style={{ textAlign: 'center' }}>Фото во весь рост</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFullBodyChange} 
                      style={{ display: 'none' }}
                      id="full-body-upload"
                    />
                    <label 
                      htmlFor="full-body-upload"
                      style={{
                        height: '160px',
                        borderRadius: '16px',
                        border: '1px dashed rgba(0, 245, 212, 0.3)',
                        background: fullBodyPhotoPreview ? `url(${fullBodyPhotoPreview}) center/cover no-repeat` : 'rgba(0, 245, 212, 0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        position: 'relative'
                      }}
                    >
                      {!fullBodyPhotoPreview && (
                        <>
                          <Camera size={32} color="var(--color-accent)" />
                          <span style={{ fontSize: '12px', color: 'var(--color-accent)', marginTop: '8px', fontWeight: '600' }}>
                            Загрузить фото во весь рост
                          </span>
                        </>
                      )}
                    </label>
                  </div>

                  <button 
                    onClick={handleRequestModeration}
                    className={`btn btn-accent ${loading ? 'btn-disabled' : ''}`}
                    disabled={loading}
                    style={{ padding: '16px', fontSize: '15px', borderRadius: '16px', marginTop: '10px' }}
                  >
                    {loading ? 'Отправка на модерацию...' : '🚀 Отправить и Войти в Приложение'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
