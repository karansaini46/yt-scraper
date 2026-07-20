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
    logger.info('Initializing Creator Lead Finder pipeline...');
    
    // 1. YouTube Discovery Phase
    await withRetry(async () => {
      logger.info('Running Discovery Phase...');
      await runDiscoveryJob();
    }, 3, 5000);
    
    // 2. Web Crawling Phase
    await withRetry(async () => {
      logger.info('Running Scraping Phase...');
      await runScrapingJob(50);
    }, 3, 5000);
    
    // 3. AI Analysis & Scoring Phase
    await withRetry(async () => {
      logger.info('Running Analyzer Phase...');
      await runAnalyzerJob();
    }, 3, 5000);
    
    // 4. Export & Reporting Phase
    let exportedChannels: Channel[] = [];
    await withRetry(async () => {
      logger.info('Running Exporter Phase...');
      exportedChannels = await runExporterJob();
    }, 3, 2000);

    // 5. Telegram Notification Phase
    await withRetry(async () => {
      logger.info('Running Telegram Notification Phase...');
      await runTelegramJob(exportedChannels);
    }, 3, 2000);
    
    logger.info('Pipeline completed successfully.');
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
