import { generateLandingMetadata } from '@/lib/seo';
export const metadata = generateLandingMetadata('/mcp');
export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
