/**
 * Smart Feed Mixer
 * Algoritmo inteligente para mezclar posts orgánicos, noticias, anuncios y NFTs
 * con distribución óptima para maximizar engagement
 */

class FeedOptimizer {
    constructor() {
        this.weights = {
            news: 0.4,        // 40% noticias
            organic: 0.35,    // 35% posts orgánicos
            ads: 0.15,        // 15% anuncios
            nfts: 0.05,       // 5% NFTs
            reels: 0.05       // 5% reels
        };

        this.patterns = [
            ['news', 'organic', 'news', 'organic', 'ad', 'news', 'organic', 'nft'],
            ['organic', 'news', 'organic', 'news', 'reel', 'organic', 'ad', 'news'],
            ['news', 'news', 'organic', 'ad', 'organic', 'news', 'nft', 'organic']
        ];
    }

    /**
     * Mezcla inteligente de contenido
     */
    mixContent({ news = [], organic = [], ads = [], nfts = [], reels = [] }) {
        const mixed = [];
        const pattern = this.patterns[Math.floor(Math.random() * this.patterns.length)];

        // Crear pools de contenido
        const pools = {
            news: [...news],
            organic: [...organic],
            ads: [...ads],
            nfts: [...nfts],
            reels: [...reels]
        };

        // Seguir patrón hasta llenar el feed
        let patternIndex = 0;
        const maxItems = 50; // Límite de items en feed

        while (mixed.length < maxItems) {
            const type = pattern[patternIndex % pattern.length];
            const pool = pools[type];

            if (pool && pool.length > 0) {
                const item = pool.shift();
                mixed.push({
                    ...item,
                    feedType: type,
                    feedPosition: mixed.length
                });
            }

            patternIndex++;

            // Break si todos los pools están vacíos
            if (Object.values(pools).every(p => !p || p.length === 0)) break;
        }

        return mixed;
    }

    /**
     * Calcula score de engagement predicho
     */
    calculateEngagementScore(post) {
        let score = 50; // Base

        // Factores positivos
        if (post.isVerified) score += 10;
        if (post.isVIP) score += 5;
        if (post.media && post.media.length > 0) score += 15;
        if (post.hashtags && post.hashtags.length > 0) score += 5;
        if (post.relevanceScore) score += (post.relevanceScore - 50) * 0.3;

        // Factores temporales
        const age = Date.now() - new Date(post.timestamp).getTime();
        const hoursOld = age / (1000 * 60 * 60);
        if (hoursOld < 1) score += 20; // Muy reciente
        else if (hoursOld < 6) score += 10;
        else if (hoursOld > 24) score -= 10;

        // Engagement actual
        if (post.likes) score += Math.min(post.likes / 10, 20);
        if (post.comments) score += Math.min(post.comments / 2, 15);

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Ordena posts por engagement predicho
     */
    sortByEngagement(posts) {
        return posts
            .map(post => ({
                ...post,
                engagementScore: this.calculateEngagementScore(post)
            }))
            .sort((a, b) => b.engagementScore - a.engagementScore);
    }

    /**
     * Inserta ads de forma natural (cada 5-7 posts)
     */
    insertAdsNaturally(posts, ads) {
        if (!ads || ads.length === 0) return posts;

        const result = [];
        let adIndex = 0;
        const adInterval = 6; // Cada 6 posts un ad

        posts.forEach((post, i) => {
            result.push(post);

            // Insertar ad después del intervalo
            if ((i + 1) % adInterval === 0 && adIndex < ads.length) {
                result.push({
                    ...ads[adIndex],
                    isAd: true,
                    feedPosition: result.length
                });
                adIndex++;
            }
        });

        return result;
    }

    /**
     * Aplica diversidad: no más de 2 posts del mismo autor consecutivos
     */
    applyDiversity(posts) {
        const result = [];
        let lastAuthor = null;
        let authorCount = 0;

        const remaining = [...posts];

        while (remaining.length > 0) {
            let nextPost = null;

            // Buscar post de autor diferente si es necesario
            if (authorCount >= 2) {
                const idx = remaining.findIndex(p =>
                    p.author?.username !== lastAuthor
                );
                if (idx !== -1) {
                    nextPost = remaining.splice(idx, 1)[0];
                }
            }

            // Si no se encontró, tomar el primero
            if (!nextPost) {
                nextPost = remaining.shift();
            }

            // Actualizar contador
            if (nextPost.author?.username === lastAuthor) {
                authorCount++;
            } else {
                lastAuthor = nextPost.author?.username;
                authorCount = 1;
            }

            result.push(nextPost);
        }

        return result;
    }

    /**
     * Pipeline completo de optimización
     */
    optimize(feeds) {
        console.log('🎯 [Feed Optimizer] Optimizando feed...');

        // 1. Mezclar contenido según patrón
        let mixed = this.mixContent(feeds);

        // 2. Ordenar por engagement dentro de cada tipo
        mixed = this.sortByEngagement(mixed);

        // 3. Aplicar diversidad
        mixed = this.applyDiversity(mixed);

        // 4. Insertar ads naturalmente
        if (feeds.ads) {
            mixed = this.insertAdsNaturally(mixed, feeds.ads);
        }

        console.log(`✅ [Feed Optimizer] ${mixed.length} items optimizados`);
        return mixed;
    }
}

module.exports = new FeedOptimizer();
