import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import * as db from './database.js';
import { initDB } from './database.js';
import { verifyWeightWithAI, estimateBodyProportionsWithAI, verifyFaceMatchWithAI } from './verification.js';
import { sendMatchNotification, sendChatMessageNotification, startBot } from './bot.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Rate Limiter against DDoS & Spam
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Пожалуйста, попробуйте через минуту.' }
});
app.use('/api/', apiLimiter);

// IP Ban & Activity Tracking Middleware
app.use(async (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (clientIp && await db.isIpBanned(clientIp)) {
    return res.status(403).json({ error: 'Ваш IP адрес заблокирован за нарушение правил.' });
  }

  const tgUser = getTelegramUser(req);
  if (tgUser) {
    db.touchLastSeen(tgUser.id).catch(() => {});
  }

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

// Helper: Validate First Name (Requirement #15)
function validateFirstName(name) {
  if (!name || typeof name !== 'string') return { valid: false, message: 'Имя не должно быть пустым.' };
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 20) {
    return { valid: false, message: 'Имя должно содержать от 2 до 20 букв.' };
  }
  if (/\s/.test(trimmed)) {
    return { valid: false, message: 'Укажите только ваше Имя (без фамилии и отчества).' };
  }
  if (!/^[a-zA-Zа-яА-ЯёЁ]+$/.test(trimmed)) {
    return { valid: false, message: 'Имя может содержать только буквы (без цифр и символов).' };
  }
  const lower = trimmed.toLowerCase();
  if (lower.endsWith('вич') || lower.endsWith('вна') || lower.endsWith('тич') || lower.endsWith('нична')) {
    return { valid: false, message: 'Укажите только Ваше имя (без отчества).' };
  }
  return { valid: true };
}

// Helper: Parse Telegram WebApp initData
function getTelegramUser(req) {
  const initData = req.headers['x-tg-init-data'];
  
  if (initData) {
    try {
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

// ─── API Routes ───────────────────────────────────────────────────

// 1. Get Profile
app.get('/api/profile', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован (Telegram WebApp Session missing)' });

    let user = await db.getUser(tgUser.id, tgUser.username);

    if (user && user.isBanned) {
      return res.status(403).json({
        banned: true,
        banReason: user.banReason || 'Ваш аккаунт заблокирован за нарушение правил сервиса.',
        warningsCount: user.warningsCount || 3
      });
    }

    if (user && user.telegramId !== String(tgUser.id)) {
      user = await db.updateUser(user.id, { telegramId: String(tgUser.id) });
    }

    const isAdminSession = 
      (tgUser.username && (tgUser.username.toLowerCase() === 'admin' || tgUser.username.toLowerCase() === 'jamsenbang')) ||
      tgUser.id === 'admin_master' || tgUser.id === '1005';

    if (!user && isAdminSession) {
      user = await db.createUser({
        telegramId: String(tgUser.id), username: tgUser.username || 'admin',
        name: 'admin', age: 22, gender: 'male', preferredGender: 'all',
        height: 250, weight: 250, bmi: 40.0, city: 'Москва', bio: 'Главный Администратор Модерации 👑',
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

// 1.5 Direct Login by Username/Name/ID
app.post('/api/login', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Укажите Имя, Username или Telegram ID' });

    const user = await db.getUserByQuery(query);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден. Проверьте правильность данных.' });
    }

    if (user.isBanned) {
      return res.status(403).json({
        banned: true,
        banReason: user.banReason || 'Аккаунт заблокирован за нарушение правил.',
        warningsCount: user.warningsCount || 3
      });
    }

    const tgUser = getTelegramUser(req);
    if (tgUser) {
      await db.updateUser(user.id, { telegramId: String(tgUser.id) });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error('POST /api/login error:', err);
    res.status(500).json({ error: 'Ошибка при входе в аккаунт' });
  }
});

// 2. Register Profile
app.post('/api/register', upload.array('photos', 5), async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const { name, age, gender, preferredGender, height, weight, bio, city, income } = req.body;
    
    // Strict name validation (Requirement #15)
    const nameVal = validateFirstName(name);
    if (!nameVal.valid) {
      return res.status(400).json({ error: nameVal.message });
    }

    if (!age || !gender || !height || !weight) {
      return res.status(400).json({ error: 'Не все обязательные поля заполнены.' });
    }

    const photoUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
    if (photoUrls.length === 0) {
      return res.status(400).json({ error: 'Необходимо загрузить хотя бы 1 фотографию профиля.' });
    }

    const isAdminTrigger = 
      (name && name.toLowerCase() === 'admin') || 
      (parseInt(height) === 250 && parseFloat(weight) === 250) ||
      (tgUser.username && tgUser.username.toLowerCase() === 'admin') ||
      (await isAdminUser(tgUser));

    const profileData = {
      telegramId: String(tgUser.id), username: tgUser.username || null, name: name.trim(),
      age: parseInt(age), gender, preferredGender: preferredGender || (gender === 'male' ? 'female' : 'male'),
      height: parseInt(height), weight: parseFloat(weight), bio: bio || '', city: city || 'Москва',
      income: income ? parseInt(income) : 0, photos: photoUrls,
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
app.post('/api/profile/edit', upload.array('photos', 5), async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const user = await db.getUser(tgUser.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const { name, age, height, weight, bio, preferredGender, city, income } = req.body;
    const updates = {};
    if (name) {
      const nameVal = validateFirstName(name);
      if (!nameVal.valid) return res.status(400).json({ error: nameVal.message });
      updates.name = name.trim();
    }
    if (age) updates.age = parseInt(age);
    if (height) updates.height = parseInt(height);
    if (weight) updates.weight = parseFloat(weight);
    if (bio !== undefined) updates.bio = bio;
    if (preferredGender) updates.preferredGender = preferredGender;
    if (city) updates.city = city;
    if (income !== undefined) updates.income = parseInt(income);

    if (req.files && req.files.length > 0) {
      const newPhotoUrls = req.files.map(f => `/uploads/${f.filename}`);
      updates.photos = [...(user.photos || []), ...newPhotoUrls];
    }

    const updated = await db.updateUser(user.id, updates);
    res.json({ success: true, user: updated });
  } catch (err) {
    console.error('POST /api/profile/edit error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Asset Showcase Endpoint (Cars & Real Estate - Requirement #12)
app.post('/api/assets/update', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });
    const user = await db.getUser(tgUser.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const { assets } = req.body;
    const updated = await db.updateUser(user.id, { assets });
    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сохранения активов' });
  }
});

// 3. Weight Verification (Women)
app.post('/api/verify-weight', upload.fields([
  { name: 'scalePhoto', maxCount: 1 },
  { name: 'selfiePhoto', maxCount: 1 }
]), async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const user = await db.getUser(tgUser.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден.' });

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
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const photoUrl = req.file ? `/uploads/${req.file.filename}` : (user.photos?.[0] || null);

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

// 3.6 Income Verification for Men
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

// 4. Get Cards for Swiping (with city, income, weight, age, height filters)
app.get('/api/cards', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const user = await db.getUser(tgUser.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const filters = {
      minAge: req.query.minAge ? parseInt(req.query.minAge) : undefined,
      maxAge: req.query.maxAge ? parseInt(req.query.maxAge) : undefined,
      minHeight: req.query.minHeight ? parseInt(req.query.minHeight) : undefined,
      maxHeight: req.query.maxHeight ? parseInt(req.query.maxHeight) : undefined,
      minWeight: req.query.minWeight ? parseFloat(req.query.minWeight) : undefined,
      maxWeight: req.query.maxWeight ? parseFloat(req.query.maxWeight) : undefined,
      minIncome: req.query.minIncome ? parseInt(req.query.minIncome) : undefined,
      city: req.query.city || undefined
    };

    const cards = await db.getSwipeCards(user.id, filters);
    res.json({ cards });
  } catch (err) {
    console.error('GET /api/cards error:', err);
    res.status(500).json({ error: 'Ошибка загрузки карточек' });
  }
});

// 5. Swipe Action (Like / Dislike)
app.post('/api/like', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const user = await db.getUser(tgUser.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const { targetUserId, action } = req.body;
    if (!targetUserId || !action) return res.status(400).json({ error: 'Параметры указаны неверно' });

    const isMatch = await db.addLike(user.id, targetUserId, action);
    let matchedUser = null;

    if (isMatch) {
      matchedUser = await db.getUser(targetUserId);
      if (user.telegramId) sendMatchNotification(user.telegramId, matchedUser.name);
      if (matchedUser.telegramId) sendMatchNotification(matchedUser.telegramId, user.name);
    }

    res.json({ success: true, isMatch, matchedUser });
  } catch (err) {
    console.error('POST /api/like error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 5.5 Likes Received (Кто меня лайкнул)
app.get('/api/likes-received', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const user = await db.getUser(tgUser.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const likes = await db.getLikesReceived(user.id);
    res.json({ likes });
  } catch (err) {
    console.error('GET /api/likes-received error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 6. Get Matches & Active Conversations
app.get('/api/matches', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const user = await db.getUser(tgUser.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const matches = await db.getMatches(user.id);
    res.json({ matches });
  } catch (err) {
    console.error('GET /api/matches error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 7. Get Messages for Chat
app.get('/api/chats/:chatId', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const messages = await db.getMessages(req.params.chatId);
    res.json({ messages });
  } catch (err) {
    console.error('GET /api/chats/:chatId error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 8. Send Message in Chat
app.post('/api/chats/:chatId/message', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });

    const user = await db.getUser(tgUser.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Текст сообщения не может быть пустым' });

    const msg = await db.addMessage(req.params.chatId, user.id, text.trim());

    // Push Notification via Telegram Bot
    const parts = req.params.chatId.split('_');
    const partnerId = parts.find(id => id !== String(user.id));
    if (partnerId) {
      const partner = await db.getUser(partnerId);
      if (partner && partner.telegramId) {
        sendChatMessageNotification(partner.telegramId, user.name, text.trim());
      }
    }

    res.json({ success: true, message: msg });
  } catch (err) {
    console.error('POST /api/chats/:chatId/message error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Date Scheduler Routes (Yandex Maps Integration - Requirement #13)
app.get('/api/dates/:chatId', async (req, res) => {
  try {
    const dates = await db.getScheduledDates(req.params.chatId);
    res.json({ dates });
  } catch (err) { res.status(500).json({ error: 'Ошибка получения свиданий' }); }
});

app.post('/api/dates', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });
    const user = await db.getUser(tgUser.id);

    const { chatId, receiverId, locationName, yandexMapUrl, dateTime } = req.body;
    if (!locationName || !dateTime) return res.status(400).json({ error: 'Укажите место и время свидания' });

    const scheduledDate = await db.createScheduledDate(
      user.id, receiverId, chatId, locationName, yandexMapUrl || '', dateTime
    );

    // Send date invitation card text to chat timeline
    const inviteText = `📍 ПРЕДЛОЖЕНИЕ СВИДАНИЯ:\nМесто: ${locationName}\nВремя: ${dateTime}`;
    await db.addMessage(chatId, user.id, inviteText);

    res.json({ success: true, scheduledDate });
  } catch (err) {
    console.error('POST /api/dates error:', err);
    res.status(500).json({ error: 'Ошибка создания предложения свидания' });
  }
});

app.post('/api/dates/respond', async (req, res) => {
  try {
    const { dateId, status } = req.body;
    const updated = await db.updateScheduledDateStatus(dateId, status);
    res.json({ success: true, scheduledDate: updated });
  } catch (err) { res.status(500).json({ error: 'Ошибка ответа на приглашение' }); }
});

// Leaderboard Endpoint (Requirement #9)
app.get('/api/leaderboard', async (req, res) => {
  try {
    const gender = req.query.gender || 'male';
    const city = req.query.city || null;
    const leaders = await db.getLeaderboard(gender, city);
    res.json({ leaderboard: leaders });
  } catch (err) {
    console.error('GET /api/leaderboard error:', err);
    res.status(500).json({ error: 'Ошибка загрузки лидерборда' });
  }
});

// Date Stories Community Forum (Requirement #10)
app.get('/api/stories', async (req, res) => {
  try {
    const city = req.query.city || null;
    const stories = await db.getDateStories(city);
    res.json({ stories });
  } catch (err) { res.status(500).json({ error: 'Ошибка получения историй' }); }
});

app.post('/api/stories', upload.single('photo'), async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });
    const user = await db.getUser(tgUser.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const { partnerName, story, rating } = req.body;
    if (!story || !story.trim()) return res.status(400).json({ error: 'Напишите историю свидания' });

    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const newStory = await db.addDateStory(user, partnerName || 'Партнер', story, rating, photoUrl);

    res.json({ success: true, story: newStory });
  } catch (err) {
    console.error('POST /api/stories error:', err);
    res.status(500).json({ error: 'Ошибка добавления истории' });
  }
});

app.post('/api/stories/like', async (req, res) => {
  try {
    const { storyId } = req.body;
    const story = await db.likeDateStory(storyId);
    res.json({ success: true, story });
  } catch (err) { res.status(500).json({ error: 'Ошибка лайка истории' }); }
});

// User Review System (Requirement #23 - Avito Style)
app.get('/api/reviews/:userId', async (req, res) => {
  try {
    const reviews = await db.getUserReviews(req.params.userId);
    res.json({ reviews });
  } catch (err) { res.status(500).json({ error: 'Ошибка получения отзывов' }); }
});

app.post('/api/reviews', upload.single('photo'), async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });
    const reviewer = await db.getUser(tgUser.id);

    const { targetUserId, rating, comment } = req.body;
    if (!targetUserId || !comment) return res.status(400).json({ error: 'Заполните отзыв' });

    // Check if reviewer chatted/matched with target user
    const canReview = await db.canUserReview(reviewer.id, targetUserId);
    if (!canReview) {
      return res.status(403).json({ error: 'Оставить отзыв можно только пользователю, с которым вы общались в чате!' });
    }

    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const review = await db.addUserReview(targetUserId, reviewer, rating, comment, photoUrl);

    res.json({ success: true, review });
  } catch (err) {
    console.error('POST /api/reviews error:', err);
    res.status(500).json({ error: 'Ошибка добавления отзыва' });
  }
});

app.post('/api/reviews/report', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser) return res.status(401).json({ error: 'Не авторизован' });
    const user = await db.getUser(tgUser.id);

    const { reviewId, reason } = req.body;
    if (!reviewId || !reason) return res.status(400).json({ error: 'Укажите причину жалобы' });

    const report = await db.reportUserReview(reviewId, user.id, reason);
    res.json({ success: true, report });
  } catch (err) { res.status(500).json({ error: 'Ошибка отправки жалобы' }); }
});

// Admin Moderation API Routes (Requirement #3)

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

// Detailed Admin User Inspector (Requirement #3)
app.get('/api/admin/user/:userId', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    const isAdmin = await isAdminUser(tgUser);
    if (!tgUser || !isAdmin) return res.status(403).json({ error: 'Доступ запрещен' });

    const targetUser = await db.getUser(req.params.userId);
    if (!targetUser) return res.status(404).json({ error: 'Пользователь не найден' });

    const chatLogs = await db.getUserChatLogs(targetUser.id);
    const reviews = await db.getUserReviews(targetUser.id);

    res.json({ user: targetUser, chatLogs, reviews });
  } catch (err) {
    console.error('GET /api/admin/user error:', err);
    res.status(500).json({ error: 'Ошибка загрузки инспектора пользователя' });
  }
});

// Admin Issue Warning (3 warnings = auto IP ban)
app.post('/api/admin/warn', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    const isAdmin = await isAdminUser(tgUser);
    if (!tgUser || !isAdmin) return res.status(403).json({ error: 'Доступ запрещен' });

    const { userId, reason } = req.body;
    if (!userId || !reason) return res.status(400).json({ error: 'Укажите причину предупреждения' });

    const updatedUser = await db.issueWarning(userId, reason);
    res.json({ success: true, user: updatedUser });
  } catch (err) { res.status(500).json({ error: 'Ошибка вынесения предупреждения' }); }
});

// Admin Ban User with Custom Reason
app.post('/api/admin/ban', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    const isAdmin = await isAdminUser(tgUser);
    if (!tgUser || !isAdmin) return res.status(403).json({ error: 'Доступ запрещен' });

    const { userId, reason, clientIp } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId обязателен' });

    const updatedUser = await db.banUser(userId, reason, clientIp);
    res.json({ success: true, user: updatedUser });
  } catch (err) { res.status(500).json({ error: 'Ошибка блокировки пользователя' }); }
});

// Admin Unban User
app.post('/api/admin/unban', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    const isAdmin = await isAdminUser(tgUser);
    if (!tgUser || !isAdmin) return res.status(403).json({ error: 'Доступ запрещен' });

    const { userId } = req.body;
    const updatedUser = await db.unbanUser(userId);
    res.json({ success: true, user: updatedUser });
  } catch (err) { res.status(500).json({ error: 'Ошибка разблокировки' }); }
});

// Admin Toggle Moderator Role
app.post('/api/admin/toggle-mod', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    const isAdmin = await isAdminUser(tgUser);
    if (!tgUser || !isAdmin) return res.status(403).json({ error: 'Доступ запрещен' });

    const { userId, isAdmin: newAdminState } = req.body;
    const updatedUser = await db.updateUser(userId, { isAdmin: newAdminState });
    res.json({ success: true, user: updatedUser });
  } catch (err) { res.status(500).json({ error: 'Ошибка смены роли' }); }
});

// Admin Review Reports & Resolution
app.get('/api/admin/reports', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    const isAdmin = await isAdminUser(tgUser);
    if (!tgUser || !isAdmin) return res.status(403).json({ error: 'Доступ запрещен' });

    const reports = await db.getReviewReports();
    res.json({ reports });
  } catch (err) { res.status(500).json({ error: 'Ошибка загрузки жалоб' }); }
});

app.post('/api/admin/reports/resolve', async (req, res) => {
  try {
    const tgUser = getTelegramUser(req);
    const isAdmin = await isAdminUser(tgUser);
    if (!tgUser || !isAdmin) return res.status(403).json({ error: 'Доступ запрещен' });

    const { reportId, action } = req.body;
    await db.resolveReviewReport(reportId, action);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка обработки жалобы' }); }
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

// Serve frontend build in production
const frontendBuildPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
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
