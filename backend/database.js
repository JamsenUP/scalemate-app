import pg from 'pg';
const { Pool } = pg;

function fixSupabaseUrl(url) {
  if (!url) return url;
  if (url.includes('.supabase.co')) {
    const match = url.match(/db\.([a-z0-9]+)\.supabase\.co/);
    if (match) {
      const projectRef = match[1];
      let fixed = url
        .replace(`db.${projectRef}.supabase.co:5432`, `aws-0-eu-central-1.pooler.supabase.com:5432`)
        .replace(`db.${projectRef}.supabase.co:6543`, `aws-0-eu-central-1.pooler.supabase.com:5432`)
        .replace(`db.${projectRef}.supabase.co`, `aws-0-eu-central-1.pooler.supabase.com:5432`);
      
      if (!fixed.includes(`postgres.${projectRef}`)) {
        fixed = fixed.replace('postgresql://postgres:', `postgresql://postgres.${projectRef}:`);
      }
      return fixed;
    }
  }
  return url;
}

const connectionString = fixSupabaseUrl(process.env.DATABASE_URL);

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000
});

// Initialize tables on startup
export async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        telegram_id TEXT UNIQUE,
        username TEXT,
        name TEXT,
        age INTEGER,
        gender TEXT DEFAULT 'female',
        preferred_gender TEXT DEFAULT 'male',
        height INTEGER,
        weight REAL,
        bmi REAL,
        bio TEXT DEFAULT '',
        photos TEXT[] DEFAULT '{}',
        is_verified BOOLEAN DEFAULT false,
        verification_photo TEXT,
        verification_selfie TEXT,
        verification_status TEXT DEFAULT 'none',
        verification_date TIMESTAMPTZ,
        rejection_reason TEXT,
        is_admin BOOLEAN DEFAULT false,
        is_face_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS likes (
        id SERIAL PRIMARY KEY,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'like',
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(from_id, to_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        chat_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      );

      -- Columns added in migrations
      ALTER TABLE users ADD COLUMN IF NOT EXISTS income INTEGER DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'Москва';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS warnings_count INTEGER DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT '';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 50;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS assets JSONB DEFAULT '[]';

      -- New tables
      CREATE TABLE IF NOT EXISTS banned_ips (
        ip TEXT PRIMARY KEY,
        reason TEXT DEFAULT '',
        banned_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS date_stories (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_name TEXT,
        user_photo TEXT,
        partner_name TEXT,
        story TEXT NOT NULL,
        rating INTEGER DEFAULT 5,
        photo TEXT,
        city TEXT DEFAULT 'Москва',
        likes_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_reviews (
        id SERIAL PRIMARY KEY,
        target_user_id TEXT NOT NULL,
        reviewer_id TEXT NOT NULL,
        reviewer_name TEXT,
        reviewer_photo TEXT,
        rating INTEGER DEFAULT 5,
        comment TEXT NOT NULL,
        photo TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS review_reports (
        id SERIAL PRIMARY KEY,
        review_id INTEGER NOT NULL,
        reporter_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS scheduled_dates (
        id SERIAL PRIMARY KEY,
        chat_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        location_name TEXT NOT NULL,
        yandex_map_url TEXT,
        date_time TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Anon / Random Chat tables
      CREATE TABLE IF NOT EXISTS anon_queue (
        user_id TEXT PRIMARY KEY,
        gender TEXT DEFAULT 'female',
        preferred_gender TEXT DEFAULT 'any',
        joined_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS anon_rooms (
        room_id TEXT PRIMARY KEY,
        user1_id TEXT NOT NULL,
        user2_id TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        user1_liked BOOLEAN DEFAULT false,
        user2_liked BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS anon_messages (
        id SERIAL PRIMARY KEY,
        room_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);
      CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender);
      CREATE INDEX IF NOT EXISTS idx_users_income ON users(income);
      CREATE INDEX IF NOT EXISTS idx_users_weight ON users(weight);
      CREATE INDEX IF NOT EXISTS idx_likes_to_id ON likes(to_id);
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_anon_queue_joined ON anon_queue(joined_at);
      CREATE INDEX IF NOT EXISTS idx_anon_rooms_user1 ON anon_rooms(user1_id);
      CREATE INDEX IF NOT EXISTS idx_anon_rooms_user2 ON anon_rooms(user2_id);
      CREATE INDEX IF NOT EXISTS idx_anon_messages_room ON anon_messages(room_id);
    `);
    console.log('✅ PostgreSQL tables and schemas initialized');
  } finally {
    client.release();
  }
}

function calcBmi(height, weight) {
  if (!height || !weight) return null;
  const h = height / 100;
  return parseFloat((weight / (h * h)).toFixed(1));
}

function calcTrustScore(row) {
  let score = 30; // base score
  if (row.is_verified) score += 35;
  if (row.is_face_verified) score += 15;
  if (row.photos && row.photos.length > 0) score += Math.min(row.photos.length * 5, 10);
  if (row.city) score += 5;
  if (row.warnings_count && row.warnings_count > 0) score -= row.warnings_count * 20;
  return Math.max(0, Math.min(100, score));
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    telegramId: row.telegram_id,
    username: row.username,
    name: row.name,
    age: row.age,
    gender: row.gender,
    preferredGender: row.preferred_gender,
    height: row.height,
    weight: row.weight,
    bmi: row.bmi,
    income: row.income || 0,
    city: row.city || 'Москва',
    warningsCount: row.warnings_count || 0,
    isBanned: row.is_banned || false,
    banReason: row.ban_reason || '',
    lastSeenAt: row.last_seen_at || row.created_at,
    trustScore: calcTrustScore(row),
    assets: row.assets || [],
    bio: row.bio || '',
    photos: row.photos || [],
    isVerified: row.is_verified,
    verificationPhoto: row.verification_photo,
    verificationSelfie: row.verification_selfie,
    verificationStatus: row.verification_status,
    verificationDate: row.verification_date,
    rejectionReason: row.rejection_reason,
    isAdmin: row.is_admin,
    isFaceVerified: row.is_face_verified,
    createdAt: row.created_at
  };
}

function rowToLike(row) {
  if (!row) return null;
  return {
    fromId: row.from_id,
    toId: row.to_id,
    type: row.type,
    timestamp: row.timestamp
  };
}

function rowToMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    chatId: row.chat_id,
    senderId: row.sender_id,
    text: row.text,
    timestamp: row.timestamp
  };
}

// ─── User Methods ───────────────────────────────────────────────

export async function getUser(id, username = null) {
  if (!id && !username) return null;
  const idStr = id ? String(id) : '';
  const uname = username ? String(username).toLowerCase().replace('@', '') : '';

  const res = await pool.query(
    `SELECT * FROM users 
     WHERE (id = $1 AND $1 != '') 
        OR (telegram_id = $1 AND $1 != '') 
        OR (LOWER(username) = $2 AND $2 != '') 
     ORDER BY is_verified DESC, created_at DESC 
     LIMIT 1`,
    [idStr, uname]
  );
  return rowToUser(res.rows[0]);
}

export async function getUserByQuery(queryStr) {
  if (!queryStr) return null;
  const q = String(queryStr).trim().toLowerCase().replace('@', '');
  const res = await pool.query(
    `SELECT * FROM users 
     WHERE id = $1 
        OR telegram_id = $1 
        OR LOWER(username) = $1 
        OR LOWER(name) = $1 
     ORDER BY is_verified DESC, created_at DESC 
     LIMIT 1`,
    [q]
  );
  return rowToUser(res.rows[0]);
}

export async function getUsers() {
  const res = await pool.query(`SELECT * FROM users ORDER BY created_at DESC`);
  return res.rows.map(rowToUser);
}

export async function createUser(user) {
  const id = user.telegramId || String(Date.now());
  const bmi = calcBmi(user.height, user.weight);
  const city = user.city || 'Москва';
  const res = await pool.query(
    `INSERT INTO users (
      id, telegram_id, username, name, age, gender, preferred_gender,
      height, weight, bmi, bio, photos, is_verified, verification_photo,
      verification_selfie, verification_status, verification_date,
      is_admin, is_face_verified, income, city
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19, $20, $21
    )
    ON CONFLICT (telegram_id) DO UPDATE SET
      username = EXCLUDED.username,
      name = EXCLUDED.name,
      age = EXCLUDED.age,
      gender = EXCLUDED.gender,
      preferred_gender = EXCLUDED.preferred_gender,
      height = EXCLUDED.height,
      weight = EXCLUDED.weight,
      bmi = EXCLUDED.bmi,
      bio = EXCLUDED.bio,
      photos = EXCLUDED.photos,
      is_verified = EXCLUDED.is_verified,
      verification_status = EXCLUDED.verification_status,
      is_admin = EXCLUDED.is_admin,
      verification_date = EXCLUDED.verification_date,
      income = EXCLUDED.income,
      city = EXCLUDED.city
    RETURNING *`,
    [
      id,
      user.telegramId || null,
      user.username || null,
      user.name || 'Аноним',
      parseInt(user.age) || 18,
      user.gender || 'female',
      user.preferredGender || 'male',
      parseInt(user.height) || 170,
      parseFloat(user.weight) || 60,
      bmi || 20.8,
      user.bio || '',
      user.photos || [],
      user.isVerified || false,
      user.verificationPhoto || null,
      user.verificationSelfie || null,
      user.verificationStatus || 'none',
      user.verificationDate || null,
      user.isAdmin || false,
      user.isFaceVerified || false,
      parseInt(user.income) || 0,
      city
    ]
  );
  return rowToUser(res.rows[0]);
}

export async function updateUser(id, updateData) {
  const idStr = String(id);
  const fields = [];
  const values = [];
  let idx = 1;

  const mapping = {
    name: 'name',
    age: 'age',
    gender: 'gender',
    preferredGender: 'preferred_gender',
    height: 'height',
    weight: 'weight',
    bmi: 'bmi',
    bio: 'bio',
    photos: 'photos',
    income: 'income',
    city: 'city',
    warningsCount: 'warnings_count',
    isBanned: 'is_banned',
    banReason: 'ban_reason',
    lastSeenAt: 'last_seen_at',
    trustScore: 'trust_score',
    assets: 'assets',
    isVerified: 'is_verified',
    verificationPhoto: 'verification_photo',
    verificationSelfie: 'verification_selfie',
    verificationStatus: 'verification_status',
    verificationDate: 'verification_date',
    rejectionReason: 'rejection_reason',
    isAdmin: 'is_admin',
    isFaceVerified: 'is_face_verified',
    username: 'username'
  };

  for (const [jsKey, sqlCol] of Object.entries(mapping)) {
    if (updateData[jsKey] !== undefined) {
      fields.push(`${sqlCol} = $${idx}`);
      values.push(jsKey === 'assets' ? JSON.stringify(updateData[jsKey]) : updateData[jsKey]);
      idx++;
    }
  }

  // Recalculate BMI if height or weight changed
  if (updateData.height || updateData.weight) {
    const current = await getUser(idStr);
    if (current) {
      const h = updateData.height || current.height;
      const w = updateData.weight || current.weight;
      const newBmi = calcBmi(h, w);
      if (newBmi) {
        fields.push(`bmi = $${idx}`);
        values.push(newBmi);
        idx++;
      }
    }
  }

  if (fields.length === 0) return await getUser(idStr);

  values.push(idStr);
  const res = await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} OR telegram_id = $${idx} RETURNING *`,
    values
  );
  return rowToUser(res.rows[0]);
}

export async function touchLastSeen(userId) {
  const idStr = String(userId);
  await pool.query(`UPDATE users SET last_seen_at = NOW() WHERE id = $1 OR telegram_id = $1`, [idStr]);
}

export async function deleteUser(userId) {
  const idStr = String(userId);
  await pool.query(`DELETE FROM likes WHERE from_id = $1 OR to_id = $1`, [idStr]);
  await pool.query(`DELETE FROM messages WHERE chat_id LIKE '%' || $1 || '%'`, [idStr]);
  await pool.query(`DELETE FROM users WHERE id = $1 OR telegram_id = $1`, [idStr]);
  return true;
}

// ─── Moderation & Warnings ────────────────────────────────────────

export async function issueWarning(userId, reason) {
  const user = await getUser(userId);
  if (!user) return null;
  const newWarnings = (user.warningsCount || 0) + 1;
  const shouldBan = newWarnings >= 3;

  return await updateUser(user.id, {
    warningsCount: newWarnings,
    isBanned: shouldBan,
    banReason: shouldBan ? `Автоматический бан: 3 предупреждения (${reason})` : user.banReason
  });
}

export async function banUser(userId, reason, clientIp = null) {
  const user = await getUser(userId);
  if (!user) return null;

  if (clientIp) {
    await pool.query(
      `INSERT INTO banned_ips (ip, reason) VALUES ($1, $2) ON CONFLICT (ip) DO UPDATE SET reason = EXCLUDED.reason`,
      [clientIp, reason]
    );
  }

  return await updateUser(user.id, {
    isBanned: true,
    banReason: reason || 'Заблокирован администратором'
  });
}

export async function unbanUser(userId) {
  return await updateUser(userId, {
    isBanned: false,
    banReason: '',
    warningsCount: 0
  });
}

export async function isIpBanned(ip) {
  if (!ip) return false;
  const res = await pool.query(`SELECT * FROM banned_ips WHERE ip = $1 LIMIT 1`, [ip]);
  return res.rows.length > 0;
}

// ─── Likes & Matches Methods ──────────────────────────────────────

export async function addLike(fromId, toId, type = 'like') {
  const fromStr = String(fromId);
  const toStr = String(toId);

  await pool.query(
    `INSERT INTO likes (from_id, to_id, type)
     VALUES ($1, $2, $3)
     ON CONFLICT (from_id, to_id) DO UPDATE SET type = EXCLUDED.type, timestamp = NOW()`,
    [fromStr, toStr, type]
  );

  if (type === 'like') {
    const reciprocal = await pool.query(
      `SELECT * FROM likes WHERE from_id = $1 AND to_id = $2 AND type = 'like'`,
      [toStr, fromStr]
    );
    return reciprocal.rows.length > 0;
  }
  return false;
}

export async function getLikesReceived(userId) {
  const idStr = String(userId);
  const res = await pool.query(
    `SELECT l.*, u.* FROM likes l
     JOIN users u ON l.from_id = u.id
     WHERE l.to_id = $1 
       AND l.type = 'like'
       AND l.from_id NOT IN (
         SELECT to_id FROM likes WHERE from_id = $1
       )
     ORDER BY l.timestamp DESC`,
    [idStr]
  );

  return res.rows.map(row => ({
    user: rowToUser(row),
    timestamp: row.timestamp
  }));
}

export async function getMatches(userId) {
  const idStr = String(userId);
  const res = await pool.query(
    `SELECT u.* FROM likes l1
     JOIN likes l2 ON l1.from_id = l2.to_id AND l1.to_id = l2.from_id
     JOIN users u ON l1.to_id = u.id
     WHERE l1.from_id = $1 AND l1.type = 'like' AND l2.type = 'like'
     ORDER BY l1.timestamp DESC`,
    [idStr]
  );

  const matches = [];
  for (const row of res.rows) {
    const partner = rowToUser(row);
    const chatId = [idStr, partner.id].sort().join('_');
    const msgRes = await pool.query(
      `SELECT * FROM messages WHERE chat_id = $1 ORDER BY timestamp DESC LIMIT 1`,
      [chatId]
    );
    matches.push({
      chatId,
      user: partner,
      lastMessage: msgRes.rows[0] ? rowToMessage(msgRes.rows[0]) : null
    });
  }
  return matches;
}

export async function getSwipeCards(userId, filters = {}) {
  const currentUser = await getUser(userId);
  if (!currentUser) return [];

  const idStr = String(userId);
  const { minAge, maxAge, minHeight, maxHeight, minWeight, maxWeight, minIncome, city } = filters;

  let query = `
    SELECT * FROM users 
    WHERE id != $1 
      AND (is_banned = false OR is_banned IS NULL)
      AND id NOT IN (
        SELECT to_id FROM likes WHERE from_id = $1
      )
  `;
  const params = [idStr];
  let idx = 2;

  if (currentUser.gender === 'female') {
    query += ` AND gender = 'male'`;
  } else {
    query += ` AND gender = 'female'`;
  }

  if (minAge) { query += ` AND age >= $${idx}`; params.push(minAge); idx++; }
  if (maxAge) { query += ` AND age <= $${idx}`; params.push(maxAge); idx++; }
  if (minHeight) { query += ` AND height >= $${idx}`; params.push(minHeight); idx++; }
  if (maxHeight) { query += ` AND height <= $${idx}`; params.push(maxHeight); idx++; }
  if (minWeight) { query += ` AND weight >= $${idx}`; params.push(minWeight); idx++; }
  if (maxWeight) { query += ` AND weight <= $${idx}`; params.push(maxWeight); idx++; }
  if (minIncome) { query += ` AND income >= $${idx}`; params.push(minIncome); idx++; }
  if (city && city !== 'all' && city !== 'Все города') {
    query += ` AND city = $${idx}`; params.push(city); idx++;
  }

  query += ` ORDER BY is_verified DESC, created_at DESC LIMIT 50`;

  const res = await pool.query(query, params);
  return res.rows.map(rowToUser);
}

// ─── Messages Methods ──────────────────────────────────────────────

export async function addMessage(chatId, senderId, text) {
  const res = await pool.query(
    `INSERT INTO messages (chat_id, sender_id, text) VALUES ($1, $2, $3) RETURNING *`,
    [chatId, String(senderId), text]
  );
  return rowToMessage(res.rows[0]);
}

export async function getMessages(chatId) {
  const res = await pool.query(
    `SELECT * FROM messages WHERE chat_id = $1 ORDER BY timestamp ASC`,
    [chatId]
  );
  return res.rows.map(rowToMessage);
}

export async function getUserChatLogs(userId) {
  const idStr = String(userId);
  const chatsRes = await pool.query(
    `SELECT DISTINCT chat_id FROM messages WHERE chat_id LIKE '%' || $1 || '%'`,
    [idStr]
  );
  const result = [];
  for (const row of chatsRes.rows) {
    const cId = row.chat_id;
    const parts = cId.split('_');
    const partnerId = parts.find(p => p !== idStr);
    const partner = await getUser(partnerId);
    const msgs = await getMessages(cId);
    result.push({
      chatId: cId,
      partner,
      messages: msgs
    });
  }
  return result;
}

// ─── Scheduled Dates Methods ─────────────────────────────────────

export async function createScheduledDate(senderId, receiverId, chatId, locationName, yandexMapUrl, dateTime) {
  const res = await pool.query(
    `INSERT INTO scheduled_dates (chat_id, sender_id, receiver_id, location_name, yandex_map_url, date_time)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [chatId, String(senderId), String(receiverId), locationName, yandexMapUrl, dateTime]
  );
  return res.rows[0];
}

export async function updateScheduledDateStatus(dateId, status) {
  const res = await pool.query(
    `UPDATE scheduled_dates SET status = $1 WHERE id = $2 RETURNING *`,
    [status, dateId]
  );
  return res.rows[0];
}

export async function getScheduledDates(chatId) {
  const res = await pool.query(
    `SELECT * FROM scheduled_dates WHERE chat_id = $1 ORDER BY created_at DESC`,
    [chatId]
  );
  return res.rows;
}

// ─── User Reviews & Reports ────────────────────────────────────────

export async function getUserReviews(targetUserId) {
  const res = await pool.query(
    `SELECT * FROM user_reviews WHERE target_user_id = $1 ORDER BY created_at DESC`,
    [String(targetUserId)]
  );
  return res.rows;
}

export async function canUserReview(reviewerId, targetUserId) {
  const rStr = String(reviewerId);
  const tStr = String(targetUserId);
  const chatId = [rStr, tStr].sort().join('_');
  const res = await pool.query(
    `SELECT COUNT(*) FROM messages WHERE chat_id = $1`,
    [chatId]
  );
  return parseInt(res.rows[0].count) > 0;
}

export async function addUserReview(targetUserId, reviewerUser, rating, comment, photoUrl = null) {
  const res = await pool.query(
    `INSERT INTO user_reviews (target_user_id, reviewer_id, reviewer_name, reviewer_photo, rating, comment, photo)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      String(targetUserId),
      String(reviewerUser.id),
      reviewerUser.name,
      reviewerUser.photos?.[0] || null,
      parseInt(rating) || 5,
      comment,
      photoUrl
    ]
  );
  return res.rows[0];
}

export async function reportUserReview(reviewId, reporterId, reason) {
  const res = await pool.query(
    `INSERT INTO review_reports (review_id, reporter_id, reason)
     VALUES ($1, $2, $3) RETURNING *`,
    [parseInt(reviewId), String(reporterId), reason]
  );
  return res.rows[0];
}

export async function getReviewReports() {
  const res = await pool.query(
    `SELECT rr.*, ur.target_user_id, ur.reviewer_id, ur.reviewer_name, ur.comment, ur.rating
     FROM review_reports rr
     JOIN user_reviews ur ON rr.review_id = ur.id
     WHERE rr.status = 'pending'
     ORDER BY rr.created_at DESC`
  );
  return res.rows;
}

export async function resolveReviewReport(reportId, action) {
  if (action === 'delete') {
    const reportRes = await pool.query(`SELECT review_id FROM review_reports WHERE id = $1`, [reportId]);
    if (reportRes.rows[0]) {
      await pool.query(`DELETE FROM user_reviews WHERE id = $1`, [reportRes.rows[0].review_id]);
    }
  }
  await pool.query(`UPDATE review_reports SET status = $1 WHERE id = $2`, [action, reportId]);
  return true;
}

// ─── Date Stories Community Forum ──────────────────────────────────

export async function getDateStories(city = null) {
  let query = `SELECT * FROM date_stories`;
  const params = [];
  if (city && city !== 'all' && city !== 'Все города') {
    query += ` WHERE city = $1`;
    params.push(city);
  }
  query += ` ORDER BY created_at DESC LIMIT 50`;
  const res = await pool.query(query, params);
  return res.rows;
}

export async function addDateStory(user, partnerName, story, rating, photoUrl = null) {
  const res = await pool.query(
    `INSERT INTO date_stories (user_id, user_name, user_photo, partner_name, story, rating, photo, city)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      String(user.id),
      user.name,
      user.photos?.[0] || null,
      partnerName,
      story,
      parseInt(rating) || 5,
      photoUrl,
      user.city || 'Москва'
    ]
  );
  return res.rows[0];
}

export async function likeDateStory(storyId) {
  const res = await pool.query(
    `UPDATE date_stories SET likes_count = likes_count + 1 WHERE id = $1 RETURNING *`,
    [storyId]
  );
  return res.rows[0];
}

// ─── Leaderboard ───────────────────────────────────────────────────

export async function getLeaderboard(gender = 'male', city = null) {
  let query = '';
  const params = [];

  if (gender === 'male') {
    query = `
      SELECT * FROM users 
      WHERE gender = 'male' AND (is_banned = false OR is_banned IS NULL)
    `;
    if (city && city !== 'all' && city !== 'Все города') {
      query += ` AND city = $1`;
      params.push(city);
    }
    query += ` ORDER BY income DESC, is_verified DESC LIMIT 50`;
  } else {
    query = `
      SELECT u.*, (SELECT COUNT(*) FROM likes WHERE to_id = u.id AND type = 'like') AS likes_received_count
      FROM users u
      WHERE u.gender = 'female' AND (u.is_banned = false OR u.is_banned IS NULL)
    `;
    if (city && city !== 'all' && city !== 'Все города') {
      query += ` AND u.city = $1`;
      params.push(city);
    }
    query += ` ORDER BY likes_received_count DESC, u.is_verified DESC LIMIT 50`;
  }

  const res = await pool.query(query, params);
  return res.rows.map(row => {
    const u = rowToUser(row);
    u.likesCount = parseInt(row.likes_received_count || 0);
    return u;
  });
}

// ─── Admin Methods ─────────────────────────────────────────────────

export async function getAdminStats() {
  const total = await pool.query(`SELECT COUNT(*) FROM users`);
  const verified = await pool.query(`SELECT COUNT(*) FROM users WHERE is_verified = true`);
  const pending = await pool.query(`SELECT COUNT(*) FROM users WHERE is_verified = false OR is_verified IS NULL`);
  const banned = await pool.query(`SELECT COUNT(*) FROM users WHERE is_banned = true`);

  return {
    totalUsers: parseInt(total.rows[0].count),
    verifiedUsers: parseInt(verified.rows[0].count),
    pendingUsers: parseInt(pending.rows[0].count),
    bannedUsers: parseInt(banned.rows[0].count)
  };
}

export async function getPendingVerifications() {
  const res = await pool.query(
    `SELECT * FROM users WHERE is_verified = false OR is_verified IS NULL ORDER BY created_at DESC`
  );
  return res.rows.map(rowToUser);
}

export async function getAllUsers() {
  const res = await pool.query(`SELECT * FROM users ORDER BY created_at DESC`);
  return res.rows.map(rowToUser);
}

export async function getVerifiedUsers() {
  const res = await pool.query(`SELECT * FROM users WHERE is_verified = true ORDER BY created_at DESC`);
  return res.rows.map(rowToUser);
}

export async function approveVerification(userId, weightOverride = null) {
  const idStr = String(userId);
  const current = await getUser(idStr);
  if (!current) return null;

  const updates = {
    isVerified: true,
    verificationStatus: 'approved',
    verificationDate: new Date().toISOString()
  };

  if (weightOverride) {
    updates.weight = parseFloat(weightOverride);
  }

  return await updateUser(idStr, updates);
}

export async function rejectVerification(userId, reason) {
  const idStr = String(userId);
  return await updateUser(idStr, {
    isVerified: false,
    verificationStatus: 'rejected',
    rejectionReason: reason || 'Фото верификации не прошло проверку.'
  });
}

export async function revokeVerification(userId, reason) {
  const idStr = String(userId);
  return await updateUser(idStr, {
    isVerified: false,
    verificationStatus: 'none',
    rejectionReason: reason || 'Верификация была отозвана модератором.'
  });
}

export async function blockUser(userId, targetUserId) {
  return await addLike(userId, targetUserId, 'dislike');
}

export async function getSwipeHistory(userId) {
  const idStr = String(userId);
  const res = await pool.query(
    `SELECT l.*, u.* FROM likes l
     JOIN users u ON l.to_id = u.id
     WHERE l.from_id = $1
     ORDER BY l.timestamp DESC`,
    [idStr]
  );
  return res.rows.map(row => ({
    id: row.id,
    targetUser: rowToUser(row),
    action: row.type,
    timestamp: row.timestamp
  }));
}

export async function changeSwipeDecision(userId, targetUserId, newAction) {
  const fromStr = String(userId);
  const toStr = String(targetUserId);
  return await addLike(fromStr, toStr, newAction);
}

// ----------------------------------------------------
// RANDOM / ANON CHAT FUNCTIONS
// ----------------------------------------------------

export async function joinAnonQueue(userId, preferredGender = 'any') {
  const idStr = String(userId);
  const user = await getUser(idStr);
  if (!user) return { error: 'Пользователь не найден' };

  // First check if already in an active room
  const activeRoom = await checkAnonStatus(idStr);
  if (activeRoom.status === 'matched') {
    return activeRoom;
  }

  const userGender = user.gender || 'female';

  // Upsert user into anon_queue
  await pool.query(
    `INSERT INTO anon_queue (user_id, gender, preferred_gender, joined_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id) DO UPDATE SET gender = $2, preferred_gender = $3, joined_at = NOW()`,
    [idStr, userGender, preferredGender]
  );

  // Try to match with another candidate in queue
  let candidateQuery = `
    SELECT * FROM anon_queue 
    WHERE user_id != $1
  `;
  const params = [idStr];

  // Match preferred gender conditions
  if (preferredGender !== 'any') {
    params.push(preferredGender);
    candidateQuery += ` AND gender = $${params.length}`;
  }

  // Candidate must also be compatible with this user's gender
  params.push(userGender);
  candidateQuery += ` AND (preferred_gender = 'any' OR preferred_gender = $${params.length})`;
  candidateQuery += ` ORDER BY joined_at ASC LIMIT 1`;

  const candidateRes = await pool.query(candidateQuery, params);

  if (candidateRes.rows.length > 0) {
    const candidate = candidateRes.rows[0];
    const candidateId = candidate.user_id;

    // Remove both from queue
    await pool.query(`DELETE FROM anon_queue WHERE user_id IN ($1, $2)`, [idStr, candidateId]);

    // Create room
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await pool.query(
      `INSERT INTO anon_rooms (room_id, user1_id, user2_id, status) VALUES ($1, $2, $3, 'active')`,
      [roomId, idStr, candidateId]
    );

    const partner = await getUser(candidateId);
    return {
      status: 'matched',
      roomId,
      partner
    };
  }

  return { status: 'searching' };
}

export async function checkAnonStatus(userId) {
  const idStr = String(userId);

  // Check active rooms first
  const roomRes = await pool.query(
    `SELECT * FROM anon_rooms 
     WHERE status = 'active' AND (user1_id = $1 OR user2_id = $1)
     ORDER BY created_at DESC LIMIT 1`,
    [idStr]
  );

  if (roomRes.rows.length > 0) {
    const room = roomRes.rows[0];
    const partnerId = room.user1_id === idStr ? room.user2_id : room.user1_id;
    const partner = await getUser(partnerId);

    const userIsUser1 = room.user1_id === idStr;
    const userLiked = userIsUser1 ? room.user1_liked : room.user2_liked;
    const partnerLiked = userIsUser1 ? room.user2_liked : room.user1_liked;

    return {
      status: 'matched',
      roomId: room.room_id,
      partner,
      userLiked: !!userLiked,
      partnerLiked: !!partnerLiked,
      isMutual: !!(userLiked && partnerLiked)
    };
  }

  // Check queue
  const queueRes = await pool.query(`SELECT * FROM anon_queue WHERE user_id = $1`, [idStr]);
  if (queueRes.rows.length > 0) {
    return { status: 'searching' };
  }

  return { status: 'idle' };
}

export async function leaveAnonQueueOrRoom(userId) {
  const idStr = String(userId);

  // Remove from queue
  await pool.query(`DELETE FROM anon_queue WHERE user_id = $1`, [idStr]);

  // Close active room if in one
  await pool.query(
    `UPDATE anon_rooms SET status = 'closed' 
     WHERE status = 'active' AND (user1_id = $1 OR user2_id = $1)`,
    [idStr]
  );

  return { success: true };
}

export async function sendAnonMessage(roomId, senderId, text) {
  const idStr = String(senderId);

  // Verify room is active
  const roomRes = await pool.query(`SELECT * FROM anon_rooms WHERE room_id = $1 AND status = 'active'`, [roomId]);
  if (roomRes.rows.length === 0) {
    return { error: 'Собеседник покинул чат или диалог завершен.' };
  }

  const room = roomRes.rows[0];
  if (room.user1_id !== idStr && room.user2_id !== idStr) {
    return { error: 'У вас нет доступа к этой комнате' };
  }

  const msgRes = await pool.query(
    `INSERT INTO anon_messages (room_id, sender_id, text) VALUES ($1, $2, $3) RETURNING *`,
    [roomId, idStr, text.trim()]
  );

  return { message: msgRes.rows[0] };
}

export async function getAnonMessages(roomId, userId) {
  const idStr = String(userId);

  const roomRes = await pool.query(`SELECT * FROM anon_rooms WHERE room_id = $1`, [roomId]);
  if (roomRes.rows.length === 0) {
    return { status: 'closed', messages: [] };
  }

  const room = roomRes.rows[0];
  if (room.user1_id !== idStr && room.user2_id !== idStr) {
    return { error: 'Доступ запрещен' };
  }

  const msgRes = await pool.query(
    `SELECT * FROM anon_messages WHERE room_id = $1 ORDER BY timestamp ASC`,
    [roomId]
  );

  const partnerId = room.user1_id === idStr ? room.user2_id : room.user1_id;
  const partner = await getUser(partnerId);

  const userIsUser1 = room.user1_id === idStr;
  const userLiked = userIsUser1 ? room.user1_liked : room.user2_liked;
  const partnerLiked = userIsUser1 ? room.user2_liked : room.user1_liked;

  return {
    status: room.status,
    messages: msgRes.rows,
    partner,
    userLiked: !!userLiked,
    partnerLiked: !!partnerLiked,
    isMutual: !!(userLiked && partnerLiked)
  };
}

export async function likeAnonPartner(roomId, userId) {
  const idStr = String(userId);

  const roomRes = await pool.query(`SELECT * FROM anon_rooms WHERE room_id = $1 AND status = 'active'`, [roomId]);
  if (roomRes.rows.length === 0) {
    return { error: 'Комната закрыта' };
  }

  const room = roomRes.rows[0];
  const isUser1 = room.user1_id === idStr;
  const partnerId = isUser1 ? room.user2_id : room.user1_id;

  let updateQuery = isUser1
    ? `UPDATE anon_rooms SET user1_liked = true WHERE room_id = $1 RETURNING *`
    : `UPDATE anon_rooms SET user2_liked = true WHERE room_id = $1 RETURNING *`;

  const updatedRes = await pool.query(updateQuery, [roomId]);
  const updatedRoom = updatedRes.rows[0];

  const mutual = updatedRoom.user1_liked && updatedRoom.user2_liked;

  if (mutual) {
    // Save mutual likes in standard table
    await addLike(room.user1_id, room.user2_id, 'like');
    await addLike(room.user2_id, room.user1_id, 'like');

    // Transfer anon messages to permanent chat
    const chatId = [room.user1_id, room.user2_id].sort().join('_');
    const anonMsgs = await pool.query(`SELECT * FROM anon_messages WHERE room_id = $1 ORDER BY timestamp ASC`, [roomId]);
    for (const msg of anonMsgs.rows) {
      await pool.query(
        `INSERT INTO messages (chat_id, sender_id, text, timestamp) VALUES ($1, $2, $3, $4)`,
        [chatId, msg.sender_id, msg.text, msg.timestamp]
      );
    }
  }

  return {
    success: true,
    mutual,
    partnerId
  };
}

