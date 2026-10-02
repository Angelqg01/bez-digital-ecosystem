import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../providers/Providers";
import Navbar from "../components/layout/Navbar";
import BuyBezModal from "../components/economy/BuyBezModal";
import AIWorkspaceBar from "../components/ai/AIWorkspaceBar";

export const metadata: Metadata = {
  title: "BeZhas — Web3 Social & DeFi Ecosystem",
  description: "Buy, farm, and tokenize real-world assets. Powered by the BeZhas Blockchain Core on Polygon.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="font-sans pt-16 pb-28 bg-white dark:bg-gray-950">
        <Providers>
          <Navbar />
          {children}
          {/* Global modals — rendered above any page */}
          <BuyBezModal />
          {/* Chat IA flotante: solo operativo con sesión iniciada */}
          <AIWorkspaceBar />
        </Providers>
      </body>
    </html>
  );
}
