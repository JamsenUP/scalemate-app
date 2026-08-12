import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

export let bot = null;

export async function startBot() {
  const token = process.env.BOT_TOKEN || '8493874085:AAGYytvT5bTfMI-kvL7eELIWcRChpsLld_w';
  const appUrl = process.env.APP_URL || 'https://scalemate-app-two.vercel.app';

  if (!token) {
    console.log('BOT_TOKEN not found in environment variables. Running in browser-only web app mode.');
    return;
  }

  try {
    bot = new Telegraf(token);

    // /start command handler
    bot.start((ctx) => {
      const name = ctx.from.first_name || 'друг';
      
      const welcomeText = 
        `Привет, <b>${name}</b>! 👋\n\n` +
        `Добро пожаловать в <b>ScaleMate</b> — первое дейтинг-пространство с обязательной <b>верификацией веса</b>! ⚖️❤️\n\n` +
        `Мы за честность в знакомствах. Никакого кетфишинга, старых фоток или искажений. Только реальные люди и реальные тела.\n\n` +
        `🔒 Все профили проходят обязательную проверку веса перед началом общения.\n\n` +
        `Жми кнопку ниже, чтобы запустить приложение и найти свою половинку! 👇`;

      ctx.reply(
        welcomeText,
        {
          parse_mode: 'HTML',
          ...Markup.keyboard([
            [Markup.button.webApp('🔥 Начать знакомства', appUrl)]
          ]).resize()
        }
      );
    });

    // Handle normal text messages - guide them to WebApp
    bot.on('message', (ctx) => {
      ctx.reply(
        'Пожалуйста, откройте Mini App по кнопке ниже, чтобы пользоваться сервисом:',
        Markup.keyboard([
          [Markup.button.webApp('🔥 Начать знакомства', appUrl)]
        ]).resize()
      );
    });

    // Robust launch with retry loop
    const launchBotWithRetry = async (attempt = 1) => {
      try {
        const botInfo = await bot.telegram.getMe();
        console.log(`Telegram Bot @${botInfo.username} initialized successfully!`);

        await bot.launch();
        console.log('Telegram Bot polling active and listening for /start command.');

        // Automatically update global bottom-left WebApp Menu Button
        try {
          await bot.telegram.setChatMenuButton({
            menuButton: {
              type: 'web_app',
              text: '🔥 Знакомства',
              web_app: { url: appUrl }
            }
          });
          console.log(`Successfully updated global Telegram Menu Button to: ${appUrl}`);
        } catch (menuErr) {
          console.error('Failed to update Telegram Menu Button:', menuErr.message);
        }
      } catch (err) {
        console.error(`Failed to start Telegram Bot (attempt ${attempt}):`, err.message || err);
        console.log('Retrying Telegram Bot connection in 3 seconds...');
        setTimeout(() => launchBotWithRetry(attempt + 1), 3000);
      }
    };

    launchBotWithRetry();

  } catch (error) {
    console.error('Error initializing Telegram Bot:', error);
  }
}

// Graceful stop
process.once('SIGINT', () => bot && bot.stop('SIGINT'));
process.once('SIGTERM', () => bot && bot.stop('SIGTERM'));

/**
 * Sends a message to a user when a match occurs.
 */
export async function sendMatchNotification(telegramId, partnerName) {
  if (!bot || !telegramId) return;

  const appUrl = process.env.APP_URL || 'http://localhost:5173';

  try {
    const text = 
      `🎉 **У вас новый мэтч в ScaleMate!**\n\n` +
      `Вы понравились друг другу с **${partnerName}**! \n` +
      `Откройте Mini App прямо сейчас, чтобы начать общение! 💬`;

    await bot.telegram.sendMessage(telegramId, text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('💬 Перейти в чат', appUrl)]
      ])
    });
    console.log(`Notification sent to Telegram user ${telegramId}`);
  } catch (error) {
    console.error(`Failed to send Telegram notification to ${telegramId}:`, error);
  }
}

/**
 * Sends a notification to a Telegram user when a new chat message arrives.
 */
export async function sendChatMessageNotification(telegramId, senderName, text) {
  if (!bot || !telegramId) return;

  const appUrl = process.env.APP_URL || 'http://localhost:5173';

  try {
    const preview = text.length > 60 ? text.substring(0, 57) + '...' : text;
    const notificationText = 
      `💬 **Новое сообщение от ${senderName}:**\n\n` +
      `«${preview}»\n\n` +
      `Откройте ScaleMate, чтобы ответить! 👇`;

    await bot.telegram.sendMessage(telegramId, notificationText, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('💬 Ответить в чате', appUrl)]
      ])
    });
    console.log(`Chat notification sent to Telegram user ${telegramId}`);
  } catch (error) {
    console.error(`Failed to send Telegram chat notification to ${telegramId}:`, error?.message || error);
  }
}
