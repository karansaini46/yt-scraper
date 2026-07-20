import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import { config } from './utils/config';
import { logger } from './utils/logger';
import { runPipeline } from './index';

// Initialize Telegram Bot in Polling Mode
const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

// Track if a pipeline run is currently in progress
let isRunning = false;

// Listen for incoming messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text?.trim().toLowerCase();

  // Security: Only respond to your configured CHAT_ID
  if (chatId !== config.CHAT_ID) {
    return;
  }

  // Command handling
  if (text === 'hi') {
    if (isRunning) {
      await bot.sendMessage(chatId, 'Hold on sir, a scraping pipeline is already running! ⏳');
      return;
    }

    try {
      isRunning = true;
      await bot.sendMessage(chatId, 'on the way sir 🚀\n(This will take a few minutes)');
      
      // Execute the scraper pipeline
      await runPipeline();
      
    } catch (error: any) {
      logger.error('Error in bot triggered pipeline:', error);
      await bot.sendMessage(chatId, `Pipeline failed: ${error.message}`);
    } finally {
      isRunning = false;
    }
  }
});

// Setup Express Server (Required for Cloud Providers like Render to consider the app healthy)
const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send('Creator Lead Finder Bot is running! 🚀');
});

// Start the Web Server
app.listen(PORT, () => {
  logger.info(`Dummy Web Server listening on port ${PORT}`);
  logger.info('Telegram Bot is online and listening for messages...');
});
