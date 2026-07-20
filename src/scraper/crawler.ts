import { fetchWithRetry, resolveUrl } from './fetcher';
import { RobotsChecker } from './robots';
import { extractDataFromHtml, pickBestBusinessEmail, ExtractedData } from './extractors';
import { logger } from '../utils/logger';

export interface CrawlResult {
  businessEmail: string | null;
  productsSold: string[];
  technologies: string[];
  socialLinks: Record<string, string>;
  newsletter: boolean;
  paymentProvider: string | null;
  contactPageUrl: string | null;
}

export async function crawlCreatorWebsite(websiteUrl: string): Promise<CrawlResult> {
  const result: CrawlResult = {
    businessEmail: null,
    productsSold: [],
    technologies: [],
    socialLinks: {},
    newsletter: false,
    paymentProvider: null,
    contactPageUrl: null
  };

  let baseUrl = websiteUrl;
  if (!baseUrl.startsWith('http')) {
    baseUrl = `https://${baseUrl}`;
  }

  logger.info(`Starting crawl for: ${baseUrl}`);

  const robots = new RobotsChecker(baseUrl);
  await robots.initialize();

  if (!robots.isAllowed(baseUrl)) {
    logger.warn(`Crawling disallowed by robots.txt for: ${baseUrl}`);
    return result;
  }

  const homepageHtml = await fetchWithRetry(baseUrl);
  if (!homepageHtml) {
    logger.error(`Failed to fetch homepage for: ${baseUrl}`);
    return result;
  }

  const homepageData = extractDataFromHtml(homepageHtml, baseUrl);
  
  let allEmails: string[] = [...homepageData.emails];
  let allProducts: string[] = [...homepageData.products];
  let allTechnologies: string[] = [...homepageData.technologies];
  result.socialLinks = { ...homepageData.socialLinks };
  result.newsletter = homepageData.newsletter;
  result.paymentProvider = homepageData.paymentProvider;

  // Find contact page for DB explicitly
  const contactLink = homepageData.subpages.find(p => p.toLowerCase().includes('contact'));
  if (contactLink) {
    result.contactPageUrl = resolveUrl(baseUrl, contactLink);
  }

  // Limit subpages to visit to avoid crawling too much (max 5)
  const subpagesToVisit = homepageData.subpages.slice(0, 5);
  
  for (const relativePath of subpagesToVisit) {
    const fullUrl = resolveUrl(baseUrl, relativePath);
    
    if (!robots.isAllowed(fullUrl)) {
      logger.debug(`Skipping disallowed subpage: ${fullUrl}`);
      continue;
    }

    logger.debug(`Visiting subpage: ${fullUrl}`);
    const subpageHtml = await fetchWithRetry(fullUrl);
    
    if (subpageHtml) {
      const subpageData = extractDataFromHtml(subpageHtml, baseUrl);
      
      allEmails = [...allEmails, ...subpageData.emails];
      allProducts = [...allProducts, ...subpageData.products];
      allTechnologies = [...allTechnologies, ...subpageData.technologies];
      
      // Merge social links
      result.socialLinks = { ...result.socialLinks, ...subpageData.socialLinks };
      
      if (subpageData.newsletter) result.newsletter = true;
      if (subpageData.paymentProvider) result.paymentProvider = subpageData.paymentProvider;
    }
  }

  // Deduplicate and process aggregated data
  allEmails = [...new Set(allEmails)];
  result.productsSold = [...new Set(allProducts)];
  result.technologies = [...new Set(allTechnologies)];
  
  result.businessEmail = pickBestBusinessEmail(allEmails, baseUrl);
  
  logger.info(`Crawl complete for ${baseUrl}. Found email: ${result.businessEmail ? 'Yes' : 'No'}`);
  return result;
}
