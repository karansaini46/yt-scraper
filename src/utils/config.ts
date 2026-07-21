import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  DATABASE_URL: z.string().url(),
  YOUTUBE_API_KEY: z.string().min(1, "YouTube API Key is required"),
  GEMINI_API_KEYS: z.string().min(1, "At least one Gemini API Key is required"),
  BOT_TOKEN: z.string().min(1, "Bot Token is required"),
  CHAT_ID: z.string().min(1, "Chat ID is required"),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

/**
 * Parse GEMINI_API_KEYS into an array.
 * Supports comma-separated keys: "key1,key2,key3"
 */
const geminiApiKeys = parsed.data.GEMINI_API_KEYS
  .split(',')
  .map(k => k.trim())
  .filter(k => k.length > 0);

if (geminiApiKeys.length === 0) {
  console.error('❌ GEMINI_API_KEYS must contain at least one valid key');
  process.exit(1);
}

export const config = {
  ...parsed.data,
  geminiApiKeys,
};
