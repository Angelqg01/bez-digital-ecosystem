import { BrowserProvider, JsonRpcProvider } from 'ethers'
import { useMemo } from 'react'
import { usePublicClient, useWalletClient } from 'wagmi'

export function publicClientToProvider(publicClient) {
    const { chain, transport } = publicClient
    const network = {
        chainId: chain.id,
        name: chain.name,
        ensAddress: chain.contracts?.ensRegistry?.address,
    }
    if (transport.type === 'fallback')
        return new JsonRpcProvider(transport.transports[0].value.url, network)
    return new JsonRpcProvider(transport.url, network)
}

/** Hook to convert a viem Public Client to an ethers.js Provider. */
export function useEthersProvider({ chainId } = {}) {
    const publicClient = usePublicClient({ chainId })
    return useMemo(() => publicClient ? publicClientToProvider(publicClient) : undefined, [publicClient])
}

export function walletClientToSigner(walletClient) {
    const { account, chain, transport } = walletClient
    const network = {
        chainId: chain.id,
        name: chain.name,
        ensAddress: chain.contracts?.ensRegistry?.address,
    }
    const provider = new BrowserProvider(transport, network)
    const signer = provider.getSigner(account.address)
    return signer
}

/** Hook to convert a viem Wallet Client to an ethers.js Signer. */
export function useEthersSigner({ chainId } = {}) {
    const { data: walletClient } = useWalletClient({ chainId })
    return useMemo(
        () => (walletClient ? walletClientToSigner(walletClient) : undefined),
        [walletClient],
    )
}
