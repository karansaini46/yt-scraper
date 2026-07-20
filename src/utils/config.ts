import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  DATABASE_URL: z.string().url(),
  YOUTUBE_API_KEY: z.string().min(1, "YouTube API Key is required"),
  GEMINI_API_KEY: z.string().min(1, "Gemini API Key is required").optional(),
  BOT_TOKEN: z.string().min(1, "Bot Token is required"),
  CHAT_ID: z.string().min(1, "Chat ID is required"),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
