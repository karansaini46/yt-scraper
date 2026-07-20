import { prisma } from '../db/prisma';
import { crawlCreatorWebsite } from './crawler';
import { logger } from '../utils/logger';

export async function runScrapingJob(batchSize = 10) {
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

  logger.info(`Found ${channelsToScrape.length} websites to scrape.`);

  for (const channel of channelsToScrape) {
    try {
      if (!channel.website) continue;
      
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
          scrapedAt: new Date(),
        },
      });
      
      logger.info(`Successfully updated database for channel: ${channel.channelName}`);
    } catch (error: any) {
      logger.error({ error: error.message }, `Error processing scraping for channel: ${channel.id}`);
      
      // Mark as scraped so we don't infinitely retry failed ones immediately in the next batch
      // Alternatively, we could add a `scrapeError` column
      await prisma.channel.update({
        where: { id: channel.id },
        data: { scrapedAt: new Date() },
      });
    }
  }
  
  logger.info('Finished web scraping job');
}
