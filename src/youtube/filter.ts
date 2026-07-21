export interface FilterCriteria {
  minSubscribers: number;
  maxSubscribers: number;
  maxDaysSinceLastUpload: number;
}

export const defaultCriteria: FilterCriteria = {
  minSubscribers: 10000,
  maxSubscribers: 500000,
  maxDaysSinceLastUpload: 60,
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

// ─── EDUCATOR / TUTORIAL CHANNEL BLOCKLIST ──────────────────────────────────
// These patterns indicate channels that TEACH about topics rather than RUN businesses.
const EDUCATOR_BLOCKLIST_PATTERNS = [
  'learn programming', 'coding tutorial', 'web development tutorial',
  'teach', 'learn to code', 'full course', 'programming language',
  'data structures', 'algorithm', 'hindi tutorial', 'tutorial channel',
  'free course', 'learn python', 'learn java', 'learn javascript',
  'interview preparation', 'placement', 'gate preparation',
  'competitive programming', 'dsa', 'react tutorial', 'node tutorial',
  'flutter tutorial', 'android tutorial', 'ios tutorial',
  'machine learning tutorial', 'deep learning tutorial',
  'i make videos about', 'educational content', 'i teach',
  'training videos', 'online classes', 'certification course',
  'exam preparation', 'study material', 'lectures',
  'coding bootcamp', 'learn for free', 'crash course',
  'beginner to advanced', 'step by step tutorial',
  'automation testing tutorial', 'selenium tutorial', 'cypress tutorial',
  'devops tutorial', 'docker tutorial', 'kubernetes tutorial',
];

/**
 * Detects if a channel is primarily an educator/tutorial channel
 * that would NOT be a buyer of custom software services.
 */
export function isEducatorChannel(description: string, channelName: string): boolean {
  const lowerDesc = description.toLowerCase();
  const lowerName = channelName.toLowerCase();
  
  // Check description against blocklist
  const descMatch = EDUCATOR_BLOCKLIST_PATTERNS.some(pattern => lowerDesc.includes(pattern));
  if (descMatch) return true;
  
  // Check channel name patterns
  const educatorNamePatterns = [
    'tutorial', 'learn', 'academy', 'course', 'education',
    'coding with', 'programming with', 'tech with',
  ];
  const nameMatch = educatorNamePatterns.some(pattern => lowerName.includes(pattern));
  if (nameMatch) return true;

  return false;
}

// ─── BUSINESS SIGNAL DETECTION ──────────────────────────────────────────────
// These patterns indicate the channel owner actually RUNS a business.
const BUSINESS_SIGNAL_PATTERNS = [
  'founder', 'ceo', 'co-founder', 'my company', 'my business',
  'our team', 'we help', 'our clients', 'our customers',
  'i run', 'i own', 'my brand', 'my store', 'our agency',
  'book a call', 'hire us', 'work with us', 'our services',
  'our product', 'my agency', 'my startup', 'built my',
  'scaling my', 'grew my', 'revenue', 'my ecommerce',
  'shopify store', 'amazon fba', 'dropshipping brand',
  'real estate invest', 'property management',
  'dental practice', 'law firm', 'my clinic', 'my gym',
  'my restaurant', 'franchise', 'brick and mortar',
  'saas founder', 'bootstrapped', 'raised funding',
  'series a', 'seed round', 'my portfolio',
  'consulting firm', 'marketing agency', 'design agency',
];

/**
 * Checks if the channel description has signals that the owner runs a real business.
 */
export function hasBusinessSignals(description: string): boolean {
  const lower = description.toLowerCase();
  return BUSINESS_SIGNAL_PATTERNS.some(pattern => lower.includes(pattern));
}

// ─── JUNK WEBSITE DETECTION ─────────────────────────────────────────────────
// These are not real business websites.
const JUNK_WEBSITE_DOMAINS = [
  'linktr.ee', 'linktree.com', 'buymeacoffee.com', 'ko-fi.com',
  'gumroad.com', 'patreon.com', 'beacons.ai', 'stan.store',
  'bio.link', 'campsite.bio', 'carrd.co', 'about.me',
  'allmylinks.com', 'lnk.bio',
];

/**
 * Returns true if the URL is a junk/link-aggregator site rather than a real business website.
 */
export function isJunkWebsite(url: string): boolean {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return JUNK_WEBSITE_DOMAINS.some(domain => parsed.hostname.includes(domain));
  } catch {
    return false;
  }
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
    
    // Prefer non-junk websites, but fallback to junk if nothing else
    const realWebsites = potentialWebsites.filter(url => !isJunkWebsite(url));
    if (realWebsites.length > 0) return realWebsites[0] ?? null;
    
    return potentialWebsites.length > 0 ? (potentialWebsites[0] ?? null) : null;
  }
  return null;
}
