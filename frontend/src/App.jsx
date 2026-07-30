import React, { useState, useEffect } from 'react';
import { Flame, MessageCircle, User, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
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
    let stored = localStorage.getItem('scalemate_dev_user_id');
    if (!stored) {
      stored = 'dev_' + Math.floor(100000 + Math.random() * 900000);
      localStorage.setItem('scalemate_dev_user_id', stored);
    }
    return stored;
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
      const tgInit = window.Telegram?.WebApp?.initData;
      if (tgInit) {
        headers['x-tg-init-data'] = tgInit;
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
            onUpdateUser={(updated) => setUser(updated)}
            API_URL={API_URL} 
            tgUserId={devUserId}
          />
        );
        break;
      case 'admin':
        screenContent = (
          <AdminPanel 
            API_URL={API_URL} 
            tgUserId={devUserId}
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

      {/* Screen view rendering */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {screenContent}
      </div>

      {/* Navigation Bar */}
      {user && (
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

          {/* Show Moderation tab ONLY for Admin account */}
          {(
            user?.isAdmin === true ||
            user?.name?.toLowerCase() === 'admin' ||
            user?.username?.toLowerCase() === 'admin' ||
            user?.username?.toLowerCase() === 'jamsenbang' ||
            (user?.height === 250 && user?.weight === 250)
          ) && (
            <div 
              className={`nav-item ${currentTab === 'admin' ? 'active' : ''}`}
              onClick={() => setCurrentTab('admin')}
              style={{ color: 'var(--color-accent)' }}
            >
              <ShieldCheck size={22} />
              <span>Модерация</span>
            </div>
          )}
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
