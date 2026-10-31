import { BUSINESS } from '@/lib/business';
import { SITE } from '@/lib/site';

/** Public, verified operator and website facts only. No job postings or review claims. */
const websiteGraph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE.url}/#operator`,
      name: BUSINESS.tradingName,
      url: BUSINESS.parentUrl,
      email: BUSINESS.email,
      identifier: {
        '@type': 'PropertyValue',
        propertyID: 'ABN',
        value: BUSINESS.abn.replace(/\s/g, ''),
      },
      address: {
        '@type': 'PostalAddress',
        streetAddress: '7 Rowe Street',
        addressLocality: 'Alphington',
        addressRegion: 'VIC',
        postalCode: '3078',
        addressCountry: 'AU',
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE.url}/#website`,
      name: SITE.name,
      url: SITE.url,
      inLanguage: 'en-AU',
      description: 'NUA CREW hospitality recruitment information and pre-launch product previews.',
      publisher: { '@id': `${SITE.url}/#operator` },
    },
  ],
};

/** Next.js recommends native JSON-LD scripts with escaping against HTML injection. */
export function SiteJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(websiteGraph).replace(/</g, '\\u003c'),
      }}
    />
  );
}
