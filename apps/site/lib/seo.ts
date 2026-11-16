import type { Metadata } from 'next';
import { PAGES, SITE } from './site';

type SitePath = (typeof PAGES)[number];
type SeoDetails = { title: string; description: string };

/** Page-specific search and social metadata for the marketing website. */
export const SITE_SEO = {
  '/': {
    title: 'Hospitality Jobs & Hiring in Australia | NUA CREW',
    description:
      'NUA CREW is a hospitality recruitment platform for Australian job seekers and employers. Create a free job seeker account or register your business.',
  },
  '/job-seekers': {
    title: 'Find Hospitality Work Across Australia',
    description:
      'Create a free NUA CREW account for Australian hospitality work. Learn how job discovery, disclosed pay and candidate privacy work.',
  },
  '/employers': {
    title: 'Hospitality Recruitment for Australian Employers',
    description:
      'Register your Australian hospitality business, set up your hiring workspace and learn how business verification and job publishing work.',
  },
  '/how-it-works': {
    title: 'How Hospitality Hiring and Shifts Work',
    description:
      "Learn how NUA CREW's proposed job search, applications, shift availability, invitations and conversations work for hospitality employers and job seekers.",
  },
  '/markets': {
    title: 'Australia and New Zealand Hospitality Recruitment',
    description:
      'See which NUA CREW services are available in Australia and learn about the planned New Zealand hospitality recruitment launch.',
  },
  '/features': {
    title: 'Explore Hospitality Recruitment Features',
    description:
      "See NUA CREW's feature previews for job discovery, applications, consent-based invitations, document handling, availability and employer hiring workflows.",
  },
  '/pricing': {
    title: 'Planned Job Advertising Prices for Employers',
    description:
      "Review NUA CREW's planned employer advertising prices and promotion options. Job seeking remains free; payments and public employer billing are not yet enabled.",
  },
  '/trust': {
    title: 'Trust, Privacy and Fair Recruitment Practices',
    description:
      'Learn how NUA CREW handles business verification, pay labels, applicant visibility and personal information in hospitality recruitment.',
  },
  '/apps': {
    title: 'Android, iPhone and Web App Launch Status',
    description:
      'Find NUA CREW web signup and sign-in for job seekers and employers, and check availability for Android and iPhone.',
  },
  '/help': {
    title: 'Help with Jobs, Shifts and Employer Hiring',
    description:
      'Find answers about NUA CREW applications, hospitality certificates, shift records, employer pay responsibilities, team access and current launch availability.',
  },
  '/contact': {
    title: 'Contact NUA CREW Support and Employer Enquiries',
    description:
      'Contact the NUA CREW team through its published NUA POS support address for hospitality recruitment questions, employer enquiries, privacy or website feedback.',
  },
  '/privacy': {
    title: 'Privacy Policy for NUA CREW Recruitment',
    description:
      'Read how NUA CREW handles website enquiries, Australian web accounts, recruitment information and privacy requests.',
  },
  '/terms': {
    title: 'Terms of Use for NUA CREW Recruitment',
    description:
      'Read the terms for using the NUA CREW website and recruitment portals, including account responsibilities and acceptable conduct.',
  },
  '/employer-terms': {
    title: 'Employer Terms for Hospitality Recruitment',
    description:
      "Read NUA CREW's additional employer conditions covering job advertising, team access, candidate privacy and billing responsibilities planned for future launch.",
  },
  '/community-guidelines': {
    title: 'Community Guidelines for NUA CREW Members',
    description:
      "Review NUA CREW's expectations for genuine jobs, accurate qualifications, respectful messages, privacy and reporting concerns across recruitment interactions.",
  },
  '/cookies': {
    title: 'Cookies and Website Data at NUA CREW',
    description:
      'Learn what data the NUA CREW marketing website uses today, how hosting requests are handled and why login and advertising cookies are not currently enabled.',
  },
  '/legal': {
    title: 'NUA CREW Legal and Business Information',
    description:
      "Find the NUA CREW operator's published business identity, ABN, contact details and links to its recruitment website policies and legal information.",
  },
} satisfies Record<SitePath, SeoDetails>;

export function canonicalUrl(path: SitePath): string {
  return `${SITE.url}${path}`;
}

export function buildMetadata(path: SitePath): Metadata {
  const { title, description } = SITE_SEO[path];
  const url = canonicalUrl(path);
  const image = {
    url: `${SITE.url}/opengraph-image.png`,
    width: 1200,
    height: 630,
    alt: 'NUA CREW — Where Talent Meets Opportunity',
  };
  return {
    title: path === '/' ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: 'NUA CREW',
      locale: 'en_AU',
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image.url],
    },
  };
}
