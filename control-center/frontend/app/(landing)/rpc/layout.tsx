import { generateLandingMetadata } from '@/lib/seo';
export const metadata = generateLandingMetadata('/rpc');
export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
