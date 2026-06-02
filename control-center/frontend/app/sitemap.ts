import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bez.digital';

// All public landing pages
const landingRoutes = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' as const },
    { path: '/solutions', priority: 0.9, changeFrequency: 'weekly' as const },
    { path: '/token', priority: 0.9, changeFrequency: 'weekly' as const },
    { path: '/network', priority: 0.8, changeFrequency: 'daily' as const },
    { path: '/enterprise', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/commerce', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/payments', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/financial', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/bridges', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/validators', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/developers', priority: 0.8, changeFrequency: 'weekly' as const },
    { path: '/learn', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/docs', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/rpc', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/support', priority: 0.6, changeFrequency: 'monthly' as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
    return landingRoutes.map(({ path, priority, changeFrequency }) => ({
        url: `${BASE_URL}${path}`,
        lastModified: new Date(),
        changeFrequency,
        priority,
    }));
}
