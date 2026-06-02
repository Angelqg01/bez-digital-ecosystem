import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import GoogleAnalytics from "@/components/GoogleAnalytics";

const inter = Inter({ subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: '--font-space-grotesk',
  weight: ['300', '400', '500', '600', '700']
});

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bez.digital';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'BeZhas | Web3 Global Engine for B2B Logistics',
    template: '%s | BeZhas',
  },
  description:
    'BeZhas is the enterprise blockchain L2 for global supply chains — AI Oracles, industrial tokenization, DePIN mining, and real-time logistics powered by BEZ-Coin.',
  keywords: [
    'blockchain logistics', 'supply chain blockchain', 'L2 blockchain', 'DePIN',
    'industrial tokenization', 'AI oracle', 'BEZ coin', 'enterprise Web3',
    'BeZhas', 'smart contracts logistics', 'blockchain B2B',
  ],
  authors: [{ name: 'BeZhas Protocol', url: BASE_URL }],
  creator: 'BeZhas Protocol',
  publisher: 'BeZhas Protocol',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
  },
  alternates: {
    canonical: BASE_URL,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/favicon.png', type: 'image/png' },
      { url: '/bezhas-token-logo.png', type: 'image/png', sizes: '1024x1024' },
    ],
    apple: [{ url: '/bezhas-token-logo.png', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: BASE_URL,
    siteName: 'BeZhas Protocol',
    title: 'BeZhas | Web3 Global Engine for B2B Logistics',
    description:
      'Enterprise blockchain L2 for global supply chains. AI Oracles, DePIN mining, and real-time logistics on BeZhas Network.',
    images: [
      {
        url: `${BASE_URL}/og-default.png`,
        width: 1200,
        height: 630,
        alt: 'BeZhas Protocol — Web3 Global Engine',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@bezhasprotocol',
    creator: '@bezhasprotocol',
    title: 'BeZhas | Web3 Global Engine for B2B Logistics',
    description:
      'Enterprise blockchain L2 for global supply chains. AI Oracles, DePIN mining, real-time logistics.',
    images: [`${BASE_URL}/og-default.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={spaceGrotesk.variable} suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <GoogleAnalytics />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
