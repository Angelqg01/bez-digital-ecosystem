import { Phase, ESCROW_COLLATERAL_BEZ, TARIFF_BEZ, PAYOUT_BEZ } from './types';

// Cadena de bloques simulada del explorer (Zona Franca → Tránsito → Destino)

export interface SimBlock {
  index: number;
  ts: string;
  label: string;
  hash: string;
  prevHash: string;
  nonce: number;
  txs: number;
  stepId: number;
  phase: Phase;
  status: 'mining' | 'confirmed';
}

export interface NftItem {
  id: string;
  name: string;
  standard: string;
  icon: string;
  minted: boolean;
  stepId: number;
}

export interface EscrowEvent {
  label: string;
  amount: string;
  type: 'lock' | 'debit' | 'release' | 'freeze';
  stepId: number;
}

export const randomHash = (): string =>
  Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('') +
  '...' +
  Array.from({ length: 4 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

export const createBlock = (
  index: number,
  prevHash: string,
  label: string,
  stepId: number,
  phase: Phase
): SimBlock => ({
  index,
  ts: new Date().toLocaleTimeString('es-ES'),
  label,
  hash: `0x${randomHash()}`,
  prevHash,
  nonce: Math.floor(Math.random() * 99999),
  txs: Math.floor(Math.random() * 8) + 1,
  stepId,
  phase,
  status: 'confirmed',
});

export const GENESIS_HASH = '0x' + '0'.repeat(12);

// NFTs del ciclo 360: se van minteando según avanza el flujo
export const NFT_CATALOG: NftItem[] = [
  { id: 'BZ-DPP-A1B2C3', name: 'Pasaporte Digital (DPP)', standard: 'ERC-721', icon: '🛂', minted: false, stepId: 1 },
  { id: 'BZ-RFID-8842', name: 'Precinto RFID Vinculado', standard: 'SBT', icon: '📡', minted: false, stepId: 2 },
  { id: 'BZ-SPS-E77', name: 'Certificado e-SPS', standard: 'VC W3C', icon: '🌿', minted: false, stepId: 6 },
  { id: 'BZ-EBL-92A1', name: 'e-BL / e-AWB Tokenizado', standard: 'ERC-721', icon: '📜', minted: false, stepId: 9 },
  { id: 'BZ-ECMR-80432', name: 'e-CMR Última Milla', standard: 'VC eFTI', icon: '🚚', minted: false, stepId: 15 },
  { id: 'BZ-CERT-FINAL', name: 'Certificado RWA Final', standard: 'ERC-721', icon: '🏅', minted: false, stepId: 16 },
];

export const nftsForStep = (completedStepIds: number[]): NftItem[] =>
  NFT_CATALOG.map((n) => ({ ...n, minted: completedStepIds.includes(n.stepId) }));

// Eventos de escrow que dispara cada paso relevante
export const escrowEventsForStep = (completedStepIds: number[], isBreached: boolean): EscrowEvent[] => {
  const events: EscrowEvent[] = [];
  if (completedStepIds.includes(1)) {
    events.push({ label: 'Colateral bloqueado (multifirma)', amount: `${ESCROW_COLLATERAL_BEZ.toLocaleString()} BEZ`, type: 'lock', stepId: 1 });
  }
  if (completedStepIds.includes(13)) {
    events.push({ label: 'Aranceles liquidados (oráculo fiscal)', amount: `-${TARIFF_BEZ} BEZ`, type: 'debit', stepId: 13 });
  }
  if (completedStepIds.includes(16)) {
    if (isBreached) {
      events.push({ label: '🛑 Fondos congelados — disputa L2 activa', amount: `${PAYOUT_BEZ.toLocaleString()} BEZ FROZEN`, type: 'freeze', stepId: 16 });
    } else {
      events.push({ label: 'Liquidación al transportista (PoD)', amount: `${PAYOUT_BEZ.toLocaleString()} BEZ`, type: 'release', stepId: 16 });
    }
  }
  return events;
};
