import { Channel } from '@prisma/client';

export interface ScoringFactors {
  country: string | null;
  businessEmail: string | null;
  productsSold: string[];
  latestUploadDate: Date;
  newsletter: boolean;
  technologies: string[];
}

/**
 * Calculates a deterministic business score out of 100 based on the presence of key factors.
 * - US or UK +25
 * - Business email +15
 * - Selling products +10
 * - Recent uploads (within 45 days) +10
 * - E-commerce / Physical Products +15
 * - B2B / Enterprise / Agency +20
 * - SaaS +20
 * - Penalize Course/Templates -30
 */
export function calculateBusinessScore(factors: ScoringFactors, aiBusinessType: string): number {
  let score = 0;

  // 1. Location: US or UK (+25)
  if (factors.country && ['US', 'UK', 'GB'].includes(factors.country.toUpperCase())) {
    score += 25;
  }

  // 2. Business Email (+15)
  if (factors.businessEmail) {
    score += 15;
  }

  // 3. Selling Products (+10)
  if (factors.productsSold.length > 0) {
    score += 10;
  }

  // 4. Recent Uploads (+10)
  // Assuming a 45-day window for "recent"
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - factors.latestUploadDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  if (diffDays <= 45) {
    score += 10;
  }

  const lowerProducts = factors.productsSold.map(p => p.toLowerCase());
  const lowerTech = factors.technologies.map(t => t.toLowerCase());
  const lowerBusinessType = (aiBusinessType || '').toLowerCase();

  // 5. E-commerce / Physical Products (+15)
  const hasEcommerce = lowerProducts.some(p => p.includes('e-commerce') || p.includes('store') || p.includes('physical'));
  if (hasEcommerce || lowerTech.includes('shopify')) {
    score += 15;
  }

  // 6. B2B / Enterprise / Agency (+20)
  const hasB2B = lowerBusinessType.includes('b2b') || lowerBusinessType.includes('enterprise') || lowerBusinessType.includes('agency');
  if (hasB2B) {
    score += 20;
  }

  // 7. SaaS / Software (+20)
  const hasSaaS = 
    lowerProducts.some(p => p.includes('saas') || p.includes('software')) ||
    lowerBusinessType.includes('saas') ||
    lowerBusinessType.includes('tech');

  if (hasSaaS) {
    score += 20;
  }

  // 8. Penalize Low-ticket info products (-30)
  const hasLowTicket = lowerProducts.some(p => p.includes('template') || p.includes('course') || p.includes('pdf'));
  if (hasLowTicket && !hasSaaS && !hasB2B && !hasEcommerce) {
    score -= 30;
  }

  // Cap at 100
  return Math.min(score, 100);
}
