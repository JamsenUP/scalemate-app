import React, { useState, useEffect } from 'react';
import { Flame, MessageCircle, User, AlertCircle, RefreshCw } from 'lucide-react';
import Register from './components/Register';
import Verification from './components/Verification';
import Deck from './components/Deck';
import Chat from './components/Chat';
import Profile from './components/Profile';
import AdminPanel from './components/AdminPanel';
import SwipeHistory from './components/SwipeHistory';
import FaceCheckModal from './components/FaceCheckModal';


const API_URL = import.meta.env.VITE_API_URL || '';


export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('feed'); // 'feed' | 'chats' | 'profile' | 'admin' | 'history'
  const [activePartnerId, setActivePartnerId] = useState(null);
  const [showFaceCheck, setShowFaceCheck] = useState(false);

  
  // Custom dev testing states (for testing in standard browser)
  const [devUserId, setDevUserId] = useState(() => {
    // Default test user
    return localStorage.getItem('scalemate_dev_user_id') || '1005'; 
  });
  const [tgInitData, setTgInitData] = useState('');
  const [isTelegram, setIsTelegram] = useState(false);



  useEffect(() => {
    // Check if running in Telegram WebApp
    const tg = window.Telegram?.WebApp;
    if (tg && tg.initData) {
      setIsTelegram(true);
      setTgInitData(tg.initData);
      
      // Expand to full height and notify ready
      tg.expand();
      tg.ready();
      
      // Set theme header color
      tg.setHeaderColor('#0a0813');
    }
    
    fetchProfile();
  }, [devUserId]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const headers = {};
      if (isTelegram && window.Telegram?.WebApp?.initData) {
        headers['x-tg-init-data'] = window.Telegram.WebApp.initData;
      } else {
        headers['x-dev-user-id'] = devUserId;
      }

      const response = await fetch(`${API_URL}/api/profile`, { headers });
      const result = await response.json();
      
      if (response.ok && result.user) {
        setUser(result.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSuccess = (registeredUser) => {
    setUser(registeredUser);
  };

  const handleVerificationSuccess = (verifiedUser) => {
    setUser(verifiedUser);
    setCurrentTab('feed');
  };

  const handleResetProfile = async () => {
    if (window.confirm('Вы действительно хотите сбросить профиль для теста?')) {
      // Clear local states
      setUser(null);
      
      // We can just clear database user locally or simulate it by changing devUserId
      const nextId = String(parseInt(devUserId) + 1);
      localStorage.setItem('scalemate_dev_user_id', nextId);
      setDevUserId(nextId);
    }
  };

  const handleSwitchDevUser = (id) => {
    localStorage.setItem('scalemate_dev_user_id', id);
    setDevUserId(id);
    setCurrentTab('feed');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0813', color: '#fff' }}>
        <RefreshCw className="spin" size={32} style={{ animation: 'spin 1.5s linear infinite', color: 'var(--color-primary)' }} />
        <span style={{ marginTop: '15px', color: 'var(--text-muted)', fontSize: '14px' }}>Запуск ScaleMate...</span>
        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // Render correct screen based on profile state
  let screenContent;

  if (!user) {
    // 1. Not registered
    screenContent = (
      <Register 
        onRegister={handleRegisterSuccess} 
        API_URL={API_URL} 
        tgUserId={devUserId} 
      />
    );
  } else if (!user.isVerified && user.verificationStatus !== 'pending_moderation') {
    // 2. Registered but weight not verified and not pending moderation
    screenContent = (
      <Verification 
        user={user} 
        onVerificationSuccess={handleVerificationSuccess} 
        API_URL={API_URL} 
        tgUserId={devUserId} 
      />
    );
  } else {
    // 3. Fully registered and verified
    switch (currentTab) {
      case 'feed':
        screenContent = (
          <Deck 
            user={user} 
            API_URL={API_URL} 
            tgUserId={devUserId} 
            onNavigateToChat={(partnerId) => {
              setActivePartnerId(partnerId);
              setCurrentTab('chats');
            }}
          />
        );
        break;
      case 'chats':
        screenContent = (
          <Chat 
            user={user} 
            API_URL={API_URL} 
            tgUserId={devUserId} 
            activePartnerId={activePartnerId}
            onClearActivePartner={() => setActivePartnerId(null)}
          />
        );
        break;
      case 'profile':
        screenContent = (
          <Profile 
            user={user} 
            onReVerify={() => {
              setUser(prev => ({ ...prev, isVerified: false }));
            }} 
            onResetProfile={handleResetProfile} 
            onOpenAdmin={() => setCurrentTab('admin')}
            onOpenHistory={() => setCurrentTab('history')}
            onOpenFaceCheck={() => setShowFaceCheck(true)}
            API_URL={API_URL} 
          />
        );
        break;
      case 'admin':
        screenContent = (
          <AdminPanel 
            API_URL={API_URL} 
            onBack={() => setCurrentTab('profile')} 
          />
        );
        break;
      case 'history':
        screenContent = (
          <SwipeHistory 
            API_URL={API_URL} 
            tgUserId={devUserId} 
            onBack={() => setCurrentTab('profile')} 
          />
        );
        break;
      default:
        screenContent = <div>Страница не найдена</div>;
    }
  }

  return (
    <>
      {/* Dev Simulator Panel (only shows in normal browser, not inside Telegram) */}
      {!isTelegram && (
        <div style={{
          backgroundColor: '#1b1632',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '10px 15px',
          fontSize: '11px',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          color: '#fff',
          fontFamily: 'monospace'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <AlertCircle size={12} color="var(--color-primary)" />
            <span>DEV SIMULATOR | ID: <strong>{devUserId}</strong></span>
          </div>
          
          <div style={{ display: 'flex', gap: '5px' }}>
            <button 
              onClick={() => setCurrentTab('admin')} 
              style={{ background: 'rgba(0, 245, 212, 0.15)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              🛡️ Модерация
            </button>
            <button 
              onClick={() => handleSwitchDevUser('1001')} 
              style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}
            >
              Алиса (1001)
            </button>
            <button 
              onClick={() => handleSwitchDevUser('1002')} 
              style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}
            >
              Александр (1002)
            </button>

            <input 
              type="text" 
              placeholder="Свой ID"
              style={{ width: '45px', background: '#0a0813', border: '1px solid #ff1493', color: '#fff', borderRadius: '4px', padding: '2px', textAlign: 'center', fontSize: '10px' }}
              value={devUserId}
              onChange={(e) => handleSwitchDevUser(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Screen view rendering */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {screenContent}
      </div>

      {/* Navigation Bar (only show if registered and verified) */}
      {user && user.isVerified && (
        <nav className="navbar">
          <div 
            className={`nav-item ${currentTab === 'feed' ? 'active' : ''}`}
            onClick={() => setCurrentTab('feed')}
          >
            <Flame size={22} />
            <span>Знакомства</span>
          </div>
          <div 
            className={`nav-item ${currentTab === 'chats' ? 'active' : ''}`}
            onClick={() => setCurrentTab('chats')}
          >
            <MessageCircle size={22} />
            <span>Чаты</span>
          </div>
          <div 
            className={`nav-item ${currentTab === 'profile' ? 'active' : ''}`}
            onClick={() => setCurrentTab('profile')}
          >
            <User size={22} />
            <span>Профиль</span>
          </div>
        </nav>
      )}

      {showFaceCheck && (
        <FaceCheckModal 
          user={user}
          API_URL={API_URL}
          tgUserId={devUserId}
          onSuccess={(updatedUser) => {
            setUser(updatedUser);
            setShowFaceCheck(false);
          }}
          onCancel={() => setShowFaceCheck(false)}
        />
      )}
    </>
  );
}
