import { Type } from '@google/genai';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { GeminiKeyPool } from './key-pool';

// Initialize the key pool with all available Gemini API keys
const keyPool = new GeminiKeyPool(config.geminiApiKeys);

export { keyPool };

export interface CreatorProfileData {
  channelName: string;
  description: string;
  website: string | null;
  businessEmail: string | null;
  productsSold: string[];
  technologies: string[];
  newsletter: boolean;
  paymentProvider: string | null;
  revenueSignals: string[];
  painPoints: string[];
}

export interface AIAnalysisResult {
  isRealBusiness: boolean;
  summary: string;
  businessType: string;
  recommendedSoftware: string[];
  outreachSentence: string;
  leadTier: string;
  estimatedBudget: string;
  qualificationReason: string;
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    isRealBusiness: {
      type: Type.BOOLEAN,
      description: "True ONLY if this creator is running a legitimate business that has real operational complexity and likely $10k+ budget for custom software. False for educators, tutorial channels, solo content creators, or anyone whose only revenue is YouTube ads + affiliate links.",
    },
    summary: {
      type: Type.STRING,
      description: "A concise 1-2 sentence summary of what this creator's BUSINESS does (not their YouTube channel).",
    },
    businessType: {
      type: Type.STRING,
      description: "The primary type of business (e.g., 'E-commerce Brand', 'SaaS Company', 'Marketing Agency', 'Real Estate Brokerage', 'Fitness Franchise', 'Dental Practice'). Use 'Content Creator' or 'Educator' for non-business channels.",
    },
    leadTier: {
      type: Type.STRING,
      description: "Lead quality tier: 'A' = high-ticket prospect with clear software needs and budget ($20k+), 'B' = solid potential with some software needs ($5k-$20k), 'C' = low probability, might need nurturing, 'D' = disqualify (educator, solo creator, no budget, no need).",
    },
    estimatedBudget: {
      type: Type.STRING,
      description: "Estimated software development budget based on business size/type: 'Under $5k (DISQUALIFY)', '$5k-$20k', '$20k-$50k', '$50k+'. Be realistic based on the business indicators.",
    },
    qualificationReason: {
      type: Type.STRING,
      description: "Brutally honest 1-2 sentence explanation of WHY this lead is qualified or disqualified. Be specific about what signals you see.",
    },
    recommendedSoftware: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
      description: "List of SPECIFIC, high-ticket custom software opportunities tailored to THIS business. Not generic suggestions. Example: 'Custom inventory management integrated with their Shopify store', 'Client onboarding portal with automated contract signing', 'AI-powered appointment scheduling system for their dental practice'. Leave empty for disqualified leads.",
    },
    outreachSentence: {
      type: Type.STRING,
      description: "A highly personalized first sentence for a cold email. Reference something SPECIFIC about their business. Position yourself as a Custom Software Agency. Leave empty for disqualified leads.",
    }
  },
  required: ["isRealBusiness", "summary", "businessType", "leadTier", "estimatedBudget", "qualificationReason", "recommendedSoftware", "outreachSentence"],
};

export async function analyzeCreatorProfile(data: CreatorProfileData): Promise<AIAnalysisResult | null> {
  try {
    const prompt = `
You are a STRICT lead qualification expert for a Custom Software Development Agency that charges $10,000-$100,000+ per project. Your job is to ruthlessly filter leads.

═══════════════════════════════════════════════════════
DISQUALIFY IMMEDIATELY (Lead Tier = D) if ANY of these are true:
═══════════════════════════════════════════════════════
- This is a YouTube educator or tutorial channel (teaches coding, marketing, business concepts)
- Their only revenue is courses, templates, PDFs, or ebooks under $500
- They have no real website (just linktree, buymeacoffee, gumroad, or stan.store)
- They are a solo content creator with no team or business infrastructure
- Their "business" is just YouTube ad revenue + affiliate links + sponsorships
- They teach how to do something rather than running a business that does it
- They are a tech reviewer, news channel, or commentary channel

═══════════════════════════════════════════════════════
QUALIFY (Lead Tier A or B) ONLY if:
═══════════════════════════════════════════════════════
- They run an ACTUAL business: e-commerce store, agency, clinic, restaurant, 
  SaaS product, coaching firm with $5k+ packages, real estate brokerage, 
  fitness franchise, dental practice, law firm, construction company, etc.
- They have operational complexity that requires custom software
- They likely have budget ($10k+) based on their business size and type
- There's a SPECIFIC software problem you could solve for them
- They have a real business website with pricing, team pages, case studies, etc.

═══════════════════════════════════════════════════════
ANALYZE THIS CREATOR:
═══════════════════════════════════════════════════════

Channel Name: ${data.channelName}
Channel Description: ${data.description}
Website: ${data.website || 'None'}
Business Email Available: ${data.businessEmail ? 'Yes (' + data.businessEmail + ')' : 'No'}
Products/Services Detected: ${data.productsSold.length > 0 ? data.productsSold.join(', ') : 'None identified'}
Technologies Used: ${data.technologies.length > 0 ? data.technologies.join(', ') : 'None identified'}
Has Newsletter: ${data.newsletter ? 'Yes' : 'No'}
Payment Provider: ${data.paymentProvider || 'None identified'}
Revenue Signals Found: ${data.revenueSignals.length > 0 ? data.revenueSignals.join(', ') : 'None'}
Pain Points Detected: ${data.painPoints.length > 0 ? data.painPoints.join(', ') : 'None'}

Be BRUTALLY HONEST in your qualification. A bad lead wastes everyone's time.
    `;

    // Use the key pool — handles rotation automatically on rate limits
    const responseText = await keyPool.generateContent(
      'gemini-2.5-flash',
      prompt,
      {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.1,
      }
    );

    if (!responseText) {
      throw new Error('No text returned from Gemini API (all keys may be exhausted)');
    }

    const result = JSON.parse(responseText) as AIAnalysisResult;
    return result;
  } catch (error) {
    logger.error('Failed to analyze creator profile with AI:', error);
    return null;
  }
}
