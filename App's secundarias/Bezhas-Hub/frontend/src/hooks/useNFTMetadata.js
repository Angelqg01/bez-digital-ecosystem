import { useState, useEffect } from 'react';

const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

const getHttpUrl = (uri) => {
  if (!uri) return null;
  if (uri.startsWith('ipfs://')) {
    return `${IPFS_GATEWAY}${uri.substring(7)}`;
  }
  return uri;
};

export const useNFTMetadata = (tokenURI) => {
  const [metadata, setMetadata] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMetadata = async () => {
      const url = getHttpUrl(tokenURI);
      if (!url) {
        setIsLoading(false);
        setError('Token URI no es válida.');
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error al obtener metadatos: ${response.statusText}`);
        }
        const data = await response.json();
        // Asegurarnos de que la imagen también use una URL HTTP
        if (data.image) {
          data.image = getHttpUrl(data.image);
        }
        setMetadata(data);
      } catch (e) {
        console.error("Error fetching NFT metadata:", e);
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetadata();
  }, [tokenURI]);

  return { metadata, isLoading, error };
};
