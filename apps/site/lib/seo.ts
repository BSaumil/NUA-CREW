import type { Metadata } from 'next';
import { PAGES, SITE } from './site';

type SitePath = (typeof PAGES)[number];
type SeoDetails = { title: string; description: string };

/** Reviewed, unique pre-launch metadata; no public app or paid service is implied. */
export const SITE_SEO = {
  '/': {
    title: 'NUA CREW — Better Jobs. Stronger Teams.',
    description:
      'Explore NUA CREW, a Melbourne-first hospitality recruitment platform in pre-launch testing. Learn how job seekers and employers can connect on their terms.',
  },
  '/job-seekers': {
    title: 'Find Hospitality Work Across Australia',
    description:
      'Explore how NUA CREW plans to help people find hospitality jobs, see disclosed pay, manage availability and accept invitations. Free for job seekers.',
  },
  '/employers': {
    title: 'Hire Hospitality Staff with NUA CREW',
    description:
      "Explore NUA CREW's planned employer tools for posting hospitality roles with disclosed pay, reviewing applicants and inviting candidates. In pre-launch testing.",
  },
  '/how-it-works': {
    title: 'How Hospitality Hiring and Shifts Work',
    description:
      "Learn how NUA CREW's proposed job search, applications, shift availability, invitations and conversations work for hospitality employers and job seekers.",
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
      'Understand how NUA CREW describes business checks, pay labels, applicant choice and personal information. Its recruitment services remain in pre-launch testing.',
  },
  '/apps': {
    title: 'Android, iPhone and Web App Launch Status',
    description:
      "Check NUA CREW's Android, iPhone and web application status. Mobile apps and employer registration remain in testing; there are no public app store links yet.",
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
      'Read how NUA CREW describes website information, enquiries, privacy requests and future recruitment accounts. Public registration and document uploads remain closed.',
  },
  '/terms': {
    title: 'Terms of Use for NUA CREW Recruitment',
    description:
      'Read the terms governing the NUA CREW marketing website and proposed recruitment services, including account duties, conduct and pre-launch limitations.',
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
  return `${SITE.url}${path === '/' ? '' : path}`;
}

export function buildMetadata(path: SitePath): Metadata {
  const { title, description } = SITE_SEO[path];
  const url = canonicalUrl(path);
  const image = {
    url: `${SITE.url}/illustrations/hospitality-team.webp`,
    width: 1200,
    height: 900,
    alt: 'Illustration of NUA CREW hospitality recruitment',
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
