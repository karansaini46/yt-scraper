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
      description: "True if this creator is running a legitimate business, is a rapidly growing solo creator, or runs a business using link-in-bio tools. False ONLY for purely educational/tutorial channels or completely irrelevant content.",
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
      description: "Lead quality tier: 'A' = high-ticket prospect or rapidly growing creator who can pay for a website/software, 'B' = solid potential with some software needs, 'C' = low probability, 'D' = disqualify (educator, irrelevant).",
    },
    estimatedBudget: {
      type: Type.STRING,
      description: "Estimated budget based on their audience size or business signals (e.g., 'Unknown', '$1k-$5k', '$5k+').",
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
- They are a tech reviewer, news channel, or commentary channel

═══════════════════════════════════════════════════════
QUALIFY (Lead Tier A or B) ONLY if:
═══════════════════════════════════════════════════════
- They run an ACTUAL business (e-commerce, agency, clinic, SaaS, real estate, etc.)
- OR they are a rapidly growing solo content creator who could pay for a custom website or software tools
- They use Linktree, Gumroad, Stan.store, or BuyMeACoffee (these are VALID and should be qualified if they have an audience)
- There is a software problem you could solve for them or a custom website they need

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
    logger.error({ err: error }, 'Failed to analyze creator profile with AI');
    return null;
  }
}
