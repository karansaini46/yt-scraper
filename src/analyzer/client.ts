import { GoogleGenAI, Type } from '@google/genai';
import { logger } from '../utils/logger';

// Initialize the client. We assume GEMINI_API_KEY is available in the environment.
const ai = new GoogleGenAI({});

export interface CreatorProfileData {
  channelName: string;
  description: string;
  website: string | null;
  businessEmail: string | null;
  productsSold: string[];
  technologies: string[];
  newsletter: boolean;
  paymentProvider: string | null;
}

export interface AIAnalysisResult {
  isRealBusiness: boolean;
  summary: string;
  businessType: string;
  recommendedSoftware: string[];
  outreachSentence: string;
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    isRealBusiness: {
      type: Type.BOOLEAN,
      description: "True if this creator appears to be running a legitimate business (selling products, services, courses, SaaS, etc.), false otherwise.",
    },
    summary: {
      type: Type.STRING,
      description: "A concise 1-2 sentence summary of what this creator's business does.",
    },
    businessType: {
      type: Type.STRING,
      description: "The primary type of business (e.g., Online Course, SaaS, Agency, Newsletter, E-commerce).",
    },
    recommendedSoftware: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
      description: "List of high-ticket custom software opportunities (e.g., Enterprise CRM, Custom Client Portal, AI automation suite, Headless E-commerce, Inventory Management). Do not suggest basic tools like Notion or Kajabi.",
    },
    outreachSentence: {
      type: Type.STRING,
      description: "A highly personalized first sentence for a cold email positioning you as a Custom Software Agency that can build complex tech solutions for their specific business model.",
    }
  },
  required: ["isRealBusiness", "summary", "businessType", "recommendedSoftware", "outreachSentence"],
};

export async function analyzeCreatorProfile(data: CreatorProfileData): Promise<AIAnalysisResult | null> {
  try {
    const prompt = `
Analyze the following YouTube creator profile and their business data:

Channel Name: ${data.channelName}
Description: ${data.description}
Website: ${data.website || 'None'}
Business Email Available: ${data.businessEmail ? 'Yes' : 'No'}
Products Sold: ${data.productsSold.length > 0 ? data.productsSold.join(', ') : 'None identified'}
Technologies Used: ${data.technologies.length > 0 ? data.technologies.join(', ') : 'None identified'}
Has Newsletter: ${data.newsletter ? 'Yes' : 'No'}
Payment Provider: ${data.paymentProvider || 'None identified'}

Please analyze this data to determine if they are running a real business with sufficient complexity/revenue to afford a high-ticket Custom Software Development Agency (minimum $10k+ budget). 
Generate a personalized first outreach sentence to pitch them on building custom enterprise software, mobile apps, or complex automations.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.2, // Low temperature for more deterministic/factual output
      }
    });

    if (!response.text) {
      throw new Error('No text returned from Gemini API');
    }

    const result = JSON.parse(response.text) as AIAnalysisResult;
    return result;
  } catch (error) {
    logger.error('Failed to analyze creator profile with AI:', error);
    return null;
  }
}
