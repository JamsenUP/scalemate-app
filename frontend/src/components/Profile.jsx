import React from 'react';
import { Scale, Ruler, CheckCircle2, ShieldAlert, AlertCircle, LogOut } from 'lucide-react';

export default function Profile({ user, onReVerify, onResetProfile, onOpenAdmin, onOpenHistory, onOpenFaceCheck, API_URL }) {



  // Determine BMI Category and Color
  const getBmiDetails = (bmi) => {
    if (!bmi) return { label: 'Нет данных', color: '#9f9cb0' };
    if (bmi < 18.5) return { label: 'Дефицит массы тела', color: '#00f5d4' };
    if (bmi >= 18.5 && bmi < 25) return { label: 'Нормальный вес', color: '#00f5d4' };
    if (bmi >= 25 && bmi < 30) return { label: 'Избыточный вес', color: '#ffb703' };
    return { label: 'Ожирение', color: '#ff5f5f' };
  };

  const bmiDetails = getBmiDetails(user.bmi);

  return (
    <div className="screen-container">
      <div className="bg-mesh mesh-1"></div>
      <div className="bg-mesh mesh-2"></div>

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

          {/* Verification Status Badge */}
          {user.isVerified ? (
            <div className="badge-verified" style={{ padding: '6px 12px', fontSize: '12px', gap: '8px', boxShadow: 'var(--shadow-accent)' }}>
              <CheckCircle2 size={14} /> Вес Верифицирован
            </div>
          ) : (
            <div style={{ background: 'rgba(255, 95, 95, 0.1)', border: '1px solid rgba(255, 95, 95, 0.3)', color: '#ff5f5f', padding: '6px 12px', borderRadius: '30px', fontSize: '12px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert size={14} /> Требуется Верификация
            </div>
          )}
        </div>

        {/* Physical Stats Section */}
        <div className="glass" style={{ padding: '20px', borderRadius: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.04)', color: 'var(--color-primary)' }}>
              <Ruler size={20} />
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>РОСТ</span>
              <strong style={{ fontSize: '16px' }}>{user.height} см</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.04)', color: 'var(--color-secondary)' }}>
              <Scale size={20} />
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>ВЕС</span>
              <strong style={{ fontSize: '16px' }}>{user.weight} кг</strong>
            </div>
          </div>
        </div>

        {/* BMI Section */}
        <div className="glass" style={{ padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="input-label" style={{ fontSize: '12px' }}>Индекс Массы Тела (ИМТ)</span>
            <strong style={{ fontSize: '22px', fontFamily: 'var(--font-display)', color: bmiDetails.color }}>
              {user.bmi || '—'}
            </strong>
          </div>
          
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', position: 'relative', overflow: 'hidden' }}>
            <div 
              style={{ 
                height: '100%', 
                width: user.bmi ? `${Math.min(Math.max((user.bmi - 15) * 4, 5), 100)}%` : '0%', 
                background: bmiDetails.color,
                borderRadius: '3px',
                transition: 'width 0.5s ease'
              }}
            ></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>18.5 (Дефицит)</span>
            <span style={{ color: '#00f5d4', fontWeight: 'bold' }}>{bmiDetails.label}</span>
            <span>25.0 (Избыток)</span>
          </div>
        </div>

        {/* Monetization / Action Cards */}
        <div className="glass-premium" style={{ padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h4 style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={16} /> Правила ScaleMate
          </h4>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Мы заботимся об актуальности данных. Вы можете обновить свой вес бесплатно раз в 30 дней.
            Если вы хотите пройти переверификацию веса раньше, вы можете воспользоваться моментальным обновлением.
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


        {/* Test Control / Reset Profile */}
        <button 
          onClick={onResetProfile}
          className="btn"
          style={{ 
            marginTop: '10px', 
            background: 'rgba(255, 95, 95, 0.1)', 
            border: '1px solid rgba(255, 95, 95, 0.2)', 
            boxShadow: 'none', 
            color: '#ff5f5f' 
          }}
        >
          <LogOut size={16} /> Сбросить профиль (для теста)
        </button>

      </div>
    </div>
  );
}
