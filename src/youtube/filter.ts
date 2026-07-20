export interface FilterCriteria {
  minSubscribers: number;
  maxSubscribers: number;
  maxDaysSinceLastUpload: number;
}

export const defaultCriteria: FilterCriteria = {
  minSubscribers: 30000,
  maxSubscribers: 500000,
  maxDaysSinceLastUpload: 45,
};

export function meetsSubscriberCriteria(subscriberCount: string, criteria: FilterCriteria = defaultCriteria): boolean {
  const subs = parseInt(subscriberCount, 10);
  if (isNaN(subs)) return false;
  return subs >= criteria.minSubscribers && subs <= criteria.maxSubscribers;
}

export function meetsUploadDateCriteria(latestUploadDateISO: string, criteria: FilterCriteria = defaultCriteria): boolean {
  const uploadDate = new Date(latestUploadDateISO);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - uploadDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  return diffDays <= criteria.maxDaysSinceLastUpload;
}

/**
 * Extracts a website URL from a channel description.
 * Extremely basic regex to find http/https links.
 */
export function extractWebsiteFromDescription(description: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = description.match(urlRegex);
  
  if (matches && matches.length > 0) {
    // Filter out common non-website links (youtube, twitter, instagram, etc.)
    const socialDomains = ['youtube.com', 'twitter.com', 'instagram.com', 'facebook.com', 'tiktok.com', 'linkedin.com', 't.me'];
    const potentialWebsites = matches.filter(url => {
      try {
        const parsed = new URL(url);
        return !socialDomains.some(domain => parsed.hostname.includes(domain));
      } catch {
        return false;
      }
    });
    
    return potentialWebsites.length > 0 ? potentialWebsites[0] : null;
  }
  return null;
}
