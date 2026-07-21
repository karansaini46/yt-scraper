import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';
import { telegramClient } from './client';
import * as path from 'path';
import * as fs from 'fs';

import { Channel } from '@prisma/client';

export async function runTelegramJob(channels: Channel[]) {
  logger.info('Starting Telegram Reporting Job...');

  try {
    // 1. Gather Statistics from the qualified batch
    const totalCreators = channels.length;
    const tierA = channels.filter(c => c.leadTier?.toUpperCase() === 'A').length;
    const tierB = channels.filter(c => c.leadTier?.toUpperCase() === 'B').length;

    const dateStr = new Date().toISOString().split('T')[0];

    // 2. Construct Message
    if (totalCreators === 0) {
      const msg = `*Creator Lead Finder Report - ${dateStr}*\n\nPipeline execution completed.\n\n❌ *No qualified leads found this run.*\n\nAll leads were filtered out by the quality gate (Score ≥ 40, Tier A/B, Real Business only).`;
      await telegramClient.sendMessage(msg);
      logger.info('Sent no-qualified-leads message to Telegram.');
      return;
    }

    let msg = `*🔥 Creator Lead Finder Report - ${dateStr}*\n\n`;
    msg += `*Qualified Leads Found: ${totalCreators}*\n`;
    msg += `🔥 Tier A (High-Ticket): ${tierA}\n`;
    msg += `✅ Tier B (Solid Potential): ${tierB}\n\n`;
    
    msg += `*Top Leads:*\n`;
    
    // Show all qualified leads (they're already filtered)
    channels.slice(0, 15).forEach((c, i) => {
      const tierEmoji = c.leadTier === 'A' ? '🔥' : '✅';
      const budget = c.estimatedBudget || 'Unknown';
      msg += `${i + 1}. ${tierEmoji} *${c.channelName}* (Score: ${c.businessScore}, Budget: ${budget})\n`;
      if (c.qualificationReason) {
        msg += `   _${c.qualificationReason}_\n`;
      }
    });

    if (channels.length > 15) {
      msg += `\n...and ${channels.length - 15} more in the attached reports.`;
    }

    await telegramClient.sendMessage(msg);
    logger.info('Sent summary message to Telegram.');

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

    // 4. Cleanup: Delete the local files after sending
    [mdPath, excelPath, pdfPath].forEach(filePath => {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          logger.debug(`Deleted temporary file: ${filePath}`);
        } catch (err) {
          logger.error(`Failed to delete temporary file ${filePath}:`, err);
        }
      }
    });

    logger.info('Telegram Reporting Job completed successfully.');
  } catch (error) {
    logger.error('Error during Telegram Reporting Job:', error);
    // Re-throw so index.ts knows it failed
    throw error;
  }
}
