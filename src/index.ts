import { runDiscoveryJob } from './youtube/service';
import { runScrapingJob } from './scraper/service';
import { runAnalyzerJob } from './analyzer/service';
import { runExporterJob } from './exporter/service';
import { runTelegramJob } from './telegram/service';
import { logger } from './utils/logger';
import { prisma } from './db/prisma';
import { withRetry } from './utils/retry';
import { Channel } from '@prisma/client';

export async function runPipeline() {
  try {
    logger.info('═══════════════════════════════════════════════════');
    logger.info('🚀 Initializing Creator Lead Finder pipeline...');
    logger.info('═══════════════════════════════════════════════════');
    
    // ─── PHASE 1: YouTube Discovery ────────────────────────────
    await withRetry(async () => {
      logger.info('📡 Phase 1/5: YouTube Discovery...');
      await runDiscoveryJob();
    }, 3, 5000);
    
    // ─── PHASE 2: Web Scraping (batch of 100) ──────────────────
    await withRetry(async () => {
      logger.info('🌐 Phase 2/5: Web Scraping (batch of 100)...');
      await runScrapingJob(100);
    }, 3, 5000);

    logger.info('═══════════════════════════════════════════════════');
    logger.info('📦 100 leads scraped. Starting AI verification...');
    logger.info('═══════════════════════════════════════════════════');

    // ─── PHASE 3: AI Verification with Key Rotation ────────────
    await withRetry(async () => {
      logger.info('🤖 Phase 3/5: AI Verification (multi-key rotation)...');
      await runAnalyzerJob();
    }, 3, 5000);
    
    // ─── PHASE 4: Export & Reporting ───────────────────────────
    let exportedChannels: Channel[] = [];
    await withRetry(async () => {
      logger.info('📊 Phase 4/5: Export & Reporting...');
      exportedChannels = await runExporterJob();
    }, 3, 2000);

    // ─── PHASE 5: Telegram Notification ────────────────────────
    await withRetry(async () => {
      logger.info('📲 Phase 5/5: Telegram Notification...');
      await runTelegramJob(exportedChannels);
    }, 3, 2000);
    
    logger.info('═══════════════════════════════════════════════════');
    logger.info('✅ Pipeline completed successfully.');
    logger.info('═══════════════════════════════════════════════════');
  } catch (error) {
    logger.error('An error occurred during pipeline execution:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Allow running directly via CLI for testing
if (require.main === module) {
  runPipeline();
}
