import { generateLandingMetadata } from '@/lib/seo';
export const metadata = generateLandingMetadata('/privacy');
export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
