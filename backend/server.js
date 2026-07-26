import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { db } from './database.js';
import { verifyWeightWithAI, estimateBodyProportionsWithAI, verifyFaceMatchWithAI } from './verification.js';
import { sendMatchNotification, startBot } from './bot.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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
// For simplicity and local testing, we also support passing a custom telegram id in headers/query.
function getTelegramUser(req) {
  const initData = req.headers['x-tg-init-data'];
  const devUserId = req.headers['x-dev-user-id'] || req.query.dev_user_id;

  if (devUserId) {
    return { id: String(devUserId), first_name: 'Тест Пользователь' };
  }

  if (initData) {
    try {
      // Decode initData string (which is a URL-encoded query string)
      const params = new URLSearchParams(initData);
      const userRaw = params.get('user');
      if (userRaw) {
        return JSON.parse(userRaw);
      }
    } catch (e) {
      console.error('Error parsing Telegram user from initData:', e);
    }
  }

  return null;
}

// API Routes

// 1. Get or Create Profile
app.get('/api/profile', (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) {
    return res.status(401).json({ error: 'Не авторизован (Telegram WebApp Session missing)' });
  }

  let user = db.getUser(tgUser.id);
  res.json({ user: user || null });
});

// 2. Register Profile
app.post('/api/register', upload.array('photos', 3), (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const { name, age, gender, preferredGender, height, weight, bio } = req.body;
  
  if (!name || !age || !gender || !preferredGender || !height || !weight) {
    return res.status(400).json({ error: 'Не все обязательные поля заполнены' });
  }

  const photoUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

  let user = db.getUser(tgUser.id);
  
  const profileData = {
    telegramId: String(tgUser.id),
    name,
    age: parseInt(age),
    gender,
    preferredGender,
    height: parseInt(height),
    weight: parseFloat(weight),
    bio,
    photos: photoUrls,
    isVerified: false // Must verify weight after registration
  };

  if (user) {
    user = db.updateUser(user.id, profileData);
  } else {
    user = db.createUser(profileData);
  }

  res.json({ success: true, user });
});

// 3. Weight Verification
app.post('/api/verify-weight', upload.fields([
  { name: 'scalePhoto', maxCount: 1 },
  { name: 'selfiePhoto', maxCount: 1 }
]), async (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const user = db.getUser(tgUser.id);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден. Зарегистрируйтесь сначала.' });
  }

  const files = req.files;
  if (!files || !files.scalePhoto) {
    return res.status(400).json({ error: 'Необходимо загрузить фото весов.' });
  }

  const scalePhotoPath = files.scalePhoto[0].path;
  const selfiePhotoPath = files.selfiePhoto ? files.selfiePhoto[0].path : null;

  try {
    const verificationResult = await verifyWeightWithAI(scalePhotoPath, selfiePhotoPath, user.weight);

    if (verificationResult.success) {
      const updatedUser = db.updateUser(user.id, {
        isVerified: true,
        weight: verificationResult.detectedWeight || user.weight,
        verificationPhoto: `/uploads/${files.scalePhoto[0].filename}`,
        verificationSelfie: selfiePhotoPath ? `/uploads/${files.selfiePhoto[0].filename}` : null,
        verificationDate: new Date().toISOString()
      });

      res.json({ 
        success: true, 
        message: 'Вес успешно верифицирован!', 
        user: updatedUser 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: verificationResult.error || 'AI отклонил верификацию веса.' 
      });
    }
  } catch (error) {
    console.error('Weight verification system error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка верификации' });
  }
});

// 3.5 Request Moderation without Scale (AI Body Estimate + Pending Moderator Approval)
app.post('/api/request-moderation', upload.single('fullBodyPhoto'), async (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const user = db.getUser(tgUser.id);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден.' });
  }

  const photoPath = req.file ? req.file.path : (user.photos && user.photos[0] ? path.join(__dirname, user.photos[0]) : null);
  const photoUrl = req.file ? `/uploads/${req.file.filename}` : (user.photos ? user.photos[0] : null);

  let aiEstimate = { plausible: true, aiComment: 'Ожидает проверки модератора.' };
  if (photoPath && fs.existsSync(photoPath)) {
    try {
      aiEstimate = await estimateBodyProportionsWithAI(photoPath, user.height, user.weight);
    } catch (aiErr) {
      console.warn('AI estimate network warning (non-blocking):', aiErr);
    }
  }

  const updatedUser = db.updateUser(user.id, {
    isVerified: false,
    verificationStatus: 'pending_moderation',
    verificationPhoto: photoUrl,
    aiComment: aiEstimate.aiComment,
    verificationDate: new Date().toISOString()
  });

  res.json({
    success: true,
    message: 'Заявка отправлена на модерацию. Вы можете пользоваться приложением!',
    user: updatedUser,
    aiEstimate
  });
});

// 3.6 Face ID Verification (Check live selfie against profile avatar)
app.post('/api/verify-face', upload.single('faceSelfie'), async (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const user = db.getUser(tgUser.id);
  if (!user || !user.photos || user.photos.length === 0) {
    return res.status(400).json({ error: 'В профиле нет аватарки для сравнения лица.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Необходимо сделать селфи для проверки лица.' });
  }

  const selfiePath = req.file.path;
  const avatarPath = path.join(__dirname, user.photos[0]);

  if (!fs.existsSync(avatarPath)) {
    return res.status(400).json({ error: 'Аватарка профиля не найдена на сервере.' });
  }

  try {
    const faceResult = await verifyFaceMatchWithAI(avatarPath, selfiePath);

    if (faceResult.match) {
      const updatedUser = db.updateUser(user.id, {
        isFaceVerified: true,
        lastFaceCheckDate: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Face ID верифицирован! Ваша личность подтверждена.',
        user: updatedUser,
        reason: faceResult.reason
      });
    } else {
      res.status(400).json({
        success: false,
        error: faceResult.reason || 'Лицо не совпадает с аватаркой профиля.'
      });
    }
  } catch (err) {
    console.error('Face verification failed:', err);
    res.status(500).json({ error: 'Ошибка проверки Face ID' });
  }
});

// 4. Get Swipe Feed
app.get('/api/feed', (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const user = db.getUser(tgUser.id);
  if (!user) {
    return res.status(404).json({ error: 'Профиль не найден' });
  }

  // CRITICAL SECURITY: Unverified users cannot see other profiles!
  if (!user.isVerified) {
    return res.status(403).json({ 
      error: 'Access Denied', 
      message: 'Вы должны верифицировать свой вес, чтобы просматривать ленту.' 
    });
  }

  const feed = db.getSwipeFeed(user.id);
  res.json({ feed });
});

// 5. Swipe (Like / Dislike)
app.post('/api/like', (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const { targetUserId, action } = req.body; // action: 'like' or 'dislike'
  if (!targetUserId || !action) {
    return res.status(400).json({ error: 'Неверные параметры запроса' });
  }

  const user = db.getUser(tgUser.id);
  if (!user || !user.isVerified) {
    return res.status(403).json({ error: 'Доступ ограничен. Сначала пройдите верификацию.' });
  }

  const isMatch = db.addLike(user.id, targetUserId, action);
  
  if (isMatch) {
    const matchedUser = db.getUser(targetUserId);
    if (user.telegramId) {
      sendMatchNotification(user.telegramId, matchedUser.name);
    }
    if (matchedUser.telegramId) {
      sendMatchNotification(matchedUser.telegramId, user.name);
    }
  }

  res.json({ 
    success: true, 
    isMatch,
    matchedUser: isMatch ? db.getUser(targetUserId) : null
  });
});

// 6. Get Matches
app.get('/api/matches', (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const user = db.getUser(tgUser.id);
  if (!user || !user.isVerified) {
    return res.status(403).json({ error: 'Доступ ограничен' });
  }

  const matches = db.getMatches(user.id);
  res.json({ matches });
});

// 7. Get Chat Messages
app.get('/api/chats/:chatId', (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const { chatId } = req.params;
  const user = db.getUser(tgUser.id);
  
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  // Security check: ensure current user is part of the chatId
  const chatMembers = chatId.split('_');
  if (!chatMembers.includes(String(user.id))) {
    return res.status(403).json({ error: 'Доступ к чату запрещен' });
  }

  const messages = db.getMessages(chatId);
  res.json({ messages });
});

// 8. Send Chat Message
app.post('/api/chats/:chatId/message', (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const { chatId } = req.params;
  const { text } = req.body;
  const user = db.getUser(tgUser.id);

  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'Сообщение не может быть пустым' });
  }

  // Security check: ensure current user is part of the chatId
  const chatMembers = chatId.split('_');
  if (!chatMembers.includes(String(user.id))) {
    return res.status(403).json({ error: 'Доступ к чату запрещен' });
  }

  const newMessage = db.addMessage(chatId, user.id, text);
  res.json({ success: true, message: newMessage });
});

// 9. Admin API Routes

app.get('/api/admin/stats', (req, res) => {
  const stats = db.getAdminStats();
  res.json({ stats });
});

app.get('/api/admin/pending', (req, res) => {
  const pending = db.getPendingVerifications();
  res.json({ pending });
});

app.post('/api/admin/approve', (req, res) => {
  const { userId, weightOverride } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId обязателен' });
  }

  const updatedUser = db.approveVerification(userId, weightOverride);
  if (updatedUser) {
    res.json({ success: true, user: updatedUser });
  } else {
    res.status(404).json({ error: 'Пользователь не найден' });
  }
});

app.post('/api/admin/reject', (req, res) => {
  const { userId, reason } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId обязателен' });
  }

  const updatedUser = db.rejectVerification(userId, reason);
  if (updatedUser) {
    res.json({ success: true, user: updatedUser });
  } else {
    res.status(404).json({ error: 'Пользователь не найден' });
  }
});

// 10. Swipe History Routes

app.get('/api/swipe-history', (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const user = db.getUser(tgUser.id);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  const history = db.getSwipeHistory(user.id);
  res.json({ history });
});

app.post('/api/swipe-history/change', (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const user = db.getUser(tgUser.id);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  const { targetUserId, newAction } = req.body;
  if (!targetUserId || !newAction) {
    return res.status(400).json({ error: 'Не все параметры указаны' });
  }

  const isMatch = db.changeSwipeDecision(user.id, targetUserId, newAction);
  
  if (isMatch) {
    const matchedUser = db.getUser(targetUserId);
    if (user.telegramId) {
      sendMatchNotification(user.telegramId, matchedUser.name);
    }
    if (matchedUser.telegramId) {
      sendMatchNotification(matchedUser.telegramId, user.name);
    }
  }

  res.json({ 
    success: true, 
    isMatch,
    matchedUser: isMatch ? db.getUser(targetUserId) : null
  });
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
});


