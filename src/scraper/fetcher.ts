import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { logger } from '../utils/logger';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export const fetcher: AxiosInstance = axios.create({
  timeout: 10000,
  maxRedirects: 5,
  headers: {
    'User-Agent': 'CreatorLeadFinderBot/1.0 (+https://example.com)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  },
});

export async function fetchWithRetry(url: string, retries = 0): Promise<string | null> {
  try {
    const response = await fetcher.get(url);
    if (typeof response.data === 'string') {
      return response.data;
    }
    return null;
  } catch (error) {
    const axiosError = error as AxiosError;
    
    // Check if it's a 404, no point in retrying
    if (axiosError.response && axiosError.response.status === 404) {
      logger.warn(`Not Found (404) for URL: ${url}`);
      return null;
    }

    if (retries < MAX_RETRIES) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, retries);
      logger.warn(`Fetch failed for ${url}. Retrying in ${backoff}ms... (${retries + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithRetry(url, retries + 1);
    }
    
    logger.error(`Max retries reached for ${url}. Error: ${axiosError.message}`);
    return null;
  }
}

export function resolveUrl(baseUrl: string, relativeOrAbsolute: string): string {
  try {
    return new URL(relativeOrAbsolute, baseUrl).href;
  } catch {
    return relativeOrAbsolute;
  }
}
