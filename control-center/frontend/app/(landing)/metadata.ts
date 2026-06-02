/**
 * app/(landing)/metadata.ts
 *
 * Next.js requires metadata exports to come from Server Components.
 * Since (landing)/layout.tsx is "use client", we place the default
 * metadata export here and re-export it from each page via generateMetadata.
 *
 * Usage in a landing page:
 *   export { generateMetadata } from '@/app/(landing)/metadata';
 *
 * Or with page-specific override:
 *   import { generateLandingMetadata } from '@/lib/seo';
 *   export const generateMetadata = () => generateLandingMetadata('/solutions');
 */
import { generateLandingMetadata } from '@/lib/seo';

// Default — used for the root landing page (path = '/')
export function generateMetadata() {
    return generateLandingMetadata('/');
}
