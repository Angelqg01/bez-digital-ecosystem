import { Providers } from "../../providers/Providers";
import Navbar from "../../components/layout/Navbar";
import BuyBezModal from "../../components/economy/BuyBezModal";

// Páginas operativas anteriores del Hub (wallet, DeFi, RWA, marketplace…). Mantienen sus URLs;
// el grupo (legacy) solo les da el proveedor Web3 y la barra de antes.
export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-sans pt-16 bg-white dark:bg-gray-950 min-h-screen">
      <Providers>
        <Navbar />
        {children}
        <BuyBezModal />
      </Providers>
    </div>
  );
}
