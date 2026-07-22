import { searchChannelsByKeyword, getChannelDetails, getLatestVideo } from './client';
import { extractWebsiteFromDescription, meetsSubscriberCriteria, meetsUploadDateCriteria, isEducatorChannel, hasBusinessSignals, isJunkWebsite } from './filter';
import { logger } from '../utils/logger';
import { prisma } from '../db/prisma';

// ─── OPTIMIZED KEYWORDS ─────────────────────────────────────────────────────
// Target channels run by BUSINESS OWNERS, not educators/tutorial channels.
// These keywords find people who are sharing their business journey,
// not teaching how to code or do marketing.
export const SEARCH_KEYWORDS = [
  // Business owners documenting their journey
  "my ecommerce brand journey",
  "scaling my business to 7 figures",
  "behind the scenes of my company",
  "how I built my business",
  "my SaaS startup journey",
  "day in the life of a CEO",
  "how I run my ecommerce store",
  "my agency journey",
  "growing my brand",
  "my product business",
  "running a DTC brand",
  "my Shopify store results",
  "scaling my coaching business",

  // Service business owners
  "real estate agency marketing",
  "gym owner business tips",
  "dental practice growth",
  "restaurant business owner",
  "fitness brand owner",
  "clinic business growth",
  "law firm marketing",

  // Tech-forward business owners (NOT educators)
  "SaaS founder journey",
  "bootstrapped startup",
  "my app business",
  "building a tech company",
  "startup founder vlog",

  // High-revenue niche businesses
  "Amazon FBA brand",
  "dropshipping brand results",
  "franchise owner",
  "property management business",
  "construction company owner",
  "manufacturing business owner",
];

// Define a type for the data we collect during discovery (subset of Channel fields)
export interface DiscoveredChannel {
  id: string;
  channelName: string;
  description: string;
  subscriberCount: number;
  videoCount: number;
  country: string | null;
  website: string;
  latestUploadDate: Date;
  channelUrl: string;
}

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

    const rawChannelIds = searchResponse.items.map(item => item.id.channelId);
    
    // Check which of these channels we already have in our database to prevent re-processing
    // This saves massive amounts of YouTube API quota.
    const existingChannels = await prisma.channel.findMany({
      where: { id: { in: rawChannelIds } },
      select: { id: true }
    });
    const existingIds = new Set(existingChannels.map(c => c.id));
    
    const newChannelIds = rawChannelIds.filter(id => !existingIds.has(id));

    if (newChannelIds.length === 0) {
      logger.info(`All ${rawChannelIds.length} channels from this page are already in the database. Skipping to save quota.`);
      pageToken = searchResponse.nextPageToken;
      if (!pageToken) break;
      continue;
    }
    
    // Process the new channels
    const detailsResponse = await getChannelDetails(newChannelIds);
    if (!detailsResponse || !detailsResponse.items) {
      continue;
    }

    for (const channelItem of detailsResponse.items) {
      const { id, snippet, statistics, brandingSettings } = channelItem;
      const { title, description, country, customUrl } = snippet;
      const { subscriberCount, videoCount } = statistics;

      logger.debug(`Evaluating channel: ${title} (${id})`);

      // Filter 1: Subscribers
      if (!meetsSubscriberCriteria(subscriberCount)) {
        logger.debug(`Skipping ${title}: Subscriber count ${subscriberCount} out of bounds.`);
        continue;
      }

      // Filter 2: EDUCATOR BLOCKLIST — reject tutorial/coding channels
      if (isEducatorChannel(description, title)) {
        logger.info(`🚫 Blocked educator channel: ${title}`);
        continue;
      }

      // Filter 3: Website existence
      const websiteFromBranding = brandingSettings?.channel?.unpluggedTrailingLink;
      const websiteFromDescription = extractWebsiteFromDescription(description);
      const website = websiteFromBranding || websiteFromDescription;

      if (!website) {
        logger.debug(`Skipping ${title}: No website found.`);
        continue;
      }

      // Filter 4: Junk websites (Linktree, etc.) are now ALLOWED, 
      // so we no longer block them here. The AI will judge if they are valid.

      // Filter 5: Latest upload date (API calls are expensive, do this last)
      const latestUploadDateISO = await getLatestVideo(id);
      if (!latestUploadDateISO) {
        logger.debug(`Skipping ${title}: Could not fetch latest video.`);
        continue;
      }

      if (!meetsUploadDateCriteria(latestUploadDateISO)) {
        logger.debug(`Skipping ${title}: Last upload ${latestUploadDateISO} is too old.`);
        continue;
      }

      // Check for business signals (bonus, not a hard filter — let AI decide)
      const hasBizSignals = hasBusinessSignals(description);
      if (hasBizSignals) {
        logger.info(`✅ Found qualified lead with business signals: ${title} (${id})`);
      } else {
        logger.info(`⚠️  Found lead (no explicit business signals): ${title} (${id})`);
      }
      
      // Passed all filters!
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
