import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { DraggableWindow } from './DraggableWindow';

interface CertificateModalProps {
  onClose: () => void;
  bUid: string;
  isBreached: boolean;
  containerRef?: React.RefObject<HTMLElement>;
}

// Certificado RWA final + QR Track & Trace
export const CertificateModal: React.FC<CertificateModalProps> = ({ onClose, bUid, isBreached, containerRef }) => {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const trackUrl = `https://hub.bez.digital/track/${bUid}`;

  useEffect(() => {
    QRCode.toDataURL(trackUrl, {
      width: 140,
      margin: 1,
      color: { dark: '#00d4aa', light: '#00000000' },
    })
      .then(setQrUrl)
      .catch(() => setQrUrl(null));
  }, [trackUrl]);

  return (
    <DraggableWindow
      title={isBreached ? 'RWA Certificate — DISPUTA' : 'RWA Certificate'}
      isOpen={true}
      onClose={onClose}
      theme="amber"
      defaultPosition={{ x: 180, y: 60 }}
      width={620}
      maxHeight={520}
      containerRef={containerRef}
    >
      <div className="bg-black/40 w-full text-zinc-300 relative flex flex-col font-mono">
        <div className="p-5 pb-4 border-b border-amber-900/40 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-[0.3em] text-amber-500 mb-1 uppercase">Certificate of Authenticity</h2>
            <p className="text-[10px] text-amber-500/60 tracking-widest uppercase">Immutable Digital Ownership Metadata · BeZhas Logistics L2</p>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5 text-xs shrink-0">
          <div className="space-y-3">
            <div>
              <div className="text-zinc-600 mb-1 uppercase tracking-widest text-[10px]">Asset ID (B-UID)</div>
              <div className="text-white font-bold">{bUid}</div>
            </div>
            <div>
              <div className="text-zinc-600 mb-1 uppercase tracking-widest text-[10px]">Smart Contract Address</div>
              <div className="text-amber-400 break-all">0x8fB3cE2bB4a187...a1b2c3d4e5f6</div>
            </div>
            <div>
              <div className="text-zinc-600 mb-1 uppercase tracking-widest text-[10px]">Token Standard</div>
              <div className="text-white">ERC-721 (RWA BeZ) · Polygon L2</div>
            </div>
            <div>
              <div className="text-zinc-600 mb-1 uppercase tracking-widest text-[10px]">Emisor</div>
              <div className="text-white">BeZhas Logistics · Zona Franca</div>
            </div>
            <div>
              <div className="text-zinc-600 mb-1 uppercase tracking-widest text-[10px]">Estado Final</div>
              {isBreached ? (
                <div className="text-red-400 font-bold animate-pulse">HALTED — DISPUTA L2 ACTIVA (ESCROW FROZEN)</div>
              ) : (
                <div className="text-emerald-400 font-bold drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">DELIVERED & SETTLED</div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-2 border border-amber-500/20 rounded p-3">
            <div className="text-[9px] text-amber-500/70 uppercase tracking-[0.2em] font-bold">QR Track & Trace</div>
            {qrUrl ? (
              <img src={qrUrl} alt={`QR de trazabilidad ${bUid}`} className="w-[130px] h-[130px]" />
            ) : (
              <div className="w-[130px] h-[130px] border border-dashed border-amber-500/20 rounded flex items-center justify-center text-[8px] text-zinc-600">
                Generando QR...
              </div>
            )}
            <div className="text-[7px] text-zinc-500 break-all text-center">{trackUrl}</div>
            <div className="text-[8px] text-amber-500/60 text-center uppercase tracking-widest flex items-center gap-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-amber-500">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              RWA VERIFIED
            </div>
          </div>
        </div>

        <div className="p-4 bg-amber-950/20 border-t border-amber-900/40 text-[8px] text-amber-500/60 leading-relaxed text-center tracking-widest mt-auto shrink-0">
          {isBreached
            ? 'ESTE CERTIFICADO REGISTRA UNA EXCURSIÓN TÉRMICA VERIFICADA POR EL ORÁCULO IOT. LOS FONDOS DE ESCROW PERMANECEN CONGELADOS BAJO PROTOCOLO DE ARBITRAJE MULTIFIRMA L2.'
            : 'THIS DIGITAL FINGERPRINT CERTIFIES THAT THE REAL-WORLD ASSET (RWA) LINKED TO THIS NFT HAS BEEN VERIFIED FROM ORIGIN FREE TRADE ZONE TO FINAL DISTRIBUTOR, IN-TRANSIT INTEGRITY VALIDATED VIA IOT ORACLE, AND ESCROW FUNDS RELEASED TO THE CARRIER.'}
        </div>
      </div>
    </DraggableWindow>
  );
};
