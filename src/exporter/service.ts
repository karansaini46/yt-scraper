import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';
import { Channel } from '@prisma/client';
import { MINIMUM_EXPORT_SCORE, QUALIFIED_TIERS } from '../analyzer/scoring';
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit-table';

export async function runExporterJob(): Promise<Channel[]> {
  logger.info('Starting Exporter Job...');

  try {
    // 1. Fetch analyzed channels WITH QUALITY GATE
    const allAnalyzed = await prisma.channel.findMany({
      where: {
        aiAnalyzedAt: { not: null },
        exportedAt: null,
      },
      orderBy: {
        businessScore: 'desc',
      },
    });

    if (allAnalyzed.length === 0) {
      logger.info('No analyzed channels found to export.');
      return [];
    }

    // ═══ QUALITY GATE: Only export qualified leads ═══
    const ALLOWED_COUNTRIES = [
      'US', 'GB', 'UK',
      // Europe
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
      'CH', 'NO', 'IS', 'LI'
    ];
    const qualifiedChannels = allAnalyzed.filter(c => {
      const meetsScoreThreshold = (c.businessScore ?? 0) >= MINIMUM_EXPORT_SCORE;
      const meetsLeadTier = c.leadTier ? QUALIFIED_TIERS.includes(c.leadTier.toUpperCase()) : false;
      const isRealBiz = c.isRealBusiness === true;
      const isAllowedCountry = !c.country || ALLOWED_COUNTRIES.includes(c.country.toUpperCase());
      
      return meetsScoreThreshold && meetsLeadTier && isRealBiz && isAllowedCountry;
    });

    const rejectedCount = allAnalyzed.length - qualifiedChannels.length;
    logger.info(`Quality Gate: ${qualifiedChannels.length} qualified / ${rejectedCount} rejected out of ${allAnalyzed.length} total.`);

    if (qualifiedChannels.length === 0) {
      logger.info('No channels passed the quality gate. Nothing to export.');
      // Still mark all as exported so they don't get re-processed
      await prisma.channel.updateMany({
        where: { id: { in: allAnalyzed.map(c => c.id) } },
        data: { exportedAt: new Date() },
      });
      return [];
    }

    // 2. Deduplicate by ID (should already be unique, but safety check)
    const uniqueChannelsMap = new Map<string, Channel>();
    for (const channel of qualifiedChannels) {
      if (!uniqueChannelsMap.has(channel.id)) {
        uniqueChannelsMap.set(channel.id, channel);
      }
    }
    const uniqueChannels = Array.from(uniqueChannelsMap.values());

    // Sort by: Tier A first, then by Score descending
    uniqueChannels.sort((a, b) => {
      const tierOrder: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
      const aTier = tierOrder[(a.leadTier || 'D').toUpperCase()] ?? 3;
      const bTier = tierOrder[(b.leadTier || 'D').toUpperCase()] ?? 3;
      if (aTier !== bTier) return aTier - bTier;
      return (b.businessScore || 0) - (a.businessScore || 0);
    });

    logger.info(`Exporting ${uniqueChannels.length} qualified creator leads.`);

    // 3. Generate Reports
    await generateMarkdownReport(uniqueChannels);
    await generateExcelReport(uniqueChannels);
    await generatePdfReport(uniqueChannels);

    // 4. Mark ALL analyzed channels as exported (including rejected ones)
    await prisma.channel.updateMany({
      where: {
        id: { in: allAnalyzed.map(c => c.id) }
      },
      data: {
        exportedAt: new Date()
      }
    });

    logger.info('Exporter Job completed successfully.');
    return uniqueChannels;
  } catch (error) {
    logger.error({ err: error }, 'Error during Exporter Job');
    return [];
  }
}

async function generateMarkdownReport(channels: Channel[]) {
  const mdPath = path.resolve(process.cwd(), 'creator-leads.md');
  
  let mdContent = `# 🔥 Qualified Creator Leads Report\n\n`;
  mdContent += `Generated on: ${new Date().toISOString().split('T')[0]}\n`;
  mdContent += `**Total Qualified Leads: ${channels.length}** (Score ≥ ${MINIMUM_EXPORT_SCORE}, Tier A/B only)\n\n`;
  mdContent += `| Tier | Creator Name | YouTube URL | Website | Email | Score | Budget | Qualification | Recommended Services | Outreach Line |\n`;
  mdContent += `|---|---|---|---|---|---|---|---|---|---|\n`;

  for (const c of channels) {
    const tierEmoji = c.leadTier === 'A' ? '🔥 A' : '✅ B';
    const nameStr = c.leadTier === 'A' ? `**${c.channelName}**` : c.channelName;
    
    const website = c.website ? `[Link](${c.website})` : '-';
    const email = c.businessEmail || '-';
    const budget = c.estimatedBudget || '-';
    const qualification = (c.qualificationReason || '-').replace(/\|/g, '/');
    const services = c.recommendedSoftware.length > 0 ? c.recommendedSoftware.join(', ') : '-';
    const outreach = (c.outreachLine || '-').replace(/\|/g, '/');
    
    mdContent += `| ${tierEmoji} | ${nameStr} | [YouTube](${c.channelUrl}) | ${website} | ${email} | ${c.businessScore || 0} | ${budget} | ${qualification} | ${services} | ${outreach} |\n`;
  }

  fs.writeFileSync(mdPath, mdContent, 'utf-8');
  logger.info(`Saved Markdown report to ${mdPath}`);
}

async function generateExcelReport(channels: Channel[]) {
  const excelPath = path.resolve(process.cwd(), 'creator-leads.xlsx');
  
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Qualified Leads');

  // Define Columns — optimized for actionable outreach
  sheet.columns = [
    { header: 'Tier', key: 'tier', width: 8 },
    { header: 'Creator Name', key: 'name', width: 25 },
    { header: 'YouTube URL', key: 'yt', width: 40 },
    { header: 'Website', key: 'website', width: 30 },
    { header: 'Business Email', key: 'email', width: 30 },
    { header: 'Score', key: 'score', width: 10 },
    { header: 'Est. Budget', key: 'budget', width: 15 },
    { header: 'Business Type', key: 'bizType', width: 20 },
    { header: 'Qualification', key: 'qualification', width: 50 },
    { header: 'Recommended Services', key: 'services', width: 50 },
    { header: 'Opening Line', key: 'outreach', width: 60 },
    { header: 'Revenue Signals', key: 'revSignals', width: 35 },
    { header: 'Pain Points', key: 'painPts', width: 35 },
    { header: 'Tech Stack', key: 'tech', width: 25 },
    { header: 'Country', key: 'country', width: 10 },
    { header: 'Subscribers', key: 'subs', width: 12 },
  ];

  // Style the header row
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' }, // Dark header
  };
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 16 }
  };

  for (const c of channels) {
    const row = sheet.addRow({
      tier: c.leadTier || '-',
      name: c.channelName,
      yt: c.channelUrl,
      website: c.website || 'N/A',
      email: c.businessEmail || 'N/A',
      score: c.businessScore || 0,
      budget: c.estimatedBudget || 'N/A',
      bizType: c.businessType || 'N/A',
      qualification: c.qualificationReason || 'N/A',
      services: c.recommendedSoftware.join(', ') || 'N/A',
      outreach: c.outreachLine || 'N/A',
      revSignals: c.revenueSignals.join(', ') || 'N/A',
      painPts: c.painPoints.join(', ') || 'N/A',
      tech: c.technologies.join(', ') || 'N/A',
      country: c.country || 'N/A',
      subs: c.subscriberCount,
    });

    // Make URLs clickable links
    if (c.channelUrl) {
      row.getCell('yt').value = { text: c.channelUrl, hyperlink: c.channelUrl };
      row.getCell('yt').font = { color: { argb: '0563C1' }, underline: true };
    }
    if (c.website) {
      row.getCell('website').value = { text: c.website, hyperlink: c.website };
      row.getCell('website').font = { color: { argb: '0563C1' }, underline: true };
    }

    // Color-code by tier
    if (c.leadTier === 'A') {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD4EDC9' } // Light green for Tier A
        };
      });
      row.getCell('tier').font = { bold: true, color: { argb: 'FF006100' } };
      row.getCell('score').font = { bold: true, color: { argb: 'FF006100' } };
    } else if (c.leadTier === 'B') {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDCE6F1' } // Light blue for Tier B
        };
      });
    }
  }

  await workbook.xlsx.writeFile(excelPath);
  logger.info(`Saved Excel report to ${excelPath}`);
}

async function generatePdfReport(channels: Channel[]) {
  return new Promise<void>((resolve, reject) => {
    const pdfPath = path.resolve(process.cwd(), 'creator-leads.pdf');
    // Using landscape A4 to fit the columns better
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);
    
    doc.fontSize(18).text('🔥 Qualified Creator Leads Report', { align: 'center' });
    doc.fontSize(10).text(`Only Tier A/B leads with Score ≥ ${MINIMUM_EXPORT_SCORE}`, { align: 'center' });
    doc.moveDown();
    
    const tableData = channels.map(c => [
      c.leadTier || '-',
      c.channelName.substring(0, 18),
      c.channelUrl,
      c.website || '-',
      c.businessEmail || '-',
      (c.businessScore || 0).toString(),
      c.estimatedBudget || '-',
      c.recommendedSoftware.join(', ').substring(0, 50) || '-',
    ]);
    
    const table = {
      title: `Generated: ${new Date().toISOString().split('T')[0]} | ${channels.length} Qualified Leads`,
      headers: ["Tier", "Creator", "YouTube", "Website", "Email", "Score", "Budget", "Services"],
      rows: tableData
    };
    
    doc.table(table, {
      prepareHeader: () => doc.font("Helvetica-Bold").fontSize(9),
      prepareRow: () => doc.font("Helvetica").fontSize(8)
    }).then(() => {
      doc.end();
    }).catch(reject);
    
    writeStream.on('finish', () => {
      logger.info(`Saved PDF report to ${pdfPath}`);
      resolve();
    });
    
    writeStream.on('error', reject);
  });
}
