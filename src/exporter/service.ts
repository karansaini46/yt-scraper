import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';
import { Channel } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit-table';

export async function runExporterJob(): Promise<Channel[]> {
  logger.info('Starting Exporter Job...');

  try {
    // 1. Fetch analyzed channels
    const channels = await prisma.channel.findMany({
      where: {
        aiAnalyzedAt: { not: null },
        exportedAt: null,
      },
      orderBy: {
        businessScore: 'desc',
      },
    });

    if (channels.length === 0) {
      logger.info('No analyzed channels found to export.');
      return [];
    }

    // 2. Deduplicate channels by ID (Prisma findMany with distinct isn't always flexible enough if we need to sort, but ID is unique anyway)
    // Actually, ID is the primary key in our schema, so they are guaranteed to be unique.
    // We'll still do a simple dedup map just in case.
    const uniqueChannelsMap = new Map<string, Channel>();
    for (const channel of channels) {
      if (!uniqueChannelsMap.has(channel.id)) {
        uniqueChannelsMap.set(channel.id, channel);
      }
    }
    const uniqueChannels = Array.from(uniqueChannelsMap.values());

    logger.info(`Exporting ${uniqueChannels.length} unique creator leads.`);

    // 3. Generate Markdown Report
    await generateMarkdownReport(uniqueChannels);

    // 4. Generate Excel Report
    await generateExcelReport(uniqueChannels);

    // 5. Generate PDF Report
    await generatePdfReport(uniqueChannels);

    // 6. Mark as exported
    await prisma.channel.updateMany({
      where: {
        id: { in: uniqueChannels.map(c => c.id) }
      },
      data: {
        exportedAt: new Date()
      }
    });

    logger.info('Exporter Job completed successfully.');
    return uniqueChannels;
  } catch (error) {
    logger.error('Error during Exporter Job:', error);
    return [];
  }
}

async function generateMarkdownReport(channels: Channel[]) {
  const mdPath = path.resolve(process.cwd(), 'creator-leads.md');
  
  let mdContent = `# Creator Leads Report\n\n`;
  mdContent += `Generated on: ${new Date().toISOString().split('T')[0]}\n\n`;
  mdContent += `| Creator Name | YouTube URL | Website | Country | Subscribers | Latest Upload | Business Email | Products Sold | Score | Recommended Service | Opening Line | Tech Stack |\n`;
  mdContent += `|---|---|---|---|---|---|---|---|---|---|---|---|\n`;

  for (const c of channels) {
    const isHighValue = c.businessScore && c.businessScore > 80;
    const nameStr = isHighValue ? `**🔥 ${c.channelName}**` : c.channelName;
    
    // Formatting helpers
    const formatArr = (arr: string[]) => (arr.length > 0 ? arr.join(', ') : '-');
    const website = c.website ? `[Link](${c.website})` : '-';
    const email = c.businessEmail || '-';
    const uploadDate = c.latestUploadDate.toISOString().split('T')[0];
    const country = c.country || '-';
    
    mdContent += `| ${nameStr} | [YouTube](${c.channelUrl}) | ${website} | ${country} | ${c.subscriberCount} | ${uploadDate} | ${email} | ${formatArr(c.productsSold)} | ${c.businessScore || 0} | ${formatArr(c.recommendedSoftware)} | ${c.outreachLine || '-'} | ${formatArr(c.technologies)} |\n`;
  }

  fs.writeFileSync(mdPath, mdContent, 'utf-8');
  logger.info(`Saved Markdown report to ${mdPath}`);
}

async function generateExcelReport(channels: Channel[]) {
  const excelPath = path.resolve(process.cwd(), 'creator-leads.xlsx');
  
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Leads');

  // Define Columns
  sheet.columns = [
    { header: 'Creator Name', key: 'name', width: 25 },
    { header: 'YouTube URL', key: 'yt', width: 40 },
    { header: 'Website', key: 'website', width: 30 },
    { header: 'Country', key: 'country', width: 10 },
    { header: 'Subscribers', key: 'subs', width: 15 },
    { header: 'Latest Upload', key: 'upload', width: 15 },
    { header: 'Business Email', key: 'email', width: 30 },
    { header: 'Products Sold', key: 'products', width: 30 },
    { header: 'Score', key: 'score', width: 10 },
    { header: 'Recommended Service', key: 'service', width: 35 },
    { header: 'Opening Line', key: 'intro', width: 60 },
    { header: 'Tech Stack', key: 'tech', width: 30 },
  ];

  // Style the header row
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 12 }
  };

  for (const c of channels) {
    const row = sheet.addRow({
      name: c.channelName,
      yt: c.channelUrl,
      website: c.website || 'N/A',
      country: c.country || 'N/A',
      subs: c.subscriberCount,
      upload: c.latestUploadDate.toISOString().split('T')[0],
      email: c.businessEmail || 'N/A',
      products: c.productsSold.join(', ') || 'N/A',
      score: c.businessScore || 0,
      service: c.recommendedSoftware.join(', ') || 'N/A',
      intro: c.outreachLine || 'N/A',
      tech: c.technologies.join(', ') || 'N/A',
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

    // Highlight high value leads
    if (c.businessScore && c.businessScore > 80) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD4EDC9' } // Light green
        };
      });
      // Emphasize the score column even more
      row.getCell('score').font = { bold: true, color: { argb: 'FF006100' } };
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
    
    doc.fontSize(18).text('Creator Leads Report', { align: 'center' });
    doc.moveDown();
    
    const tableData = channels.map(c => [
      c.channelName.substring(0, 20),
      c.channelUrl,
      c.website || '-',
      c.businessEmail || '-',
      (c.businessScore || 0).toString(),
      c.recommendedSoftware.join(', ') || '-',
      c.technologies.join(', ') || '-'
    ]);
    
    const table = {
      title: `Generated on: ${new Date().toISOString().split('T')[0]}`,
      headers: ["Creator Name", "YouTube", "Website", "Email", "Score", "Services", "Tech"],
      rows: tableData
    };
    
    doc.table(table, {
      prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
      prepareRow: () => doc.font("Helvetica").fontSize(9)
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
