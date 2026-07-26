import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(__dirname, 'database.json');

// Paths to generated artifact images
const ARTIFACTS_DIR = 'C:\\Users\\jamsen\\.gemini\\antigravity\\brain\\30929bb1-3881-4175-ad99-5aa30ce5be83';
const SOURCE_IMAGES = {
  alice: path.join(ARTIFACTS_DIR, 'user_alice_1784397158999.jpg'),
  bob: path.join(ARTIFACTS_DIR, 'user_bob_1784397170998.jpg'),
  clara: path.join(ARTIFACTS_DIR, 'user_clara_1784397184163.jpg'),
  david: path.join(ARTIFACTS_DIR, 'user_david_1784397196574.jpg')
};

async function runSeed() {
  console.log('Starting ScaleMate database seeding...');

  // 1. Ensure uploads directory exists
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log('Created uploads directory.');
  }

  // 2. Copy source images to uploads folder
  const copiedImages = {};
  for (const [key, sourcePath] of Object.entries(SOURCE_IMAGES)) {
    const destPath = path.join(UPLOADS_DIR, `${key}.jpg`);
    try {
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        copiedImages[key] = `/uploads/${key}.jpg`;
        console.log(`Copied ${key} image to uploads.`);
      } else {
        console.warn(`Source image for ${key} not found at ${sourcePath}. Using fallback empty string.`);
        copiedImages[key] = '';
      }
    } catch (err) {
      console.error(`Error copying image for ${key}:`, err);
      copiedImages[key] = '';
    }
  }

  // 3. Define seed users
  const users = [
    {
      id: '1001',
      telegramId: '1001',
      name: 'Алиса',
      age: 24,
      gender: 'female',
      preferredGender: 'male',
      height: 168,
      weight: 54.2,
      bmi: 19.2,
      bio: 'Люблю утренние пробежки, йогу и вкусный кофе ☕️ Ищу человека со схожими интересами, активного и веселого!',
      photos: copiedImages.alice ? [copiedImages.alice] : [],
      isVerified: true,
      verificationPhoto: '/uploads/alice_scale.jpg',
      verificationSelfie: null,
      verificationDate: new Date().toISOString(),
      createdAt: new Date().toISOString()
    },
    {
      id: '1002',
      telegramId: '1002',
      name: 'Александр (Боб)',
      age: 26,
      gender: 'male',
      preferredGender: 'female',
      height: 182,
      weight: 78.5,
      bmi: 23.7,
      bio: 'Занимаюсь кроссфитом, играю на гитаре. Выходные люблю проводить за городом. Давай выпьем кофе и поболтаем? 😉',
      photos: copiedImages.bob ? [copiedImages.bob] : [],
      isVerified: true,
      verificationPhoto: '/uploads/bob_scale.jpg',
      verificationSelfie: null,
      verificationDate: new Date().toISOString(),
      createdAt: new Date().toISOString()
    },
    {
      id: '1003',
      telegramId: '1003',
      name: 'Клара',
      age: 22,
      gender: 'female',
      preferredGender: 'male',
      height: 170,
      weight: 58.0,
      bmi: 20.1,
      bio: 'Студентка, будущий дизайнер. Обожаю выставки современного искусства и пробежки по вечерам. Честность — лучшее качество!',
      photos: copiedImages.clara ? [copiedImages.clara] : [],
      isVerified: true,
      verificationPhoto: '/uploads/clara_scale.jpg',
      verificationSelfie: null,
      verificationDate: new Date().toISOString(),
      createdAt: new Date().toISOString()
    },
    {
      id: '1004',
      telegramId: '1004',
      name: 'Давид',
      age: 28,
      gender: 'male',
      preferredGender: 'female',
      height: 178,
      weight: 74.0,
      bmi: 23.4,
      bio: 'Разработчик. Люблю походы в горы, велопрогулки и хорошую фантастику. За честные и открытые отношения без масок.',
      photos: copiedImages.david ? [copiedImages.david] : [],
      isVerified: true,
      verificationPhoto: '/uploads/david_scale.jpg',
      verificationSelfie: null,
      verificationDate: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }
  ];

  // 4. Create seed database
  const databaseContent = {
    users,
    likes: [],
    messages: []
  };

  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(databaseContent, null, 2), 'utf8');
    console.log(`Successfully seeded database at ${DB_FILE}`);
  } catch (err) {
    console.error('Error writing database file:', err);
  }
}

runSeed();
