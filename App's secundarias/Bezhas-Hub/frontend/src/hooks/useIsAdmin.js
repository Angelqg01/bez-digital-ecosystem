import { useAccount, useReadContract } from 'wagmi';
import { userProfileAbi, contractAddresses } from '../lib/blockchain/contracts';

// Wallets autorizadas (debe coincidir con AdminRoute.jsx y backend .env)
const ADMIN_WALLETS = [
  '0x52Df82920CBAE522880dD7657e43d1A754eD044E',
  '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3',
  '0x89c23890c742d710265dd61be789c71dc8999b12',
  '0xc0ec3b1fcb7dc0c764371919837c13b58cdc330a',
].map(a => a.toLowerCase());

export const useIsAdmin = () => {
  const { address, isConnected } = useAccount();

  const { data: owner, isLoading } = useReadContract({
    address: contractAddresses.userProfile,
    abi: userProfileAbi,
    functionName: 'owner',
    query: {
      enabled: isConnected,
    },
  });

  const addr = address?.toLowerCase();
  const isOwner = isConnected && !isLoading && owner?.toLowerCase() === addr;
  const isInList = isConnected && !!addr && ADMIN_WALLETS.includes(addr);
  const isAdmin = isOwner || isInList;

  return { isAdmin, isLoading };
};
