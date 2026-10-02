/**
 * Mensaje SIWE (EIP-4361) en JS puro, sin dependencias.
 * OJO: `statement` solo puede contener ASCII (sin tildes ni ñ) o el parser lo rechaza.
 * El backend lo parsea y verifica con la librería `siwe`; `address` debe estar en formato EIP-55.
 */
export function buildSiweMessage({ domain, address, statement, uri, chainId, nonce, issuedAt, expirationTime }) {
    return [
        `${domain} wants you to sign in with your Ethereum account:`,
        address,
        '',
        statement,
        '',
        `URI: ${uri}`,
        'Version: 1',
        `Chain ID: ${chainId}`,
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt}`,
        `Expiration Time: ${expirationTime}`,
    ].join('\n');
}
