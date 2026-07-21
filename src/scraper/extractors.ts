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
  revenueSignals: string[];
  painPoints: string[];
}

// ─── REVENUE / BUSINESS MATURITY SIGNALS ────────────────────────────────────
// These indicate a business with real revenue and operational complexity.
const REVENUE_SIGNAL_KEYWORDS: Array<{ keyword: string; label: string }> = [
  { keyword: 'book a demo', label: 'Book a Demo CTA' },
  { keyword: 'schedule a call', label: 'Schedule a Call CTA' },
  { keyword: 'get a quote', label: 'Get a Quote CTA' },
  { keyword: 'request a proposal', label: 'Request a Proposal CTA' },
  { keyword: 'contact sales', label: 'Contact Sales CTA' },
  { keyword: 'our clients', label: 'Has Clients Section' },
  { keyword: 'case studies', label: 'Has Case Studies' },
  { keyword: 'case study', label: 'Has Case Studies' },
  { keyword: 'testimonials', label: 'Has Testimonials' },
  { keyword: 'enterprise', label: 'Enterprise Offering' },
  { keyword: 'pricing', label: 'Has Pricing Page' },
  { keyword: 'annual plan', label: 'Has Annual Plans' },
  { keyword: 'monthly plan', label: 'Has Monthly Plans' },
  { keyword: 'custom solution', label: 'Offers Custom Solutions' },
  { keyword: 'our team', label: 'Has Team Page' },
  { keyword: 'meet the team', label: 'Has Team Page' },
  { keyword: 'careers', label: 'Has Careers Page (Hiring)' },
  { keyword: "we're hiring", label: 'Actively Hiring' },
  { keyword: 'join our team', label: 'Actively Hiring' },
  { keyword: 'trusted by', label: 'Has Trust Signals' },
  { keyword: 'as seen on', label: 'Media Mentions' },
  { keyword: 'featured in', label: 'Media Mentions' },
  { keyword: 'partner with us', label: 'Partnership Program' },
  { keyword: 'white label', label: 'White Label Services' },
  { keyword: 'api access', label: 'Has API (Tech Product)' },
  { keyword: 'documentation', label: 'Has API Documentation' },
];

// ─── PAIN POINT SIGNALS ─────────────────────────────────────────────────────
// These indicate operational pain points that a software agency can solve.
const PAIN_POINT_KEYWORDS: Array<{ keyword: string; label: string }> = [
  { keyword: 'manual process', label: 'Manual Process (Automation Opportunity)' },
  { keyword: 'spreadsheet', label: 'Using Spreadsheets (Needs Custom Tool)' },
  { keyword: 'automate', label: 'Automation Interest' },
  { keyword: 'integration', label: 'Needs Integrations' },
  { keyword: 'custom built', label: 'Custom-Built Solutions Needed' },
  { keyword: 'in-house tool', label: 'In-House Tool Needs' },
  { keyword: 'workflow', label: 'Complex Workflows' },
  { keyword: 'dashboard', label: 'Dashboard/Analytics Needed' },
  { keyword: 'analytics', label: 'Analytics Requirements' },
  { keyword: 'reporting', label: 'Reporting Needs' },
  { keyword: 'inventory', label: 'Inventory Management' },
  { keyword: 'booking system', label: 'Booking System Needed' },
  { keyword: 'appointment', label: 'Appointment Scheduling' },
  { keyword: 'client portal', label: 'Client Portal Opportunity' },
  { keyword: 'customer portal', label: 'Customer Portal Opportunity' },
  { keyword: 'member area', label: 'Membership Area Needed' },
  { keyword: 'admin panel', label: 'Admin Panel Needed' },
  { keyword: 'crm', label: 'CRM Needed' },
  { keyword: 'order management', label: 'Order Management System' },
  { keyword: 'tracking', label: 'Tracking System Needed' },
  { keyword: 'notification', label: 'Notification System' },
  { keyword: 'onboarding', label: 'Client Onboarding' },
  { keyword: 'invoice', label: 'Invoicing System' },
  { keyword: 'payment processing', label: 'Payment Processing' },
  { keyword: 'supply chain', label: 'Supply Chain Management' },
  { keyword: 'project management', label: 'Project Management Tool' },
];

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
    paymentProvider: null,
    revenueSignals: [],
    painPoints: [],
  };

  // 1. Emails
  const foundEmails = htmlString.match(EMAIL_REGEX) || [];
  const uniqueEmails = [...new Set(foundEmails.map(e => e.toLowerCase()))];
  data.emails = uniqueEmails;

  // 2. Subpages (Contact, About, Work With Me, Hire Me, Business, Press, Pricing, Team, Careers)
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
        linkText.includes('press') || href.includes('press') ||
        linkText.includes('pricing') || href.includes('pricing') ||
        linkText.includes('team') || href.includes('/team') ||
        linkText.includes('careers') || href.includes('careers') ||
        linkText.includes('case stud') || href.includes('case-stud') ||
        linkText.includes('services') || href.includes('services')
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
  if (lowerText.includes('e-commerce') || lowerText.includes('ecommerce') || lowerText.includes('online store')) data.products.push('E-commerce');
  if (lowerText.includes('agency') || lowerText.includes('done for you')) data.products.push('Agency Services');
  if (lowerText.includes('physical product') || lowerText.includes('shipping')) data.products.push('Physical Products');

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
  if (htmlString.includes('hubspot.com') || htmlString.includes('hs-scripts.com')) data.technologies.push('HubSpot');
  if (htmlString.includes('salesforce.com')) data.technologies.push('Salesforce');
  if (htmlString.includes('intercom.io') || htmlString.includes('intercom.com')) data.technologies.push('Intercom');
  if (htmlString.includes('zendesk.com')) data.technologies.push('Zendesk');
  if (htmlString.includes('calendly.com')) data.technologies.push('Calendly');
  if (htmlString.includes('typeform.com')) data.technologies.push('Typeform');
  if (htmlString.includes('mailchimp.com')) data.technologies.push('Mailchimp');
  if (htmlString.includes('activecampaign.com')) data.technologies.push('ActiveCampaign');
  if (htmlString.includes('wordpress.org') || htmlString.includes('wp-content')) data.technologies.push('WordPress');
  if (htmlString.includes('wix.com')) data.technologies.push('Wix');
  if (htmlString.includes('squarespace.com')) data.technologies.push('Squarespace');
  if (htmlString.includes('webflow.io') || htmlString.includes('webflow.com')) data.technologies.push('Webflow');
  if (htmlString.includes('react') && htmlString.includes('__next')) data.technologies.push('Next.js');

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

  // 6. Revenue Signals — detect business maturity indicators
  for (const { keyword, label } of REVENUE_SIGNAL_KEYWORDS) {
    if (lowerText.includes(keyword) || htmlString.toLowerCase().includes(keyword)) {
      data.revenueSignals.push(label);
    }
  }
  data.revenueSignals = [...new Set(data.revenueSignals)];

  // 7. Pain Points — detect operational pain points the agency can solve
  for (const { keyword, label } of PAIN_POINT_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      data.painPoints.push(label);
    }
  }
  data.painPoints = [...new Set(data.painPoints)];

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
  if (domainEmails.length > 0) return domainEmails[0] ?? null;

  // Exclude common image extensions falsely matched as emails
  const validEmails = emails.filter(e => !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.jpeg') && !e.endsWith('.gif') && !e.endsWith('.webp') && !e.endsWith('.svg'));

  if (validEmails.length === 0) return null;

  // Filter out personal emails
  const nonPersonalEmails = validEmails.filter(e => {
    const emailDomain = e.split('@')[1];
    return emailDomain !== undefined && !PERSONAL_EMAIL_DOMAINS.includes(emailDomain);
  });

  if (nonPersonalEmails.length > 0) return nonPersonalEmails[0] ?? null;

  // Fallback to whatever is available
  return validEmails[0] ?? null;
}
