import { useAccount } from 'wagmi';

// Minimal auth shim: exposes a useAuth hook compatible with existing pages
// Returns { user: { address }, isAuthenticated } using wagmi account
export function useAuth() {
    const { address, isConnected } = useAccount();
    const user = isConnected && address ? { address } : null;
    return { user, isAuthenticated: !!user };
}

export default { useAuth };
