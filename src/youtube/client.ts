import axios from 'axios';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

const apiClient = axios.create({
  baseURL: YOUTUBE_API_BASE_URL,
  params: {
    key: config.YOUTUBE_API_KEY,
  },
});

export interface SearchChannelResponse {
  items: Array<{
    id: { channelId: string };
    snippet: {
      channelTitle: string;
      description: string;
      publishedAt: string;
    };
  }>;
  nextPageToken?: string;
}

export interface ChannelDetailsResponse {
  items: Array<{
    id: string;
    snippet: {
      title: string;
      description: string;
      country?: string;
      customUrl?: string;
    };
    statistics: {
      subscriberCount: string;
      videoCount: string;
      viewCount: string;
    };
    brandingSettings?: {
      channel?: {
        unpluggedTrailingLink?: string;
      };
    };
  }>;
}

export interface SearchVideoResponse {
  items: Array<{
    snippet: {
      publishedAt: string;
    };
  }>;
}

export async function searchChannelsByKeyword(keyword: string, maxResults: number = 50, pageToken?: string): Promise<SearchChannelResponse | null> {
  try {
    const response = await apiClient.get<SearchChannelResponse>('/search', {
      params: {
        part: 'snippet',
        type: 'channel',
        q: keyword,
        maxResults,
        pageToken,
      },
    });
    return response.data;
  } catch (error: any) {
    logger.error({ error: error.message }, `Error searching channels for keyword: ${keyword}`);
    return null;
  }
}

export async function getChannelDetails(channelIds: string[]): Promise<ChannelDetailsResponse | null> {
  try {
    const response = await apiClient.get<ChannelDetailsResponse>('/channels', {
      params: {
        part: 'snippet,statistics,brandingSettings',
        id: channelIds.join(','),
      },
    });
    return response.data;
  } catch (error: any) {
    logger.error({ error: error.message }, `Error fetching details for channels`);
    return null;
  }
}

export async function getLatestVideo(channelId: string): Promise<string | null> {
  try {
    const response = await apiClient.get<SearchVideoResponse>('/search', {
      params: {
        part: 'snippet',
        channelId,
        order: 'date',
        type: 'video',
        maxResults: 1,
      },
    });
    
    if (response.data.items && response.data.items.length > 0) {
      return response.data.items[0].snippet.publishedAt;
    }
    return null;
  } catch (error: any) {
    logger.error({ error: error.message, channelId }, `Error fetching latest video for channel: ${channelId}`);
    return null;
  }
}
