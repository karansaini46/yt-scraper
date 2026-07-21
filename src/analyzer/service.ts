import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';
import { analyzeCreatorProfile, CreatorProfileData, keyPool } from './client';
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

    const total = channelsToAnalyze.length;
    logger.info(`📦 Found ${total} channel(s) to verify with AI. Starting batch verification...`);
    logger.info(`🔑 Using ${keyPool.totalKeys} Gemini API key(s) with auto-rotation`);

    let completed = 0;
    let failed = 0;

    for (const channel of channelsToAnalyze) {
      completed++;
      logger.info(`🔍 AI Verification: ${completed}/${total} — ${channel.channelName} (key #${keyPool.activeKeyNumber}/${keyPool.totalKeys})`);

      const profileData: CreatorProfileData = {
        channelName: channel.channelName,
        description: channel.description,
        website: channel.website,
        businessEmail: channel.businessEmail,
        productsSold: channel.productsSold,
        technologies: channel.technologies,
        newsletter: channel.newsletter,
        paymentProvider: channel.paymentProvider,
        revenueSignals: channel.revenueSignals,
        painPoints: channel.painPoints,
      };

      // 1. AI Analysis (key pool handles rotation automatically)
      const aiResult = await analyzeCreatorProfile(profileData);
      
      if (!aiResult) {
        logger.warn(`⚠️ AI analysis failed for channel: ${channel.channelName} (${channel.id})`);
        failed++;
        continue;
      }

      // 2. Deterministic Scoring (uses AI tier + enriched signals)
      const scoringFactors: ScoringFactors = {
        country: channel.country,
        businessEmail: channel.businessEmail,
        productsSold: channel.productsSold,
        latestUploadDate: channel.latestUploadDate,
        newsletter: channel.newsletter,
        technologies: channel.technologies,
        revenueSignals: channel.revenueSignals,
        painPoints: channel.painPoints,
      };

      const businessScore = calculateBusinessScore(
        scoringFactors, 
        aiResult.businessType,
        aiResult.leadTier,
        aiResult.isRealBusiness,
      );

      // Log the qualification result prominently
      const tierEmoji = aiResult.leadTier === 'A' ? '🔥' : aiResult.leadTier === 'B' ? '✅' : aiResult.leadTier === 'C' ? '⚠️' : '❌';
      logger.info(`${tierEmoji} [${completed}/${total}] ${channel.channelName} | Tier: ${aiResult.leadTier} | Score: ${businessScore} | Budget: ${aiResult.estimatedBudget}`);

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
          leadTier: aiResult.leadTier,
          estimatedBudget: aiResult.estimatedBudget,
          qualificationReason: aiResult.qualificationReason,
          aiAnalyzedAt: new Date(),
        }
      });

      // Short delay between requests (just to be polite, key pool handles real rate limiting)
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    logger.info(`✅ AI Verification complete: ${completed}/${total} processed | ${failed} failed`);
    logger.info('AI Analyzer Job completed successfully.');
  } catch (error) {
    logger.error('Error during AI Analyzer Job:', error);
  }
}
