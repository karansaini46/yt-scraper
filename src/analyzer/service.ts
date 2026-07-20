import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';
import { analyzeCreatorProfile, CreatorProfileData } from './client';
import { calculateBusinessScore, ScoringFactors } from './scoring';

export async function runAnalyzerJob() {
  logger.info('Starting AI Analyzer Job...');

  try {
    // Find channels that have been scraped but not yet analyzed by AI
    const channelsToAnalyze = await prisma.channel.findMany({
      where: {
        scrapedAt: { not: null },
        aiAnalyzedAt: null,
      },
    });

    if (channelsToAnalyze.length === 0) {
      logger.info('No channels left to analyze. Exiting Analyzer Job.');
      return;
    }

    logger.info(`Found ${channelsToAnalyze.length} channel(s) to analyze.`);

    for (const channel of channelsToAnalyze) {
      logger.info(`Analyzing channel: ${channel.channelName} (${channel.id})`);

      const profileData: CreatorProfileData = {
        channelName: channel.channelName,
        description: channel.description,
        website: channel.website,
        businessEmail: channel.businessEmail,
        productsSold: channel.productsSold,
        technologies: channel.technologies,
        newsletter: channel.newsletter,
        paymentProvider: channel.paymentProvider,
      };

      // 1. AI Analysis
      const aiResult = await analyzeCreatorProfile(profileData);
      
      if (!aiResult) {
        logger.warn(`AI analysis failed or returned null for channel: ${channel.id}`);
        continue;
      }

      // 2. Deterministic Scoring
      const scoringFactors: ScoringFactors = {
        country: channel.country,
        businessEmail: channel.businessEmail,
        productsSold: channel.productsSold,
        latestUploadDate: channel.latestUploadDate,
        newsletter: channel.newsletter,
        technologies: channel.technologies,
      };

      const businessScore = calculateBusinessScore(scoringFactors, aiResult.businessType);

      // 3. Save to database
      await prisma.channel.update({
        where: { id: channel.id },
        data: {
          businessScore,
          aiSummary: aiResult.summary,
          businessType: aiResult.businessType,
          recommendedSoftware: aiResult.recommendedSoftware,
          outreachLine: aiResult.outreachSentence,
          isRealBusiness: aiResult.isRealBusiness,
          aiAnalyzedAt: new Date(),
        }
      });

      logger.info(`✅ Successfully analyzed and scored channel: ${channel.channelName} (Score: ${businessScore})`);
      
      // Basic rate limiting / delay between requests to avoid hitting AI quotas too hard
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    logger.info('AI Analyzer Job completed successfully.');
  } catch (error) {
    logger.error('Error during AI Analyzer Job:', error);
  }
}
