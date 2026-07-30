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
    `);
    console.log('✅ PostgreSQL tables initialized');
  } finally {
    client.release();
  }
}

function calcBmi(height, weight) {
  if (!height || !weight) return null;
  const h = height / 100;
  return parseFloat((weight / (h * h)).toFixed(1));
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
    chatId: row.chat_id,
    senderId: row.sender_id,
    text: row.text,
    timestamp: row.timestamp
  };
}

// ─── User Methods ───────────────────────────────────────────────

export async function getUser(id) {
  const idStr = String(id);
  const res = await pool.query(
    `SELECT * FROM users WHERE id = $1 OR telegram_id = $1 LIMIT 1`,
    [idStr]
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
  const res = await pool.query(
    `INSERT INTO users (
      id, telegram_id, username, name, age, gender, preferred_gender,
      height, weight, bmi, bio, photos, is_verified, verification_photo,
      verification_selfie, verification_status, verification_date,
      is_admin, is_face_verified
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19
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
      verification_date = EXCLUDED.verification_date
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
      user.isFaceVerified || false
    ]
  );
  return rowToUser(res.rows[0]);
}

export async function updateUser(id, updateData) {
  const idStr = String(id);
  // Build dynamic SET clause
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
      values.push(updateData[jsKey]);
      idx++;
    }
  }

  // Recalculate BMI if height or weight changed
  if (updateData.height || updateData.weight) {
    // We need to fetch current values to recalc
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

export async function deleteUser(userId) {
  const idStr = String(userId);
  await pool.query(`DELETE FROM likes WHERE from_id = $1 OR to_id = $1`, [idStr]);
  await pool.query(`DELETE FROM messages WHERE chat_id LIKE '%' || $1 || '%'`, [idStr]);
  await pool.query(`DELETE FROM users WHERE id = $1 OR telegram_id = $1`, [idStr]);
  return true;
}

// ─── Like / Swipe Methods ────────────────────────────────────────

export async function addLike(fromId, toId, type = 'like') {
  const fromStr = String(fromId);
  const toStr = String(toId);
  await pool.query(
    `INSERT INTO likes (from_id, to_id, type, timestamp)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (from_id, to_id) DO UPDATE SET type = EXCLUDED.type, timestamp = NOW()`,
    [fromStr, toStr, type]
  );
  if (type === 'like') {
    const mutual = await pool.query(
      `SELECT id FROM likes WHERE from_id = $1 AND to_id = $2 AND type = 'like'`,
      [toStr, fromStr]
    );
    return mutual.rows.length > 0;
  }
  return false;
}

export async function blockUser(userId, targetUserId) {
  const userStr = String(userId);
  const targetStr = String(targetUserId);
  const chatId = [userStr, targetStr].sort().join('_');
  await pool.query(
    `DELETE FROM likes WHERE (from_id=$1 AND to_id=$2) OR (from_id=$2 AND to_id=$1)`,
    [userStr, targetStr]
  );
  await pool.query(`DELETE FROM messages WHERE chat_id = $1`, [chatId]);
  await pool.query(
    `INSERT INTO likes (from_id, to_id, type) VALUES ($1, $2, 'dislike')
     ON CONFLICT (from_id, to_id) DO UPDATE SET type = 'dislike'`,
    [userStr, targetStr]
  );
  return true;
}

export async function getSwipeFeed(userId) {
  const userStr = String(userId);
  const user = await getUser(userStr);
  if (!user) return [];

  const swipedRes = await pool.query(
    `SELECT to_id FROM likes WHERE from_id = $1`,
    [userStr]
  );
  const swipedIds = swipedRes.rows.map(r => r.to_id);
  swipedIds.push(userStr); // exclude self

  let query = `SELECT * FROM users WHERE is_verified = true AND id != ALL($1::text[])`;
  const params = [swipedIds];
  let idx = 2;

  if (user.preferredGender !== 'all') {
    query += ` AND gender = $${idx}`;
    params.push(user.preferredGender);
    idx++;
  }

  const res = await pool.query(query, params);
  return res.rows
    .filter(u => u.preferred_gender === 'all' || u.preferred_gender === user.gender)
    .map(rowToUser);
}

export async function getMatches(userId) {
  const userStr = String(userId);
  const res = await pool.query(
    `SELECT l1.to_id as match_id FROM likes l1
     INNER JOIN likes l2 ON l1.from_id = l2.to_id AND l1.to_id = l2.from_id
     WHERE l1.from_id = $1 AND l1.type = 'like' AND l2.type = 'like'`,
    [userStr]
  );

  const matches = [];
  for (const row of res.rows) {
    const matchedUser = await getUser(row.match_id);
    if (matchedUser) {
      const chatId = [userStr, row.match_id].sort().join('_');
      const msgRes = await pool.query(
        `SELECT * FROM messages WHERE chat_id = $1 ORDER BY timestamp DESC LIMIT 1`,
        [chatId]
      );
      matches.push({
        user: matchedUser,
        chatId,
        lastMessage: msgRes.rows[0] ? rowToMessage(msgRes.rows[0]) : null
      });
    }
  }
  return matches;
}

export async function getLikesReceived(userId) {
  const userStr = String(userId);
  const res = await pool.query(
    `SELECT l.from_id, l.timestamp FROM likes l
     WHERE l.to_id = $1 AND l.type = 'like'
       AND l.from_id NOT IN (
         SELECT to_id FROM likes WHERE from_id = $1
       )
     ORDER BY l.timestamp DESC`,
    [userStr]
  );

  const incomingLikes = [];
  for (const row of res.rows) {
    const likerUser = await getUser(row.from_id);
    if (likerUser) {
      const chatId = [userStr, String(row.from_id)].sort().join('_');
      incomingLikes.push({
        user: likerUser,
        chatId,
        timestamp: row.timestamp
      });
    }
  }
  return incomingLikes;
}

export async function getSwipeHistory(userId) {
  const userStr = String(userId);
  const res = await pool.query(
    `SELECT * FROM likes WHERE from_id = $1 ORDER BY timestamp DESC`,
    [userStr]
  );
  const history = [];
  for (const row of res.rows) {
    const targetUser = await getUser(row.to_id);
    if (targetUser) {
      history.push({ targetUser, type: row.type, timestamp: row.timestamp });
    }
  }
  return history;
}

export async function changeSwipeDecision(userId, targetUserId, newAction) {
  const userStr = String(userId);
  const targetStr = String(targetUserId);
  await pool.query(
    `UPDATE likes SET type = $1, timestamp = NOW() WHERE from_id = $2 AND to_id = $3`,
    [newAction, userStr, targetStr]
  );
  if (newAction === 'like') {
    const mutual = await pool.query(
      `SELECT id FROM likes WHERE from_id = $1 AND to_id = $2 AND type = 'like'`,
      [targetStr, userStr]
    );
    return mutual.rows.length > 0;
  }
  return false;
}

// ─── Chat Methods ─────────────────────────────────────────────────

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

// ─── Admin & Analytics ────────────────────────────────────────────

export async function getAdminStats() {
  const totalRes = await pool.query(`SELECT COUNT(*) FROM users`);
  const verifiedRes = await pool.query(`SELECT COUNT(*) FROM users WHERE is_verified = true`);
  const pendingRes = await pool.query(`SELECT COUNT(*) FROM users WHERE is_verified = false OR is_verified IS NULL`);
  const likesRes = await pool.query(`SELECT COUNT(*) FROM likes`);
  const msgRes = await pool.query(`SELECT COUNT(*) FROM messages`);
  return {
    totalUsers: parseInt(totalRes.rows[0].count),
    verifiedUsers: parseInt(verifiedRes.rows[0].count),
    pendingVerifications: parseInt(pendingRes.rows[0].count),
    totalLikes: parseInt(likesRes.rows[0].count),
    totalMessages: parseInt(msgRes.rows[0].count)
  };
}

export async function getAllUsers() {
  const res = await pool.query(`SELECT * FROM users ORDER BY created_at DESC`);
  return res.rows.map(row => ({
    user: rowToUser(row),
    photo: row.verification_photo || (row.photos && row.photos[0]),
    selfie: row.verification_selfie,
    claimedWeight: row.weight,
    registeredAt: row.created_at
  }));
}

export async function getPendingVerifications() {
  const res = await pool.query(
    `SELECT * FROM users WHERE is_verified = false OR is_verified IS NULL ORDER BY created_at DESC`
  );
  return res.rows.map(row => ({
    user: rowToUser(row),
    photo: row.verification_photo || (row.photos && row.photos[0]),
    selfie: row.verification_selfie,
    claimedWeight: row.weight,
    requestedAt: row.verification_date || row.created_at
  }));
}

export async function getVerifiedUsers() {
  const res = await pool.query(
    `SELECT * FROM users WHERE is_verified = true ORDER BY verification_date DESC`
  );
  return res.rows.map(row => ({
    user: rowToUser(row),
    photo: row.verification_photo,
    selfie: row.verification_selfie,
    claimedWeight: row.weight,
    verifiedAt: row.verification_date || row.created_at
  }));
}

export async function approveVerification(userId, weightOverride = null) {
  const user = await getUser(userId);
  if (!user) return null;
  const finalWeight = weightOverride ? parseFloat(weightOverride) : user.weight;
  return await updateUser(user.id, {
    isVerified: true,
    verificationStatus: 'approved',
    weight: finalWeight,
    verificationDate: new Date().toISOString()
  });
}

export async function rejectVerification(userId, reason = 'Качество изображения недостаточно') {
  const user = await getUser(userId);
  if (!user) return null;
  return await updateUser(user.id, {
    isVerified: false,
    verificationStatus: 'rejected',
    verificationPhoto: null,
    rejectionReason: reason
  });
}

export async function revokeVerification(userId, reason = 'Верификация отменена администратором') {
  const user = await getUser(userId);
  if (!user) return null;
  return await updateUser(user.id, {
    isVerified: false,
    verificationStatus: 'rejected',
    verificationPhoto: null,
    rejectionReason: reason
  });
}

// Legacy db object for backward compatibility
export const db = {
  getUser, getUsers, createUser, updateUser, deleteUser,
  addLike, blockUser, getSwipeFeed, getMatches, getLikesReceived,
  getSwipeHistory, changeSwipeDecision,
  addMessage, getMessages,
  getAdminStats, getAllUsers, getPendingVerifications,
  getVerifiedUsers, approveVerification, rejectVerification, revokeVerification
};
