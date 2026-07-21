import { Channel } from '@prisma/client';

export interface ScoringFactors {
  country: string | null;
  businessEmail: string | null;
  productsSold: string[];
  latestUploadDate: Date;
  newsletter: boolean;
  technologies: string[];
  revenueSignals: string[];
  painPoints: string[];
}

/**
 * Calculates a business score out of 100 based on how likely a lead is to
 * buy custom software development services ($10k+ projects).
 * 
 * Scoring breakdown:
 * ┌──────────────────────────────────────────────┬────────┐
 * │ Factor                                        │ Points │
 * ├──────────────────────────────────────────────┼────────┤
 * │ AI: isRealBusiness = true                     │ +15    │
 * │ AI: leadTier = A                              │ +25    │
 * │ AI: leadTier = B                              │ +15    │
 * │ Business email (custom domain)                │ +10    │
 * │ Has payment processing (Stripe etc.)          │ +8     │
 * │ Has team/careers signals                      │ +8     │
 * │ Revenue signals found (pricing, demos, etc.)  │ +10    │
 * │ Pain points detected on website               │ +10    │
 * │ US/UK/CA/AU location                          │ +5     │
 * │ Recent uploads (active channel, ≤45 days)     │ +4     │
 * │ E-commerce / Physical Products                │ +5     │
 * │ B2B / Enterprise / Agency                     │ +10    │
 * │ SaaS / Software                               │ +10    │
 * ├──────────────────────────────────────────────┼────────┤
 * │ PENALTIES                                     │        │
 * ├──────────────────────────────────────────────┼────────┤
 * │ No website or linktree only                   │ -40    │
 * │ Only sells courses/templates (no other biz)   │ -25    │
 * │ AI: leadTier = D                              │ -50    │
 * │ AI: leadTier = C                              │ -15    │
 * │ No business email found                       │ -5     │
 * │ AI: isRealBusiness = false                    │ -30    │
 * └──────────────────────────────────────────────┴────────┘
 */
export function calculateBusinessScore(
  factors: ScoringFactors, 
  aiBusinessType: string,
  aiLeadTier: string,
  aiIsRealBusiness: boolean,
): number {
  let score = 0;

  // ═══ AI QUALIFICATION (biggest weight) ═══

  // AI: Is a real business
  if (aiIsRealBusiness) {
    score += 15;
  } else {
    score -= 30;
  }

  // AI: Lead Tier
  const tier = (aiLeadTier || '').toUpperCase();
  if (tier === 'A') {
    score += 25;
  } else if (tier === 'B') {
    score += 15;
  } else if (tier === 'C') {
    score -= 15;
  } else if (tier === 'D') {
    score -= 50;
  }

  // ═══ CONTACT & REACH ═══

  // Business Email (custom domain = professional)
  if (factors.businessEmail) {
    const isCustomDomain = !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com']
      .some(d => factors.businessEmail!.includes(d));
    score += isCustomDomain ? 10 : 3;
  } else {
    score -= 5;
  }

  // ═══ BUSINESS INFRASTRUCTURE ═══

  // Payment processing
  const hasPayment = factors.technologies.some(t => 
    ['stripe', 'lemonsqueezy', 'shopify'].includes(t.toLowerCase())
  );
  if (hasPayment) {
    score += 8;
  }

  // Team/careers signals (from revenue signals)
  const hasTeamSignals = factors.revenueSignals.some(s => 
    s.toLowerCase().includes('team') || 
    s.toLowerCase().includes('hiring') || 
    s.toLowerCase().includes('careers')
  );
  if (hasTeamSignals) {
    score += 8;
  }

  // Revenue signals (pricing, demos, case studies, etc.)
  if (factors.revenueSignals.length >= 3) {
    score += 10;
  } else if (factors.revenueSignals.length >= 1) {
    score += 5;
  }

  // Pain points (operational needs the agency can solve)
  if (factors.painPoints.length >= 3) {
    score += 10;
  } else if (factors.painPoints.length >= 1) {
    score += 5;
  }

  // ═══ LOCATION ═══

  const highValueCountries = ['US', 'UK', 'GB', 'CA', 'AU', 'NZ', 'IE', 'SG', 'AE', 'DE', 'NL'];
  if (factors.country && highValueCountries.includes(factors.country.toUpperCase())) {
    score += 5;
  }

  // ═══ ACTIVITY ═══

  // Recent uploads (active channel)
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - factors.latestUploadDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  if (diffDays <= 45) {
    score += 4;
  }

  // ═══ BUSINESS TYPE BONUSES ═══

  const lowerProducts = factors.productsSold.map(p => p.toLowerCase());
  const lowerBusinessType = (aiBusinessType || '').toLowerCase();

  // E-commerce / Physical Products (+5)
  const hasEcommerce = lowerProducts.some(p => 
    p.includes('e-commerce') || p.includes('store') || p.includes('physical')
  );
  if (hasEcommerce || factors.technologies.some(t => t.toLowerCase() === 'shopify')) {
    score += 5;
  }

  // B2B / Enterprise / Agency (+10)
  const hasB2B = lowerBusinessType.includes('b2b') || 
    lowerBusinessType.includes('enterprise') || 
    lowerBusinessType.includes('agency');
  if (hasB2B) {
    score += 10;
  }

  // SaaS / Software (+10)
  const hasSaaS = 
    lowerProducts.some(p => p.includes('saas') || p.includes('software')) ||
    lowerBusinessType.includes('saas') ||
    lowerBusinessType.includes('software company');
  if (hasSaaS) {
    score += 10;
  }

  // ═══ PENALTIES ═══

  // Only sells courses/templates with no other business
  const hasLowTicket = lowerProducts.some(p => 
    p.includes('template') || p.includes('course') || p.includes('digital products')
  );
  const hasRealBusiness = hasSaaS || hasB2B || hasEcommerce || 
    lowerProducts.some(p => p.includes('consulting') || p.includes('agency'));
  
  if (hasLowTicket && !hasRealBusiness) {
    score -= 25;
  }

  // Clamp between -100 and 100
  return Math.max(-100, Math.min(score, 100));
}

/**
 * Minimum score threshold for a lead to be exported.
 * Leads below this score are considered not worth pursuing.
 */
export const MINIMUM_EXPORT_SCORE = 40;

/**
 * Lead tiers that qualify for export.
 */
export const QUALIFIED_TIERS = ['A', 'B'];
