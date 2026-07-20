import * as cheerio from 'cheerio';

const EMAIL_REGEX = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
const PERSONAL_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];

export interface ExtractedData {
  emails: string[];
  subpages: string[];
  products: string[];
  technologies: string[];
  socialLinks: Record<string, string>;
  newsletter: boolean;
  paymentProvider: string | null;
}

export function extractDataFromHtml(html: string, baseUrl: string): ExtractedData {
  const $ = cheerio.load(html);
  const text = $('body').text();
  const htmlString = $.html();

  const data: ExtractedData = {
    emails: [],
    subpages: [],
    products: [],
    technologies: [],
    socialLinks: {},
    newsletter: false,
    paymentProvider: null
  };

  // 1. Emails
  const foundEmails = htmlString.match(EMAIL_REGEX) || [];
  const uniqueEmails = [...new Set(foundEmails.map(e => e.toLowerCase()))];
  data.emails = uniqueEmails;

  // 2. Subpages (Contact, About, Work With Me, Hire Me, Business, Press)
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    const linkText = $(el).text().toLowerCase();
    
    if (href) {
      if (
        linkText.includes('contact') || href.includes('contact') ||
        linkText.includes('about') || href.includes('about') ||
        linkText.includes('work with me') || href.includes('work-with-me') ||
        linkText.includes('hire me') || href.includes('hire-me') ||
        linkText.includes('business') || href.includes('business') ||
        linkText.includes('press') || href.includes('press')
      ) {
        data.subpages.push(href);
      }
    }
  });
  data.subpages = [...new Set(data.subpages)];

  // 3. Products
  const lowerText = text.toLowerCase();
  if (lowerText.includes('course') || lowerText.includes('masterclass')) data.products.push('Courses');
  if (lowerText.includes('template')) data.products.push('Templates');
  if (lowerText.includes('saas') || lowerText.includes('software')) data.products.push('SaaS');
  if (lowerText.includes('newsletter') || lowerText.includes('subscribe to my list')) data.products.push('Newsletter');
  if (lowerText.includes('membership') || lowerText.includes('community')) data.products.push('Membership');
  if (lowerText.includes('digital product') || lowerText.includes('ebook')) data.products.push('Digital products');
  if (lowerText.includes('consulting') || lowerText.includes('consultation')) data.products.push('Consulting');
  if (lowerText.includes('coaching') || lowerText.includes('1-on-1')) data.products.push('Coaching');

  // 4. Technologies & Payment Providers
  if (htmlString.includes('stripe.com') || htmlString.includes('js.stripe.com')) {
    data.technologies.push('Stripe');
    data.paymentProvider = 'Stripe';
  }
  if (htmlString.includes('lemonsqueezy.com')) {
    data.technologies.push('LemonSqueezy');
    data.paymentProvider = 'LemonSqueezy';
  }
  if (htmlString.includes('shopify.com') || htmlString.includes('myshopify.com')) data.technologies.push('Shopify');
  if (htmlString.includes('beehiiv.com')) {
    data.technologies.push('Beehiiv');
    data.newsletter = true;
  }
  if (htmlString.includes('convertkit.com') || htmlString.includes('kit.com')) {
    data.technologies.push('Kit');
    data.newsletter = true;
  }
  if (htmlString.includes('kajabi.com')) data.technologies.push('Kajabi');
  if (htmlString.includes('circle.so')) data.technologies.push('Circle');
  if (htmlString.includes('skool.com')) data.technologies.push('Skool');

  if (data.products.includes('Newsletter')) {
    data.newsletter = true;
  }

  // 5. Social Links
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      const lowerHref = href.toLowerCase();
      if (lowerHref.includes('linkedin.com/in/') || lowerHref.includes('linkedin.com/company/')) data.socialLinks['linkedin'] = href;
      if (lowerHref.includes('twitter.com/') || lowerHref.includes('x.com/')) data.socialLinks['twitter'] = href;
      if (lowerHref.includes('discord.gg/') || lowerHref.includes('discord.com/')) data.socialLinks['discord'] = href;
      if (lowerHref.includes('github.com/')) data.socialLinks['github'] = href;
    }
  });

  return data;
}

export function pickBestBusinessEmail(emails: string[], domain: string): string | null {
  if (emails.length === 0) return null;
  
  // Clean domain
  let cleanDomain = domain;
  try {
    cleanDomain = new URL(domain.startsWith('http') ? domain : `https://${domain}`).hostname.replace('www.', '');
  } catch (e) {
    // Ignore error
  }

  // Prioritize emails matching the domain
  const domainEmails = emails.filter(e => e.includes(`@${cleanDomain}`));
  if (domainEmails.length > 0) return domainEmails[0];

  // Exclude common image extensions falsely matched as emails
  const validEmails = emails.filter(e => !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.jpeg') && !e.endsWith('.gif') && !e.endsWith('.webp') && !e.endsWith('.svg'));

  if (validEmails.length === 0) return null;

  // Filter out personal emails
  const nonPersonalEmails = validEmails.filter(e => {
    const emailDomain = e.split('@')[1];
    return !PERSONAL_EMAIL_DOMAINS.includes(emailDomain);
  });

  if (nonPersonalEmails.length > 0) return nonPersonalEmails[0];

  // Fallback to whatever is available
  return validEmails[0];
}
