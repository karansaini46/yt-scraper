import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';
import { telegramClient } from './client';
import * as path from 'path';
import * as fs from 'fs';

import { Channel } from '@prisma/client';

export async function runTelegramJob(channels: Channel[]) {
  logger.info('Starting Telegram Reporting Job...');

  try {
    // 1. Gather Statistics from the new batch
    const totalCreators = channels.length;
    const qualifiedCreators = channels.filter(c => c.businessScore && c.businessScore > 80).length;

    // Get top 10 scoring creators in this batch
    const topCreators = channels
      .filter(c => c.businessScore !== null)
      .sort((a, b) => (b.businessScore || 0) - (a.businessScore || 0))
      .slice(0, 10);

    const dateStr = new Date().toISOString().split('T')[0];

    // 2. Construct Message
    if (qualifiedCreators === 0 && totalCreators === 0) {
      const msg = `*Creator Lead Finder Report - ${dateStr}*\n\nPipeline execution completed, but no channels were processed.`;
      await telegramClient.sendMessage(msg);
      logger.info('Sent zero-creators fallback message to Telegram.');
      return;
    }

    if (qualifiedCreators === 0 && totalCreators > 0) {
      const msg = `*Creator Lead Finder Report - ${dateStr}*\n\nPipeline execution completed.\nTotal creators scanned: ${totalCreators}\n\n*No highly qualified creators found this run.*`;
      await telegramClient.sendMessage(msg);
      logger.info('Sent no-qualified-creators fallback message to Telegram.');
    } else {
      let msg = `*Creator Lead Finder Report - ${dateStr}*\n\n`;
      msg += `✅ *Total Creators Found:* ${totalCreators}\n`;
      msg += `🔥 *Qualified Creators (Score > 80):* ${qualifiedCreators}\n\n`;
      
      msg += `*Top 10 Highest Scoring Creators:*\n`;
      topCreators.forEach((c, i) => {
        msg += `${i + 1}. ${c.channelName} (Score: ${c.businessScore})\n`;
      });

      await telegramClient.sendMessage(msg);
      logger.info('Sent summary message to Telegram.');
    }

    // 3. Send Documents (Markdown, Excel, PDF)
    const mdPath = path.resolve(process.cwd(), 'creator-leads.md');
    const excelPath = path.resolve(process.cwd(), 'creator-leads.xlsx');
    const pdfPath = path.resolve(process.cwd(), 'creator-leads.pdf');

    if (fs.existsSync(mdPath)) {
      await telegramClient.sendDocument(mdPath, 'Markdown Report');
    }
    
    if (fs.existsSync(excelPath)) {
      await telegramClient.sendDocument(excelPath, 'Excel Report');
    }

    if (fs.existsSync(pdfPath)) {
      await telegramClient.sendDocument(pdfPath, 'PDF Report');
    }

    logger.info('Telegram Reporting Job completed successfully.');
  } catch (error) {
    logger.error('Error during Telegram Reporting Job:', error);
    // Re-throw so index.ts knows it failed
    throw error;
  }
}
