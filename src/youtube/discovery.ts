import { searchChannelsByKeyword, getChannelDetails, getLatestVideo } from './client';
import { extractWebsiteFromDescription, meetsSubscriberCriteria, meetsUploadDateCriteria } from './filter';
import { logger } from '../utils/logger';
import { Channel } from '@prisma/client';

export const SEARCH_KEYWORDS = [
  "B2B SaaS",
  "E-commerce Strategy",
  "Real Estate Investing",
  "Fintech",
  "Healthtech",
  "Enterprise Software",
  "Logistics Business",
  "Manufacturing Tech",
  "Startup Funding",
  "Agency Growth"
];

// Define a type for the data we collect before saving to DB
export type DiscoveredChannel = Omit<Channel, 'createdAt' | 'updatedAt'>;

export async function discoverChannels(keyword: string, maxPages = 1): Promise<DiscoveredChannel[]> {
  logger.info(`Starting discovery for keyword: ${keyword}`);
  const discovered: DiscoveredChannel[] = [];
  let pageToken: string | undefined = undefined;

  for (let i = 0; i < maxPages; i++) {
    logger.debug(`Fetching page ${i + 1} for keyword: ${keyword}`);
    const searchResponse = await searchChannelsByKeyword(keyword, 50, pageToken);
    
    if (!searchResponse || !searchResponse.items || searchResponse.items.length === 0) {
      logger.info(`No more channels found for keyword: ${keyword}`);
      break;
    }

    const channelIds = searchResponse.items.map(item => item.id.channelId);
    
    // Process in chunks of 50 (API limit for channels.list)
    const detailsResponse = await getChannelDetails(channelIds);
    if (!detailsResponse || !detailsResponse.items) {
      continue;
    }

    for (const channelItem of detailsResponse.items) {
      const { id, snippet, statistics, brandingSettings } = channelItem;
      const { title, description, country, customUrl } = snippet;
      const { subscriberCount, videoCount } = statistics;

      logger.debug(`Evaluating channel: ${title} (${id})`);

      // Filter: Subscribers
      if (!meetsSubscriberCriteria(subscriberCount)) {
        logger.debug(`Skipping ${title}: Subscriber count ${subscriberCount} out of bounds.`);
        continue;
      }

      // Filter: Website existence
      const websiteFromBranding = brandingSettings?.channel?.unpluggedTrailingLink;
      const websiteFromDescription = extractWebsiteFromDescription(description);
      const website = websiteFromBranding || websiteFromDescription;

      if (!website) {
        logger.debug(`Skipping ${title}: No website found.`);
        continue;
      }

      // Filter: Latest upload date (API calls are expensive, do this last)
      const latestUploadDateISO = await getLatestVideo(id);
      if (!latestUploadDateISO) {
        logger.debug(`Skipping ${title}: Could not fetch latest video.`);
        continue;
      }

      if (!meetsUploadDateCriteria(latestUploadDateISO)) {
        logger.debug(`Skipping ${title}: Last upload ${latestUploadDateISO} is too old.`);
        continue;
      }

      // Passed all filters!
      logger.info(`✅ Found qualified lead: ${title} (${id})`);
      
      discovered.push({
        id,
        channelName: title,
        description,
        subscriberCount: parseInt(subscriberCount, 10),
        videoCount: parseInt(videoCount, 10),
        country: country || null,
        website,
        latestUploadDate: new Date(latestUploadDateISO),
        channelUrl: customUrl ? `https://youtube.com/${customUrl}` : `https://youtube.com/channel/${id}`,
      });
    }

    pageToken = searchResponse.nextPageToken;
    if (!pageToken) {
      break; // No more pages
    }
  }

  logger.info(`Finished discovery for keyword: ${keyword}. Found ${discovered.length} qualified leads.`);
  return discovered;
}
