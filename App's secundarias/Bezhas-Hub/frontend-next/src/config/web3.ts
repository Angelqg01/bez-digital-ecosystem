import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { cookieStorage, createStorage } from 'wagmi';
import { polygon, anvil } from 'wagmi/chains';

export const CONTRACTS = {
    BEZCOIN: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
    QUALITY_ESCROW: '0x3088573c025F197A886b97440761990c9A9e83C9',
    RWA_FACTORY: '0x5F999157aF1DEfBf4E7e1b8021850b49e458CCc0',
    VAULT: '0xCDd23058bf8143680f0A320318604bB749f701ED',
    GOVERNANCE_SYSTEM: '0x304Fd77f64C03482edcec0923f0Cd4A066a305F3',
    CORE: '0x260A9fBcE1c6817c04e51c170b5BFd8d594c0d8A',
    LIQUIDITY_FARMING: '0x4C5330B45FEa670d5ffEAD418E74dB7EA5ECdD26',
    NFT_OFFERS: '0x0C9Bf667b838f6d466619ddb90a08d6c9A64d0A4',
    NFT_RENTAL: '0x96B1754BbfdC5a2f6013A8a04cB6AF2E4090C024',
    MARKETPLACE: '0x1c061A896E0ac9C046A93eaf475c45ED5Bd8A1fE',
    ADMIN_REGISTRY: '0xfCe2F7dcf1786d1606b9b858E9ba04dA499F1e3C'
};

export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

const metadata = {
    name: 'BeZhas',
    description: 'Web3 Social Network with AI & Blockchain',
    url: 'https://bez.digital',
    icons: ['https://bez.digital/logo.png']
};

export const config = defaultWagmiConfig({
    chains: [polygon, anvil],
    projectId,
    metadata,
    ssr: true,
    storage: createStorage({
        storage: cookieStorage
    }),
});

export function formatTokenBalance(balance: number | string | bigint, decimals = 18): string {
    if (!balance) return '0';
    return (Number(balance) / 10 ** decimals).toFixed(4);
}

export function shortenAddress(address?: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
