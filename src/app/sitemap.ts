import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return [
    { url: `${base}/`, lastModified: new Date(), priority: 1.0 },
    { url: `${base}/menu`, lastModified: new Date(), priority: 0.8 },
    { url: `${base}/offers`, lastModified: new Date(), priority: 0.7 },
    { url: `${base}/orders`, lastModified: new Date(), priority: 0.6 },
    { url: `${base}/checkout`, lastModified: new Date(), priority: 0.5 },
    { url: `${base}/about`, lastModified: new Date(), priority: 0.4 },
    { url: `${base}/contact`, lastModified: new Date(), priority: 0.4 },
    { url: `${base}/faq`, lastModified: new Date(), priority: 0.4 },
    { url: `${base}/privacy`, lastModified: new Date(), priority: 0.3 },
    { url: `${base}/terms`, lastModified: new Date(), priority: 0.3 },
    { url: `${base}/refund`, lastModified: new Date(), priority: 0.3 },
    { url: `${base}/cookie`, lastModified: new Date(), priority: 0.3 },
    { url: `${base}/fssai`, lastModified: new Date(), priority: 0.3 },
  ];
}
