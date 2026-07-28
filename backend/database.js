import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, 'database.json');

const defaultData = {
  users: [],
  likes: [], // { fromId, toId, type: 'like'|'dislike', timestamp }
  messages: [] // { chatId, senderId, text, timestamp }
};

class Database {
  constructor() {
    this.data = { ...defaultData };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        this.data = JSON.parse(fileContent);
      } else {
        this.save();
      }
    } catch (error) {
      console.error('Error loading database:', error);
      this.data = { ...defaultData };
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving database:', error);
    }
  }

  // User methods
  getUsers() {
    return this.data.users;
  }

  getUser(id) {
    const userIdStr = String(id);
    return this.data.users.find(u => String(u.id) === userIdStr || String(u.telegramId) === userIdStr);
  }

  createUser(user) {
    const newUser = {
      id: user.telegramId || String(Date.now()),
      telegramId: user.telegramId || null,
      username: user.username || user.telegramUsername || null,
      name: user.name || 'Аноним',
      age: parseInt(user.age) || 18,
      gender: user.gender || 'female',
      preferredGender: user.preferredGender || 'male',
      height: parseInt(user.height) || 170,
      weight: parseFloat(user.weight) || 60,
      bmi: parseFloat(user.bmi) || 20.8,
      bio: user.bio || '',
      photos: user.photos || [],
      isVerified: user.isVerified || false,
      verificationPhoto: user.verificationPhoto || null,
      verificationSelfie: user.verificationSelfie || null,
      verificationDate: user.verificationDate || null,
      createdAt: new Date().toISOString()
    };
    
    // Calculate BMI if height and weight exist
    if (newUser.height && newUser.weight) {
      const heightInMeters = newUser.height / 100;
      newUser.bmi = parseFloat((newUser.weight / (heightInMeters * heightInMeters)).toFixed(1));
    }

    this.data.users.push(newUser);
    this.save();
    return newUser;
  }

  updateUser(id, updateData) {
    const userIdStr = String(id);
    const index = this.data.users.findIndex(u => String(u.id) === userIdStr || String(u.telegramId) === userIdStr);
    
    if (index !== -1) {
      const updatedUser = { ...this.data.users[index], ...updateData };
      
      // Recalculate BMI if height or weight updated
      if (updatedUser.height && updatedUser.weight) {
        const heightInMeters = updatedUser.height / 100;
        updatedUser.bmi = parseFloat((updatedUser.weight / (heightInMeters * heightInMeters)).toFixed(1));
      }
      
      this.data.users[index] = updatedUser;
      this.save();
      return updatedUser;
    }
    return null;
  }

  // Like / Dislike methods
  addLike(fromId, toId, type = 'like') {
    const newLike = {
      fromId: String(fromId),
      toId: String(toId),
      type,
      timestamp: new Date().toISOString()
    };

    // Remove existing like/dislike between these two just in case
    this.data.likes = this.data.likes.filter(
      l => !(l.fromId === newLike.fromId && l.toId === newLike.toId)
    );

    this.data.likes.push(newLike);
    this.save();

    // Check if it's a mutual like
    if (type === 'like') {
      const mutualLike = this.data.likes.find(
        l => l.fromId === newLike.toId && l.toId === newLike.fromId && l.type === 'like'
      );
      return !!mutualLike; // returns true if it's a match!
    }
    return false;
  }

  blockUser(userId, targetUserId) {
    const userIdStr = String(userId);
    const targetIdStr = String(targetUserId);

    // Remove likes/matches between these two
    this.data.likes = this.data.likes.filter(
      l => !(
        (l.fromId === userIdStr && l.toId === targetIdStr) ||
        (l.fromId === targetIdStr && l.toId === userIdStr)
      )
    );

    // Remove messages
    const chatId = [userIdStr, targetIdStr].sort().join('_');
    this.data.messages = this.data.messages.filter(m => m.chatId !== chatId);

    // Record dislike block so target never appears in feed again
    this.data.likes.push({
      fromId: userIdStr,
      toId: targetIdStr,
      type: 'dislike',
      timestamp: new Date().toISOString()
    });

    this.save();
    return true;
  }

  // Get potential profiles for swipes (excluding self, already liked/disliked, and only verified if user requires it)
  getSwipeFeed(userId) {
    const userIdStr = String(userId);
    const user = this.getUser(userIdStr);
    if (!user) return [];

    // Find profiles already swiped by this user
    const swipedUserIds = new Set(
      this.data.likes
        .filter(l => l.fromId === userIdStr)
        .map(l => l.toId)
    );

    return this.data.users.filter(u => {
      const currentIdStr = String(u.id);
      
      // Cannot swipe self
      if (currentIdStr === userIdStr) return false;
      
      // Cannot swipe already swiped profiles
      if (swipedUserIds.has(currentIdStr)) return false;
      
      // Filter by gender preferences
      if (user.preferredGender !== 'all' && u.gender !== user.preferredGender) return false;
      if (u.preferredGender !== 'all' && u.preferredGender !== user.gender) return false;

      // Crucial dating bot logic: Only show verified users
      if (!u.isVerified) return false;

      return true;
    });
  }

  // Get list of mutual matches for a user
  getMatches(userId) {
    const userIdStr = String(userId);
    
    // Find all likes from this user
    const myLikes = this.data.likes.filter(l => l.fromId === userIdStr && l.type === 'like');
    
    const matches = [];
    
    for (const like of myLikes) {
      const mutualLike = this.data.likes.find(
        l => l.fromId === like.toId && l.toId === userIdStr && l.type === 'like'
      );
      
      if (mutualLike) {
        const matchedUser = this.getUser(like.toId);
        if (matchedUser) {
          // Find last message if any
          const chatId = [userIdStr, String(like.toId)].sort().join('_');
          const chatMessages = this.data.messages.filter(m => m.chatId === chatId);
          const lastMessage = chatMessages.length > 0 ? chatMessages[chatMessages.length - 1] : null;

          matches.push({
            user: matchedUser,
            chatId,
            lastMessage
          });
        }
      }
    }
    
    return matches;
  }

  // Chat methods
  addMessage(chatId, senderId, text) {
    const newMessage = {
      chatId,
      senderId: String(senderId),
      text,
      timestamp: new Date().toISOString()
    };
    
    this.data.messages.push(newMessage);
    this.save();
    return newMessage;
  }

  getMessages(chatId) {
    return this.data.messages.filter(m => m.chatId === chatId);
  }

  // Admin & Analytics methods
  getAdminStats() {
    const totalUsers = this.data.users.length;
    const verifiedUsers = this.data.users.filter(u => u.isVerified).length;
    const pendingVerifications = this.data.users.filter(u => !u.isVerified && u.verificationPhoto).length;
    const totalLikes = this.data.likes.length;
    const totalMessages = this.data.messages.length;

    return {
      totalUsers,
      verifiedUsers,
      pendingVerifications,
      totalLikes,
      totalMessages
    };
  }

  getPendingVerifications() {
    return this.data.users
      .filter(u => !u.isVerified && u.verificationStatus === 'pending_moderation')
      .map(u => ({
        user: u,
        photo: u.verificationPhoto,
        selfie: u.verificationSelfie,
        claimedWeight: u.weight,
        requestedAt: u.verificationDate || u.createdAt
      }));
  }

  getAllUsers() {
    return this.data.users.map(u => ({
      user: u,
      photo: u.verificationPhoto || u.photos?.[0],
      selfie: u.verificationSelfie,
      claimedWeight: u.weight,
      registeredAt: u.createdAt || u.verificationDate
    }));
  }

  getVerifiedUsers() {
    return this.data.users
      .filter(u => u.isVerified)
      .map(u => ({
        user: u,
        photo: u.verificationPhoto,
        selfie: u.verificationSelfie,
        claimedWeight: u.weight,
        verifiedAt: u.verificationDate || u.createdAt
      }));
  }

  deleteUser(userId) {
    const idStr = String(userId);
    this.data.users = this.data.users.filter(u => String(u.id) !== idStr);
    this.data.likes = this.data.likes.filter(l => String(l.fromId) !== idStr && String(l.toId) !== idStr);
    this.data.messages = this.data.messages.filter(m => !m.chatId.includes(idStr));
    this.save();
    return true;
  }

  approveVerification(userId, weightOverride = null) {
    const user = this.getUser(userId);
    if (user) {
      const finalWeight = weightOverride ? parseFloat(weightOverride) : user.weight;
      return this.updateUser(user.id, {
        isVerified: true,
        verificationStatus: 'approved',
        weight: finalWeight,
        verificationDate: new Date().toISOString()
      });
    }
    return null;
  }

  rejectVerification(userId, reason = 'Качество изображения недостаточно') {
    const user = this.getUser(userId);
    if (user) {
      return this.updateUser(user.id, {
        isVerified: false,
        verificationStatus: 'rejected',
        verificationPhoto: null,
        rejectionReason: reason
      });
    }
    return null;
  }

  revokeVerification(userId, reason = 'Верификация отменена администратором @jamsenbang') {
    const user = this.getUser(userId);
    if (user) {
      return this.updateUser(user.id, {
        isVerified: false,
        verificationStatus: 'rejected',
        verificationPhoto: null,
        rejectionReason: reason
      });
    }
    return null;
  }

  // Swipe History methods
  getSwipeHistory(userId) {
    const userIdStr = String(userId);
    return this.data.likes
      .filter(l => l.fromId === userIdStr)
      .map(l => {
        const targetUser = this.getUser(l.toId);
        return {
          targetUser,
          type: l.type, // 'like' | 'dislike'
          timestamp: l.timestamp
        };
      })
      .filter(h => h.targetUser !== undefined); // Exclude if user deleted
  }

  changeSwipeDecision(userId, targetUserId, newAction) {
    const userIdStr = String(userId);
    const targetUserIdStr = String(targetUserId);

    // Find the swipe entry
    const index = this.data.likes.findIndex(
      l => l.fromId === userIdStr && l.toId === targetUserIdStr
    );

    if (index !== -1) {
      this.data.likes[index].type = newAction;
      this.data.likes[index].timestamp = new Date().toISOString();
      this.save();

      // Check if it's a match now
      if (newAction === 'like') {
        const mutualLike = this.data.likes.find(
          l => l.fromId === targetUserIdStr && l.toId === userIdStr && l.type === 'like'
        );
        return !!mutualLike;
      }
    }
    return false;
  }
}

export const db = new Database();


