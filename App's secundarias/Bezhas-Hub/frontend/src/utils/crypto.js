// Secure, in-memory encryption using a key derived from a wallet signature.

/**
 * Derives a secure 256-bit AES-GCM key from a user's wallet signature.
 * The signature provides high entropy, and hashing it ensures a fixed-length key.
 * @param {string} signature - The signature hex string (e.g., from ethers.signer.signMessage).
 * @returns {Promise<CryptoKey>} A CryptoKey object suitable for AES-GCM operations.
 */
export async function deriveKeyFromSignature(signature) {
  const enc = new TextEncoder();
  // Using SHA-256 to hash the signature into a 32-byte key.
  const keyData = await window.crypto.subtle.digest('SHA-256', enc.encode(signature));
  return window.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false, // not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a JSON-serializable object using a derived CryptoKey.
 * @param {object} obj - The object to encrypt.
 * @param {CryptoKey} key - The key derived from the user's signature.
 * @returns {Promise<string>} A base64 encoded string of the encrypted payload (IV + ciphertext).
 */
export async function encryptWithKey(obj, key) {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV is recommended for AES-GCM
  const data = enc.encode(JSON.stringify(obj));
  const cipherBuffer = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  
  // Combine IV and ciphertext for storage/transmission
  const payload = new Uint8Array(iv.length + cipherBuffer.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(cipherBuffer), iv.length);
  
  // Return as a base64 string for easy storage
  return btoa(String.fromCharCode.apply(null, payload));
}

/**
 * Decrypts a base64 payload using a derived CryptoKey.
 * @param {string} payloadB64 - The base64 encoded encrypted payload.
 * @param {CryptoKey} key - The key derived from the user's signature.
 * @returns {Promise<object>} The decrypted JSON object.
 */
export async function decryptWithKey(payloadB64, key) {
  const dec = new TextDecoder();
  const payload = new Uint8Array(atob(payloadB64).split('').map(c => c.charCodeAt(0)));
  
  const iv = payload.slice(0, 12);
  const cipher = payload.slice(12);
  
  const plainBuffer = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return JSON.parse(dec.decode(plainBuffer));
}
