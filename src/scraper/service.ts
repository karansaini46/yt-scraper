import { prisma } from '../db/prisma';
import { crawlCreatorWebsite } from './crawler';
import { logger } from '../utils/logger';

export async function runScrapingJob(batchSize = 100) {
  logger.info('Starting web scraping job');

  // Find channels that have a website but haven't been scraped yet
  const channelsToScrape = await prisma.channel.findMany({
    where: {
      website: { not: null },
      scrapedAt: null,
    },
    take: batchSize,
  });

  if (channelsToScrape.length === 0) {
    logger.info('No pending websites to scrape.');
    return;
  }

  const total = channelsToScrape.length;
  logger.info(`📦 Found ${total} websites to scrape (batch size: ${batchSize}).`);

  let completed = 0;

  for (const channel of channelsToScrape) {
    try {
      if (!channel.website) continue;
      
      completed++;
      logger.info(`🌐 Scraping ${completed}/${total}: ${channel.channelName} (${channel.website})`);

      const result = await crawlCreatorWebsite(channel.website);
      
      await prisma.channel.update({
        where: { id: channel.id },
        data: {
          businessEmail: result.businessEmail,
          productsSold: result.productsSold,
          technologies: result.technologies,
          socialLinks: result.socialLinks,
          newsletter: result.newsletter,
          paymentProvider: result.paymentProvider,
          contactPageUrl: result.contactPageUrl,
          revenueSignals: result.revenueSignals,
          painPoints: result.painPoints,
          scrapedAt: new Date(),
        },
      });
      
      logger.info(`✅ [${completed}/${total}] Scraped: ${channel.channelName}`);
    } catch (error: any) {
      completed++;
      logger.error({ error: error.message }, `❌ [${completed}/${total}] Error scraping: ${channel.channelName}`);
      
      // Mark as scraped so we don't infinitely retry failed ones immediately in the next batch
      await prisma.channel.update({
        where: { id: channel.id },
        data: { scrapedAt: new Date() },
      });
    }
  }
  
  logger.info(`📦 Scraping batch complete: ${completed}/${total} processed. Ready for AI verification.`);
}
