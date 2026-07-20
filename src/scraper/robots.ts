import robotsParser from 'robots-parser';
import { fetchWithRetry } from './fetcher';
import { logger } from '../utils/logger';

export class RobotsChecker {
  private parser: any = null;
  private isLoaded = false;
  private readonly userAgent = 'CreatorLeadFinderBot';

  constructor(private readonly baseUrl: string) {}

  async initialize(): Promise<void> {
    try {
      const robotsUrl = new URL('/robots.txt', this.baseUrl).href;
      const robotsTxtContent = await fetchWithRetry(robotsUrl, 1);
      
      if (robotsTxtContent) {
        this.parser = robotsParser(robotsUrl, robotsTxtContent);
      } else {
        logger.debug(`No robots.txt found for ${this.baseUrl}, assuming allowed.`);
      }
    } catch (error) {
      logger.debug(`Failed to fetch robots.txt for ${this.baseUrl}, assuming allowed.`);
    } finally {
      this.isLoaded = true;
    }
  }

  isAllowed(url: string): boolean {
    if (!this.isLoaded) {
      logger.warn(`RobotsChecker called before initialization for ${url}`);
      return true;
    }

    if (!this.parser) {
      return true; // No robots.txt means everything is allowed
    }

    const isAllowed = this.parser.isAllowed(url, this.userAgent);
    // robots-parser returns undefined if not explicitly disallowed
    return isAllowed === undefined ? true : isAllowed;
  }
}
