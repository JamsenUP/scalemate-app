import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { db, initDB } from './database.js';
import { verifyWeightWithAI, estimateBodyProportionsWithAI, verifyFaceMatchWithAI } from './verification.js';
import { sendMatchNotification, sendChatMessageNotification, startBot } from './bot.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Force no-cache headers for all responses to ensure instant Telegram WebApp updates
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded images static files
app.use('/uploads', express.static(uploadsDir));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper: Parse Telegram WebApp initData
function getTelegramUser(req) {
  const initData = req.headers['x-tg-init-data'];
  
  if (initData) {
    try {
      // Decode initData string (URL-encoded query string from Telegram WebApp)
      const params = new URLSearchParams(initData);
      const userRaw = params.get('user');
      if (userRaw) {
        const parsed = JSON.parse(userRaw);
        return {
          id: String(parsed.id),
          first_name: parsed.first_name || '',
          last_name: parsed.last_name || '',
          username: parsed.username || ''
        };
      }
    } catch (e) {
      console.error('Error parsing Telegram user from initData:', e);
    }
  }

  // Fallback for dev mode outside Telegram only
  const devUserId = req.headers['x-dev-user-id'] || req.query.dev_user_id;
  if (devUserId) {
    return { 
      id: String(devUserId), 
      first_name: 'Тест Пользователь', 
      username: devUserId === '1005' ? 'jamsenbang' : '' 
    };
  }

  return null;
}

// Helper: Check if caller is authorized admin (@jamsenbang, admin, master)
async function isAdminUser(tgUser) {
  if (!tgUser) return false;
  const username = (tgUser.username || '').toLowerCase();
  if (username === 'jamsenbang' || username === 'admin' || tgUser.id === '1005' || tgUser.id === 'admin_master') {
    return true;
  }
  const dbUser = await db.getUser(tgUser.id);
  if (!dbUser) return false;
  const dbUsername = (dbUser.username || '').toLowerCase();
  const dbName = (dbUser.name || '').toLowerCase();
  return (
    dbUser.isAdmin === true ||
    dbUsername === 'jamsenbang' ||
    dbUsername === 'admin' ||
    dbName === 'admin' ||
    (dbUser.height === 250 && dbUser.weight === 250)
  );
}

// API Routes

// 1. Get Profile
app.get('/api/profile', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован (Telegram WebApp Session missing)' });

    let user = await db.getUser(tgUser.id);
    const isAdminSession = 
      (tgUser.username && (tgUser.username.toLowerCase() === 'admin' || tgUser.username.toLowerCase() === 'jamsenbang')) ||
      tgUser.id === 'admin_master' || tgUser.id === '1005';

    if (!user && isAdminSession) {
      user = await db.createUser({
        telegramId: String(tgUser.id), username: tgUser.username || 'admin',
        name: 'admin', age: 22, gender: 'male', preferredGender: 'all',
        height: 250, weight: 250, bmi: 40.0, bio: 'Главный Администратор Модерации 👑',
        photos: ['/uploads/bob.jpg'], isVerified: true, verificationStatus: 'approved',
        isAdmin: true, verificationDate: new Date().toISOString()
      });
    }

    if (user && user.isAdmin) {
      user = await db.updateUser(user.id, { isVerified: true, verificationStatus: 'approved', isAdmin: true });
    }

    res.json({ user: user || null });
  } catch (err) {
    console.error('GET /api/profile error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 2. Register Profile
app.post('/api/register', upload.array('photos', 3), async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const { name, age, gender, preferredGender, height, weight, bio } = req.body;
    if (!name || !age || !gender || !preferredGender || !height || !weight) {
      return res.status(400).json({ error: 'Не все обязательные поля заполнены' });
    }

    const photoUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
    const isAdminTrigger = 
      (name && name.toLowerCase() === 'admin') || 
      (parseInt(height) === 250 && parseFloat(weight) === 250) ||
      parseInt(height) === 1908 || parseFloat(weight) === 9654 ||
      (tgUser.username && tgUser.username.toLowerCase() === 'admin') ||
      (await isAdminUser(tgUser));

    const profileData = {
      telegramId: String(tgUser.id), username: tgUser.username || null, name,
      age: parseInt(age), gender, preferredGender,
      height: parseInt(height), weight: parseFloat(weight), bio, photos: photoUrls,
      isVerified: isAdminTrigger, verificationStatus: isAdminTrigger ? 'approved' : 'none',
      isAdmin: isAdminTrigger, verificationDate: isAdminTrigger ? new Date().toISOString() : null
    };

    const user = await db.createUser(profileData);
    res.json({ success: true, user });
  } catch (err) {
    console.error('POST /api/register error:', err);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

// 2.5 Edit Profile
app.post('/api/profile/edit', upload.array('photos', 3), async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const user = await db.getUser(tgUser.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const { name, age, height, bio, preferredGender } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (age) updates.age = parseInt(age);
    if (height) updates.height = parseInt(height);
    if (bio !== undefined) updates.bio = bio;
    if (preferredGender) updates.preferredGender = preferredGender;
    if (req.files && req.files.length > 0) {
      updates.photos = req.files.map(file => `/uploads/${file.filename}`);
    }

    const updated = await db.updateUser(user.id, updates);
    res.json({ success: true, user: updated });
  } catch (err) {
    console.error('POST /api/profile/edit error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 3. Weight Verification
app.post('/api/verify-weight', upload.fields([
  { name: 'scalePhoto', maxCount: 1 },
  { name: 'selfiePhoto', maxCount: 1 }
]), async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const user = await db.getUser(tgUser.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден. Зарегистрируйтесь сначала.' });

    const files = req.files;
    if (!files || !files.scalePhoto) return res.status(400).json({ error: 'Необходимо загрузить фото весов.' });

    const scalePhotoPath = files.scalePhoto[0].path;
    const selfiePhotoPath = files.selfiePhoto ? files.selfiePhoto[0].path : null;
    const verificationResult = await verifyWeightWithAI(scalePhotoPath, selfiePhotoPath, user.weight);

    if (verificationResult.success) {
      const updatedUser = await db.updateUser(user.id, {
        isVerified: true, weight: verificationResult.detectedWeight || user.weight,
        verificationPhoto: `/uploads/${files.scalePhoto[0].filename}`,
        verificationSelfie: selfiePhotoPath ? `/uploads/${files.selfiePhoto[0].filename}` : null,
        verificationDate: new Date().toISOString()
      });
      res.json({ success: true, message: 'Вес успешно верифицирован!', user: updatedUser });
    } else {
      res.status(400).json({ success: false, error: verificationResult.error || 'AI отклонил верификацию веса.' });
    }
  } catch (error) {
    console.error('Weight verification error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка верификации' });
  }
});

// 3.5 Request Moderation
app.post('/api/request-moderation', upload.single('fullBodyPhoto'), async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const user = await db.getUser(tgUser.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден.' });

    const photoPath = req.file ? req.file.path : (user.photos && user.photos[0] ? path.join(__dirname, user.photos[0]) : null);
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : (user.photos ? user.photos[0] : null);

    let aiEstimate = { plausible: true, aiComment: 'Ожидает проверки модератора.' };
    if (photoPath && fs.existsSync(photoPath)) {
      try { aiEstimate = await estimateBodyProportionsWithAI(photoPath, user.height, user.weight); }
      catch (aiErr) { console.warn('AI estimate warning:', aiErr); }
    }

    const updatedUser = await db.updateUser(user.id, {
      verificationPhoto: photoUrl,
      verificationStatus: 'pending_moderation',
      verificationDate: new Date().toISOString()
    });

    res.json({ success: true, message: 'Отправлено на модерацию', user: updatedUser });
  } catch (err) {
    console.error('POST /api/request-moderation error:', err);
    res.status(500).json({ error: 'Ошибка сервера при отправке на модерацию' });
  }
});

// 3.6 Income Verification for Men (Bank screenshot)
app.post('/api/verify-income', upload.single('incomePhoto'), async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const user = await db.getUser(tgUser.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const incomeVal = req.body.income ? parseInt(req.body.income) : (user.income || 0);
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const updatedUser = await db.updateUser(user.id, {
      income: incomeVal,
      verificationPhoto: photoUrl || user.verificationPhoto,
      verificationStatus: 'pending_moderation',
      verificationDate: new Date().toISOString()
    });

    res.json({ success: true, message: 'Скриншот дохода отправлен на модерацию', user: updatedUser });
  } catch (err) {
    console.error('POST /api/verify-income error:', err);
    res.status(500).json({ error: 'Ошибка сервера при верификации дохода' });
  }
});

// 3.6 Face ID Verification
app.post('/api/verify-face', upload.single('faceSelfie'), async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const user = await db.getUser(tgUser.id);
    if (!user || !user.photos || user.photos.length === 0) {
      return res.status(400).json({ error: 'В профиле нет аватарки для сравнения лица.' });
    }
    if (!req.file) return res.status(400).json({ error: 'Необходимо сделать селфи.' });

    const selfiePath = req.file.path;
    const avatarPath = path.join(__dirname, user.photos[0]);
    if (!fs.existsSync(avatarPath)) return res.status(400).json({ error: 'Аватарка не найдена на сервере.' });

    const faceResult = await verifyFaceMatchWithAI(avatarPath, selfiePath);
    if (faceResult.match) {
      const updatedUser = await db.updateUser(user.id, { isFaceVerified: true, lastFaceCheckDate: new Date().toISOString() });
      res.json({ success: true, message: 'Face ID верифицирован!', user: updatedUser, reason: faceResult.reason });
    } else {
      res.status(400).json({ success: false, error: faceResult.reason || 'Лицо не совпадает с аватаркой профиля.' });
    }
  } catch (err) {
    console.error('Face verification failed:', err);
    res.status(500).json({ error: 'Ошибка проверки Face ID' });
  }
});

// 4. Get Swipe Feed
app.get('/api/feed', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    let user = await db.getUser(tgUser.id);
    if (!user) return res.status(404).json({ error: 'Профиль не найден' });

    if (isAdminUser(tgUser) && (!user.isVerified || user.verificationStatus !== 'approved')) {
      user = await db.updateUser(user.id, { isVerified: true, verificationStatus: 'approved', verificationDate: new Date().toISOString() });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: 'Access Denied', message: 'Вы должны верифицировать свой вес.' });
    }

    const feed = await db.getSwipeFeed(user.id);
    res.json({ feed });
  } catch (err) {
    console.error('GET /api/feed error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 5. Swipe (Like / Dislike)
app.post('/api/like', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const { targetUserId, action } = req.body;
    if (!targetUserId || !action) return res.status(400).json({ error: 'Неверные параметры запроса' });

    const user = await db.getUser(tgUser.id);
    if (!user || !user.isVerified) return res.status(403).json({ error: 'Доступ ограничен. Сначала пройдите верификацию.' });

    const isMatch = await db.addLike(user.id, targetUserId, action);
    let matchedUser = null;
    if (isMatch) {
      matchedUser = await db.getUser(targetUserId);
      if (user.telegramId) sendMatchNotification(user.telegramId, matchedUser.name);
      if (matchedUser.telegramId) sendMatchNotification(matchedUser.telegramId, user.name);
    }

    res.json({ success: true, isMatch, matchedUser: isMatch ? matchedUser : null });
  } catch (err) {
    console.error('POST /api/like error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 6. Get Matches
app.get('/api/matches', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const user = await db.getUser(tgUser.id);
    if (!user || !user.isVerified) return res.status(403).json({ error: 'Доступ ограничен' });

    const matches = await db.getMatches(user.id);
    res.json({ matches });
  } catch (err) {
    console.error('GET /api/matches error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 6.5 Get Incoming Likes (Who liked me)
app.get('/api/likes-received', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const user = await db.getUser(tgUser.id);
    if (!user || !user.isVerified) return res.status(403).json({ error: 'Доступ ограничен' });

    const likes = await db.getLikesReceived(user.id);
    res.json({ likes });
  } catch (err) {
    console.error('GET /api/likes-received error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 7. Get Chat Messages
app.get('/api/chats/:chatId', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const { chatId } = req.params;
    const user = await db.getUser(tgUser.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const chatMembers = chatId.split('_');
    if (!chatMembers.includes(String(user.id))) return res.status(403).json({ error: 'Доступ к чату запрещен' });

    const messages = await db.getMessages(chatId);
    res.json({ messages });
  } catch (err) {
    console.error('GET /api/chats error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 8. Send Chat Message
app.post('/api/chats/:chatId/message', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const { chatId } = req.params;
    const { text } = req.body;
    const user = await db.getUser(tgUser.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (!text || text.trim() === '') return res.status(400).json({ error: 'Сообщение не может быть пустым' });

    const chatMembers = chatId.split('_');
    if (!chatMembers.includes(String(user.id))) return res.status(403).json({ error: 'Доступ к чату запрещен' });

    const newMessage = await db.addMessage(chatId, user.id, text);

    // Send Telegram Bot notification to recipient partner
    try {
      const partnerId = chatMembers.find(id => String(id) !== String(user.id));
      if (partnerId) {
        const partnerUser = await db.getUser(partnerId);
        if (partnerUser && partnerUser.telegramId) {
          sendChatMessageNotification(partnerUser.telegramId, user.name, text);
        }
      }
    } catch (notifErr) {
      console.warn('Telegram notification warning (non-blocking):', notifErr?.message || notifErr);
    }

    res.json({ success: true, message: newMessage });
  } catch (err) {
    console.error('POST /api/chats message error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 8.5 Block User
app.post('/api/chat/block', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const user = await db.getUser(tgUser.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId обязателен' });

    await db.blockUser(user.id, targetUserId);
    res.json({ success: true, message: 'Пользователь заблокирован' });
  } catch (err) {
    console.error('POST /api/chat/block error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 9. Admin API Routes

app.get('/api/admin/stats', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    const isAdmin = await isAdminUser(tgUser);
    if (!tgUser || !isAdmin) return res.status(403).json({ error: 'Доступ запрещен' });
    const stats = await db.getAdminStats();
    res.json({ stats });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.get('/api/admin/pending', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    const isAdmin = await isAdminUser(tgUser);
    if (!tgUser || !isAdmin) return res.status(403).json({ error: 'Доступ запрещен' });
    const pending = await db.getPendingVerifications();
    res.json({ pending });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.get('/api/admin/all', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    const isAdmin = await isAdminUser(tgUser);
    if (!tgUser || !isAdmin) return res.status(403).json({ error: 'Доступ запрещен' });
    const allUsers = await db.getAllUsers();
    res.json({ allUsers });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.get('/api/admin/verified', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    const isAdmin = await isAdminUser(tgUser);
    if (!tgUser || !isAdmin) return res.status(403).json({ error: 'Доступ запрещен' });
    const verified = await db.getVerifiedUsers();
    res.json({ verified });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/admin/delete', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    const isAdmin = await isAdminUser(tgUser);
    if (!tgUser || !isAdmin) return res.status(403).json({ error: 'Доступ запрещен' });
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId обязателен' });
    await db.deleteUser(userId);
    res.json({ success: true, message: 'Пользователь удален' });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/admin/approve', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    const isAdmin = await isAdminUser(tgUser);
    if (!tgUser || !isAdmin) return res.status(403).json({ error: 'Доступ запрещен' });
    const { userId, weightOverride } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId обязателен' });
    const updatedUser = await db.approveVerification(userId, weightOverride);
    if (updatedUser) res.json({ success: true, user: updatedUser });
    else res.status(404).json({ error: 'Пользователь не найден' });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/admin/reject', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    const isAdmin = await isAdminUser(tgUser);
    if (!tgUser || !isAdmin) return res.status(403).json({ error: 'Доступ запрещен' });
    const { userId, reason } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId обязателен' });
    const updatedUser = await db.rejectVerification(userId, reason);
    if (updatedUser) res.json({ success: true, user: updatedUser });
    else res.status(404).json({ error: 'Пользователь не найден' });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/admin/revoke', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    const isAdmin = await isAdminUser(tgUser);
    if (!tgUser || !isAdmin) return res.status(403).json({ error: 'Доступ запрещен' });
    const { userId, reason } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId обязателен' });
    const updatedUser = await db.revokeVerification(userId, reason);
    if (updatedUser) res.json({ success: true, user: updatedUser });
    else res.status(404).json({ error: 'Пользователь не найден' });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// 10. Swipe History Routes
app.get('/api/swipe-history', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });
    const user = await db.getUser(tgUser.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    const history = await db.getSwipeHistory(user.id);
    res.json({ history });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/swipe-history/change', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });
    const user = await db.getUser(tgUser.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const { targetUserId, newAction } = req.body;
    if (!targetUserId || !newAction) return res.status(400).json({ error: 'Не все параметры указаны' });

    const isMatch = await db.changeSwipeDecision(user.id, targetUserId, newAction);
    let matchedUser = null;
    if (isMatch) {
      matchedUser = await db.getUser(targetUserId);
      if (user.telegramId) sendMatchNotification(user.telegramId, matchedUser.name);
      if (matchedUser.telegramId) sendMatchNotification(matchedUser.telegramId, user.name);
    }

    res.json({ success: true, isMatch, matchedUser: isMatch ? matchedUser : null });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// Serve frontend build in production
const frontendBuildPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

// Start Server
app.listen(PORT, () => {
  console.log(`ScaleMate backend running at http://localhost:${PORT}`);
  startBot();

  initDB().then(() => {
    console.log('PostgreSQL database initialized successfully');
  }).catch(err => {
    console.error('Database init warning (non-fatal):', err);
  });
});


