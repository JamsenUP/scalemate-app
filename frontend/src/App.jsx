import React, { useState, useEffect } from 'react';
import { Flame, MessageCircle, User, ShieldCheck, AlertCircle, RefreshCw, Trophy, MessageSquare, Ban, Shuffle } from 'lucide-react';
import Register from './components/Register';
import Verification from './components/Verification';
import Deck from './components/Deck';
import Chat from './components/Chat';
import Profile from './components/Profile';
import AdminPanel from './components/AdminPanel';
import SwipeHistory from './components/SwipeHistory';
import FaceCheckModal from './components/FaceCheckModal';
import Leaderboard from './components/Leaderboard';
import DateStories from './components/DateStories';
import AnonChat from './components/AnonChat';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function App() {
  const [user, setUser] = useState(null);
  const [bannedInfo, setBannedInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('feed'); // 'feed' | 'anon_chat' | 'leaderboard' | 'stories' | 'chats' | 'profile' | 'admin' | 'history'
  const [activePartnerId, setActivePartnerId] = useState(null);
  const [showFaceCheck, setShowFaceCheck] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

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
    const tg = window.Telegram?.WebApp;
    if (tg && tg.initData) {
      setIsTelegram(true);
      setTgInitData(tg.initData);
      tg.expand();
      tg.ready();
      tg.setHeaderColor('#0a0813');
    }
    
    fetchProfile();
  }, [devUserId]);

  const fetchProfile = async () => {
    setLoading(true);
    setBannedInfo(null);
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
      
      if (response.status === 403 && result.banned) {
        setBannedInfo(result);
        setUser(null);
      } else if (response.ok && result.user) {
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
      setUser(null);
      const nextId = String(parseInt(devUserId) + 1);
      localStorage.setItem('scalemate_dev_user_id', nextId);
      setDevUserId(nextId);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0813', color: '#fff' }}>
        <RefreshCw className="spin" size={32} style={{ animation: 'spin 1.5s linear infinite', color: 'var(--color-primary)' }} />
        <span style={{ marginTop: '15px', color: 'var(--text-muted)', fontSize: '14px' }}>Запуск ScaleMate...</span>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Banned Screen Overlay (Requirement #3)
  if (bannedInfo) {
    return (
      <div className="screen-container" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '20px' }}>
        <div className="bg-mesh mesh-1"></div>
        <div className="glass-premium" style={{ padding: '40px 24px', borderRadius: '28px', maxWidth: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(255, 95, 95, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #ff5f5f' }}>
            <Ban size={36} color="#ff5f5f" />
          </div>
          <h2 style={{ fontSize: '24px', color: '#ff5f5f' }}>Аккаунт заблокирован</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.5' }}>
            {bannedInfo.banReason || 'Ваш профиль был заблокирован администрацией за нарушение правил безопасности.'}
          </p>
          <div style={{ fontSize: '12px', color: '#ffd700', background: 'rgba(255, 215, 0, 0.1)', padding: '6px 12px', borderRadius: '12px' }}>
            Предупреждений: {bannedInfo.warningsCount || 3}/3
          </div>
        </div>
      </div>
    );
  }

  // Render correct screen based on profile state
  let screenContent;

  if (!user) {
    screenContent = (
      <Register 
        onRegister={handleRegisterSuccess} 
        API_URL={API_URL} 
        tgUserId={devUserId} 
      />
    );
  } else if (!user.isVerified && user.verificationStatus !== 'pending_moderation') {
    screenContent = (
      <Verification 
        user={user} 
        onVerificationSuccess={handleVerificationSuccess} 
        API_URL={API_URL} 
        tgUserId={devUserId} 
      />
    );
  } else {
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
      case 'anon_chat':
        screenContent = (
          <AnonChat 
            user={user}
            API_URL={API_URL}
            tgUserId={devUserId}
            onNavigateToChats={() => setCurrentTab('chats')}
          />
        );
        break;
      case 'leaderboard':
        screenContent = (
          <Leaderboard 
            user={user}
            API_URL={API_URL}
            tgUserId={devUserId}
          />
        );
        break;
      case 'stories':
        screenContent = (
          <DateStories 
            user={user}
            API_URL={API_URL}
            tgUserId={devUserId}
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
            onChatOpenChange={(open) => setIsChatOpen(open)}
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
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {screenContent}
      </div>

      {/* Navigation Bar */}
      {user && !isChatOpen && (
        <nav className="navbar">
          <div 
            className={`nav-item ${currentTab === 'feed' ? 'active' : ''}`}
            onClick={() => { setIsChatOpen(false); setCurrentTab('feed'); }}
          >
            <Flame size={20} />
            <span>Знакомства</span>
          </div>

          <div 
            className={`nav-item ${currentTab === 'anon_chat' ? 'active' : ''}`}
            onClick={() => { setIsChatOpen(false); setCurrentTab('anon_chat'); }}
          >
            <Shuffle size={20} />
            <span>Рулетка</span>
          </div>

          <div 
            className={`nav-item ${currentTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => { setIsChatOpen(false); setCurrentTab('leaderboard'); }}
          >
            <Trophy size={20} />
            <span>Топ</span>
          </div>

          <div 
            className={`nav-item ${currentTab === 'stories' ? 'active' : ''}`}
            onClick={() => { setIsChatOpen(false); setCurrentTab('stories'); }}
          >
            <MessageSquare size={20} />
            <span>Форум</span>
          </div>

          <div 
            className={`nav-item ${currentTab === 'chats' ? 'active' : ''}`}
            onClick={() => { setIsChatOpen(false); setCurrentTab('chats'); }}
          >
            <MessageCircle size={20} />
            <span>Чаты</span>
          </div>

          <div 
            className={`nav-item ${currentTab === 'profile' ? 'active' : ''}`}
            onClick={() => { setIsChatOpen(false); setCurrentTab('profile'); }}
          >
            <User size={20} />
            <span>Профиль</span>
          </div>

          {(
            user?.isAdmin === true ||
            user?.name?.toLowerCase() === 'admin' ||
            user?.username?.toLowerCase() === 'admin' ||
            user?.username?.toLowerCase() === 'scalemate_dating' ||
            user?.username?.toLowerCase() === 'jamsenbang' ||
            (user?.height === 250 && user?.weight === 250)
          ) && (
            <div 
              className={`nav-item ${currentTab === 'admin' ? 'active' : ''}`}
              onClick={() => { setIsChatOpen(false); setCurrentTab('admin'); }}
              style={{ color: 'var(--color-accent)' }}
            >
              <ShieldCheck size={20} />
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
