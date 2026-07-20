# Creator Lead Finder - Project Specification

## 1. Vision

Creator Lead Finder is an AI-powered lead generation system that discovers YouTube creators who are actually running businesses and are likely to need custom software development services.

The purpose is NOT simply to collect YouTube channels.
The purpose is to discover qualified businesses, analyze them, identify software opportunities, and generate highly personalized outreach.

This tool will eventually become an internal sales machine, continuously discovering high-quality creator leads for personalized contact. 

The system is designed to scale and be highly modular.

---

## 2. Target Creators

**Location Restrictions:**
- **United States**
- **United Kingdom**
*(Note: Do NOT prioritize India or other countries.)*

**Preferred Creator Profile:**
- **Audience Size:** 30,000–500,000 subscribers (preferred, not mandatory)
- **Activity:** Active within the last 45 days (consistent upload schedule)
- **Business Presence:** Owns a website
- **Monetization:** Sells products or services
- **Contact:** Business email available

**Examples of Target Businesses:**
- Online courses
- SaaS
- Newsletters
- Communities
- Memberships
- Templates
- Digital products
- Coaching
- Consulting

---

## 3. The System Pipeline

The complete pipeline is designed to work autonomously, running through the following steps:

1. **Search YouTube:** Query YouTube using predefined search topics.
2. **Discover Relevant Channels:** Filter and identify relevant creator channels.
3. **Collect Channel Information:** Utilize the YouTube Data API v3 to fetch metadata.
4. **Visit Creator Website:** Resolve and navigate to the creator's official website.
5. **Crawl Important Pages:** Scrape data from the homepage, contact, about, and product pages.
6. **Extract Data:** Gather specific details including:
   - Business email
   - Products
   - Social links
   - Technologies
   - Newsletter presence
   - Payment providers
7. **Analyze with AI:** Use an LLM to evaluate the gathered context.
8. **Score the Creator:** Assign a "Business Score" based on lead qualification criteria.
9. **Suggest Software Opportunities:** Generate software ideas tailored to their business model.
10. **Generate Personalized Outreach:** Craft a highly personalized outreach opening line/draft.
11. **Generate Reports:** Compile data into usable formats.
12. **Send Notifications:** Dispatch the generated report to Telegram.

---

## 4. Search Topics

The discovery engine should search the following configurable list of topics:

- AI
- ChatGPT
- Programming
- Software Engineering
- Next.js
- React
- TypeScript
- SaaS
- Startup
- Productivity
- Notion
- Marketing
- Email Marketing
- Automation
- Business
- Entrepreneurship
- Online Courses

*Configuration Note: This list should exist in a config file or database, making it easy to tune the discovery engine over time.*

---

## 5. Information To Collect (Data Model)

For every discovered creator, the system must extract and store:

### Core Identity
- **Channel ID**
- **Channel Name**
- **Channel URL**
- **Description**
- **Website**
- **Country**
- **Business Email**

### Metrics & Activity
- **Subscribers**
- **Views**
- **Videos**
- **Latest Upload Date**

### Business Intelligence
- **Products Sold**
- **Technologies Used**
- **Newsletter (Yes/No & Platform)**
- **Community Platform (e.g., Discord, Skool, Circle)**
- **Payment Provider (e.g., Stripe, Gumroad)**
- **Contact Page URL**

### Social Links
- **LinkedIn**
- **Twitter/X**
- **GitHub**
- **Discord**

### Output & Analysis
- **Business Score:** (e.g., 1-100 score indicating lead quality)
- **AI Summary:** (Brief description of their business model)
- **Recommended Software:** (Identified opportunities)
- **Personalized Outreach Line:** (Custom intro for cold email)
- **Date Discovered:** (Timestamp)

---

## 6. Recommended Services

The AI should dynamically recommend software opportunities such as, but not limited to:

- AI chatbot
- AI search
- Internal dashboard
- Analytics dashboard
- CRM
- Membership platform
- Course platform
- Sponsorship dashboard
- Admin panel
- Automation workflows
- Email automation
- Customer portal
- Client portal
- API integrations

*Note: The recommendation must be heavily based on the creator's actual business context derived from the crawl.*

---

## 7. Reports & Exporting

Eventually, the system must generate detailed reports in multiple formats:

- **Markdown**
- **Excel (.xlsx)**
- **CSV**

Each report should contain all discovered information to easily import into a CRM or review manually.

---

## 8. Telegram Integration

After each scanning session completes:
- The system will automatically send the resulting report to a designated Telegram channel/chat.
- The message should include summary statistics (e.g., Total channels scanned, Qualified Leads found, Top recommendations).

---

## 9. Tech Stack

- **Runtime:** Node.js
- **Language:** TypeScript
- **Package Manager:** pnpm
- **Database ORM:** Prisma
- **Database:** PostgreSQL
- **Validation:** Zod
- **Environment:** dotenv
- **Logging:** pino
- **HTTP Client:** Axios
- **Web Scraping:** Cheerio
- **Dynamic Scraping:** Playwright (when required for JS-heavy sites)
- **AI Integration:** OpenAI or Gemini (for AI analysis and outreach generation)

---

## 10. Architecture Goals

The project must adhere to the following principles:

- **Modular:** Clear separation of concerns (e.g., YouTube fetcher, web crawler, AI analyzer).
- **Highly Maintainable:** Clean code, readable, heavily commented.
- **Strongly Typed:** End-to-end type safety with TypeScript and Zod.
- **Production-ready:** Graceful error handling, retries, and comprehensive logging.
- **Easy to Extend:** New scrapers or analysis steps can be added without rewriting the core.
- **Fault Tolerant:** The system should not crash if one website fails to scrape or the API rate limits.
- **Resume Failed Scans:** Implement checkpointing or queueing so a killed process can pick up where it left off.
- **Avoid Duplicate Creators:** Use idempotency and strict uniqueness constraints (e.g., on Channel ID).
- **Config Driven:** API keys, search terms, and scraping thresholds should be environment/config driven.

---

## 11. Development Rules

We will build this project in multiple milestones.

**STRICT RULES:**
- Do NOT implement future milestones until requested.
- Keep the project compiling at all times.
- Include documentation for complex logic.
- Ensure the codebase is clean, structured, and tested.

---

## 12. Milestones (Proposed)

*This is a roadmap for development. Work should strictly follow one milestone at a time.*

- **Milestone 1: Project Setup & YouTube Discovery Engine**
  - Setup Node.js, TS, pnpm, Prisma, PostgreSQL.
  - Implement YouTube API v3 search based on config topics.
  - Filter channels by basic criteria (subs, recent activity, country).
  - Save base channel data to the database.

- **Milestone 2: Web Crawling & Data Extraction**
  - Implement Cheerio/Playwright web crawler.
  - Visit saved creator websites and parse links, emails, tech stack, and social pages.
  - Update records in the database.

- **Milestone 3: AI Analysis & Scoring**
  - Integrate OpenAI/Gemini to process the collected JSON payload.
  - Generate the Business Summary, Business Score, Recommended Software, and Outreach line.
  - Implement logic to handle AI rate limits and schema extraction.

- **Milestone 4: Reporting & Telegram Notifications**
  - Build formatting modules for Markdown, CSV, and Excel.
  - Integrate Telegram Bot API for push notifications.
  - Final end-to-end integration testing.

---

## 13. Assumptions, Risks & Mitigations

### Assumptions
- YouTube Data API quota will be sufficient for the initial discovery volume.
- Creator's emails on websites are accessible without CAPTCHA.
- Most creator websites have discernible "About" or "Contact" pages.

### Risks
1. **YouTube API Quotas:** API limits are strict. 
   *Mitigation:* Optimize searches, use caching, and potentially scrape standard search pages if API is exhausted.
2. **Anti-Bot Protections:** Sites using Cloudflare may block Playwright/Axios. 
   *Mitigation:* Use proxies, rotating user agents, or stealth plugins if necessary.
3. **LLM Hallucinations:** The AI might recommend generic software. 
   *Mitigation:* Use strict prompts with low temperature and structured JSON outputs (e.g., Zod schema parsing via LLM functions).
4. **Data Accuracy:** Scraping emails and payment providers can be noisy.
   *Mitigation:* Rely on regular expressions and known DOM patterns; validate emails structurally.
