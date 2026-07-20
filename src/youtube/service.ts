import { discoverChannels, SEARCH_KEYWORDS } from './discovery';
import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';

export async function runDiscoveryJob() {
  logger.info('Starting full discovery job');

  for (const keyword of SEARCH_KEYWORDS) {
    try {
      // Check 3 pages per keyword for more comprehensive discovery
      const channels = await discoverChannels(keyword, 3);
      
      if (channels.length > 0) {
        logger.info(`Saving ${channels.length} channels to database for keyword: ${keyword}`);
        
        for (const channel of channels) {
          await prisma.channel.upsert({
            where: { id: channel.id },
            update: {
              channelName: channel.channelName,
              description: channel.description,
              subscriberCount: channel.subscriberCount,
              videoCount: channel.videoCount,
              country: channel.country,
              website: channel.website,
              latestUploadDate: channel.latestUploadDate,
              channelUrl: channel.channelUrl,
            },
            create: {
              id: channel.id,
              channelName: channel.channelName,
              description: channel.description,
              subscriberCount: channel.subscriberCount,
              videoCount: channel.videoCount,
              country: channel.country,
              website: channel.website,
              latestUploadDate: channel.latestUploadDate,
              channelUrl: channel.channelUrl,
            },
          });
        }
      }
    } catch (error: any) {
      logger.error({ error: error.message }, `Error processing keyword: ${keyword}`);
    }
  }

  logger.info('Finished full discovery job');
}
