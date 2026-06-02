/**
 * Mezcla Posts, Reels, Ads y NFTs en un solo feed coherente
 * Reglas:
 * - Reels: Aleatorio cada 5-7 items
 * - Ads: Aleatorio cada 3-5 items
 * - NFTs: Aleatorio (baja probabilidad)
 */
export const mixFeedContent = (posts = [], reels = [], ads = [], nfts = []) => {
    let mixedFeed = [];
    let reelIndex = 0;
    let adIndex = 0;
    let nftIndex = 0;

    // Contadores para la lógica de inserción
    let itemsSinceLastReel = 0;
    let itemsSinceLastAd = 0;

    // Configuración de frecuencia (Random entre min y max)
    const getNextReelGap = () => Math.floor(Math.random() * (7 - 5 + 1) + 5);
    const getNextAdGap = () => Math.floor(Math.random() * (5 - 3 + 1) + 3);

    let nextReelGap = getNextReelGap();
    let nextAdGap = getNextAdGap();

    // Iteramos principalmente sobre los posts, que son la base del feed
    posts.forEach((post) => {
        // 1. Agregar el Post normal
        mixedFeed.push({ type: 'post', data: post });
        itemsSinceLastReel++;
        itemsSinceLastAd++;

        // 2. Lógica de Inserción de REELS (Cada 5-7 items)
        if (itemsSinceLastReel >= nextReelGap && reelIndex < reels.length) {
            mixedFeed.push({ type: 'reel', data: reels[reelIndex] });
            reelIndex++;
            itemsSinceLastReel = 0;
            nextReelGap = getNextReelGap(); // Recalcular siguiente gap
            itemsSinceLastAd++; // Cuenta como item para el Ad
        }

        // 3. Lógica de Inserción de ADS (Cada 3-5 items)
        // Verificamos que no acabamos de meter un Reel para no saturar
        if (itemsSinceLastAd >= nextAdGap && adIndex < ads.length && itemsSinceLastReel !== 0) {
            mixedFeed.push({ type: 'ad', data: ads[adIndex] });
            adIndex++;
            itemsSinceLastAd = 0;
            nextAdGap = getNextAdGap();
            itemsSinceLastReel++;
        }

        // 4. Lógica de Inserción de NFTs (Aleatorio, ~10% de probabilidad)
        if (Math.random() < 0.1 && nftIndex < nfts.length) {
            mixedFeed.push({ type: 'nft', data: nfts[nftIndex] });
            nftIndex++;
            itemsSinceLastReel++;
            itemsSinceLastAd++;
        }
    });

    return mixedFeed;
};
