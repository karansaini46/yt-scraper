import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';
import { telegramClient } from './client';
import * as path from 'path';
import * as fs from 'fs';

import { Channel } from '@prisma/client';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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
      const msg = `<b>Creator Lead Finder Report - ${dateStr}</b>\n\nPipeline execution completed.\n\n❌ <b>No qualified leads found this run.</b>\n\nAll leads were filtered out by the quality gate (Score ≥ 40, Tier A/B, Real Business only).`;
      await telegramClient.sendMessage(msg);
      logger.info('Sent no-qualified-leads message to Telegram.');
      return;
    }

    let msg = `<b>🔥 Creator Lead Finder Report - ${dateStr}</b>\n\n`;
    msg += `<b>Qualified Leads Found: ${totalCreators}</b>\n`;
    msg += `🔥 Tier A (High-Ticket): ${tierA}\n`;
    msg += `✅ Tier B (Solid Potential): ${tierB}\n\n`;
    
    msg += `<b>Top Leads:</b>\n`;
    
    // Show top qualified leads (safely chunked under Telegram 4096 char limit)
    let leadCount = 0;
    for (let i = 0; i < channels.length && i < 15; i++) {
      const c = channels[i];
      if (!c) continue;
      const tierEmoji = c.leadTier === 'A' ? '🔥' : '✅';
      const budget = escapeHtml(c.estimatedBudget || 'Unknown');
      const channelName = escapeHtml(c.channelName || 'Unknown Channel');
      const leadLine = `${i + 1}. ${tierEmoji} <b>${channelName}</b> (Score: ${c.businessScore ?? 0}, Budget: ${budget})\n`;
      const reasonLine = c.qualificationReason ? `   <i>${escapeHtml(c.qualificationReason)}</i>\n` : '';

      if ((msg + leadLine + reasonLine).length > 3900) {
        break;
      }

      msg += leadLine + reasonLine;
      leadCount++;
    }

    if (channels.length > leadCount) {
      msg += `\n...and ${channels.length - leadCount} more in the attached reports.`;
    }

    await telegramClient.sendMessage(msg);
    logger.info('Sent summary message to Telegram.');

    // 3. Send Documents (Markdown, Excel, PDF)
    const mdPath = path.resolve(process.cwd(), 'creator-leads.md');
    const excelPath = path.resolve(process.cwd(), 'creator-leads.xlsx');
    const pdfPath = path.resolve(process.cwd(), 'creator-leads.pdf');

    if (fs.existsSync(mdPath)) {
      try {
        await telegramClient.sendDocument(mdPath, 'Markdown Report');
      } catch (err: any) {
        logger.error(`Failed to send Markdown report to Telegram: ${err.message || String(err)}`);
      }
    }
    
    if (fs.existsSync(excelPath)) {
      try {
        await telegramClient.sendDocument(excelPath, 'Excel Report');
      } catch (err: any) {
        logger.error(`Failed to send Excel report to Telegram: ${err.message || String(err)}`);
      }
    }

    if (fs.existsSync(pdfPath)) {
      try {
        await telegramClient.sendDocument(pdfPath, 'PDF Report');
      } catch (err: any) {
        logger.error(`Failed to send PDF report to Telegram: ${err.message || String(err)}`);
      }
    }

    // 4. Cleanup: Delete the local files after sending
    [mdPath, excelPath, pdfPath].forEach(filePath => {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          logger.debug(`Deleted temporary file: ${filePath}`);
        } catch (err: any) {
          logger.error(`Failed to delete temporary file ${filePath}: ${err?.message || String(err)}`);
        }
      }
    });

    logger.info('Telegram Reporting Job completed successfully.');
  } catch (error: any) {
    logger.error(`Error during Telegram Reporting Job: ${error?.message || String(error)}`);
    // Re-throw so index.ts knows it failed
    throw error;
  }
}

