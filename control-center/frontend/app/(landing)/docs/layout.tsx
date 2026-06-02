import { generateLandingMetadata } from '@/lib/seo';
export const metadata = generateLandingMetadata('/docs');
export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
