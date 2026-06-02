import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bez.digital';

    return {
        rules: [
            {
                userAgent: '*',
                allow: [
                    '/',
                    '/solutions',
                    '/token',
                    '/network',
                    '/enterprise',
                    '/commerce',
                    '/payments',
                    '/financial',
                    '/bridges',
                    '/validators',
                    '/developers',
                    '/learn',
                    '/docs',
                    '/rpc',
                    '/support',
                ],
                // Block internal/authenticated routes from crawlers
                disallow: [
                    '/dashboard/',
                    '/admin/',
                    '/login',
                    '/onboarding/',
                    '/api/',
                ],
            },
        ],
        sitemap: `${BASE_URL}/sitemap.xml`,
        host: BASE_URL,
    };
}
