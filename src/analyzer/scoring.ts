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
 * Scoring factors:
 * - US or UK +25
 * - Business email +15
 * - Selling products +20
 * - Recent uploads (within 45 days) +10
 * - Newsletter +10
 * - Paid community (inferred from products/tech) +10
 * - SaaS (inferred from products/tech) +20
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

  // 3. Selling Products (+20)
  if (factors.productsSold.length > 0) {
    score += 20;
  }

  // 4. Recent Uploads (+10)
  // Assuming a 45-day window for "recent"
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - factors.latestUploadDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  if (diffDays <= 45) {
    score += 10;
  }

  // 5. Newsletter (+10)
  if (factors.newsletter) {
    score += 10;
  }

  // Helper arrays for inferring Paid Community and SaaS
  const lowerProducts = factors.productsSold.map(p => p.toLowerCase());
  const lowerTech = factors.technologies.map(t => t.toLowerCase());
  const lowerBusinessType = (aiBusinessType || '').toLowerCase();

  // 6. Paid Community (+10)
  // Check if Skool, Circle, Discord, or keywords are present
  const hasCommunity = 
    lowerTech.includes('skool') || 
    lowerTech.includes('circle') || 
    lowerTech.includes('discord') ||
    lowerProducts.some(p => p.includes('community') || p.includes('membership')) ||
    lowerBusinessType.includes('community');

  if (hasCommunity) {
    score += 10;
  }

  // 7. SaaS (+20)
  const hasSaaS = 
    lowerProducts.some(p => p.includes('saas') || p.includes('software')) ||
    lowerBusinessType.includes('saas');

  if (hasSaaS) {
    score += 20;
  }

  // Cap at 100
  return Math.min(score, 100);
}
