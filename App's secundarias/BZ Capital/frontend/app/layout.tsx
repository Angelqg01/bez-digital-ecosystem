import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { SSOProvider } from '@/components/SSOProvider';
import { DefiLayoutContent } from '@/components/DefiLayoutContent';

export const metadata: Metadata = {
    title: 'BeZhas DeFi',
    description: 'Landing DeFi de BeZhas para staking, farming, gobernanza, tesoreria y pagos Web3',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es">
            <body className="flex min-h-screen bg-[#090d16]">
                <SSOProvider>
                    <Sidebar />
                    <DefiLayoutContent>{children}</DefiLayoutContent>
                </SSOProvider>
            </body>
        </html>
    );
}
