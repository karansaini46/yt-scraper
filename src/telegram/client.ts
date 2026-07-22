import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

export class TelegramClient {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = `https://api.telegram.org/bot${config.BOT_TOKEN}`;
  }

  /**
   * Send a text message to the configured Telegram chat.
   */
  async sendMessage(text: string): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: config.CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
      logger.debug('Successfully sent text message to Telegram.');
    } catch (error: any) {
      const errorDetail = error.response?.data?.description || error.message || String(error);
      logger.error(`Failed to send Telegram message: ${errorDetail}`);
      throw new Error(`Telegram sendMessage failed: ${errorDetail}`);
    }
  }

  /**
   * Send a document to the configured Telegram chat.
   */
  async sendDocument(filePath: string, caption?: string): Promise<void> {
    try {
      if (!fs.existsSync(filePath)) {
        logger.warn(`File not found for Telegram upload: ${filePath}`);
        return;
      }

      const form = new FormData();
      form.append('chat_id', config.CHAT_ID);
      form.append('document', fs.createReadStream(filePath));
      if (caption) {
        form.append('caption', caption);
      }

      await axios.post(`${this.baseUrl}/sendDocument`, form, {
        headers: {
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      logger.debug(`Successfully sent document ${filePath} to Telegram.`);
    } catch (error: any) {
      const errorDetail = error.response?.data?.description || error.message || String(error);
      logger.error(`Failed to send Telegram document (${filePath}): ${errorDetail}`);
      throw new Error(`Telegram sendDocument failed: ${errorDetail}`);
    }
  }
}

export const telegramClient = new TelegramClient();

