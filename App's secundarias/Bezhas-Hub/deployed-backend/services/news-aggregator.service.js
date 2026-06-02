/**
 * News Aggregator Service
 * Extrae noticias de múltiples fuentes (RSS + APIs) y las convierte en posts
 */

const Parser = require('rss-parser');
const axios = require('axios');
const botProfiles = require('../data/botProfiles');
const crypto = require('crypto');

const parser = new Parser({
    timeout: 10000,
    customFields: {
        item: ['media:content', 'media:thumbnail']
    }
});

// Almacenamiento en memoria de los posts generados
let newsPostsCache = [];
let lastFetchTime = null;
let fetchInProgress = false;
const seenHashes = new Set();
const failedSources = new Map(); // Track failed sources with timestamps// Fuentes RSS - MASIVAMENTE EXPANDIDO (25+ fuentes)
const RSS_FEEDS = {
    // === CRYPTO & BLOCKCHAIN ===
    google_crypto: 'https://news.google.com/rss/search?q=cryptocurrency+blockchain&hl=en-US&gl=US&ceid=US:en',
    google_defi: 'https://news.google.com/rss/search?q=defi+decentralized+finance&hl=en-US&gl=US&ceid=US:en',
    google_polygon: 'https://news.google.com/rss/search?q=polygon+matic+sidechain&hl=en-US&gl=US&ceid=US:en',
    coindesk: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    cointelegraph: 'https://cointelegraph.com/rss',

    // === TECNOLOGÍA & PROGRAMACIÓN ===
    google_tech: 'https://news.google.com/rss/search?q=technology+web3+metaverse&hl=en-US&gl=US&ceid=US:en',
    google_programming: 'https://news.google.com/rss/search?q=programming+software+development&hl=en-US&gl=US&ceid=US:en',
    google_ai: 'https://news.google.com/rss/search?q=artificial+intelligence+machine+learning&hl=en-US&gl=US&ceid=US:en',

    // === CIENCIA & BIOTECNOLOGÍA ===
    google_science: 'https://news.google.com/rss/search?q=science+research+innovation&hl=en-US&gl=US&ceid=US:en',
    google_biotech: 'https://news.google.com/rss/search?q=biotechnology+genetics+medical&hl=en-US&gl=US&ceid=US:en',
    google_health: 'https://news.google.com/rss/search?q=health+wellness+fitness&hl=en-US&gl=US&ceid=US:en',

    // === FINANZAS & TRADING ===
    google_finance: 'https://news.google.com/rss/search?q=finance+investment+market&hl=en-US&gl=US&ceid=US:en',
    google_trading: 'https://news.google.com/rss/search?q=trading+analysis+stocks&hl=en-US&gl=US&ceid=US:en',
    yahoo_finance: 'https://finance.yahoo.com/rss/',

    // === ECONOMÍA & MACROECONOMÍA ===
    google_economy: 'https://news.google.com/rss/search?q=macroeconomics+economy+gdp&hl=en-US&gl=US&ceid=US:en',
    google_strategy: 'https://news.google.com/rss/search?q=strategic+economics+policy&hl=en-US&gl=US&ceid=US:en',

    // === NEGOCIOS & EMPRESAS ===
    google_business: 'https://news.google.com/rss/search?q=business+entrepreneurship+startups&hl=en-US&gl=US&ceid=US:en',
    google_management: 'https://news.google.com/rss/search?q=business+fundamentals+management&hl=en-US&gl=US&ceid=US:en',

    // === DISEÑO & ARQUITECTURA ===
    google_design: 'https://news.google.com/rss/search?q=design+innovation+creative&hl=en-US&gl=US&ceid=US:en',
    google_architecture: 'https://news.google.com/rss/search?q=architecture+urban+planning&hl=en-US&gl=US&ceid=US:en',

    // === PATENTES & PROPIEDAD INTELECTUAL ===
    google_patents: 'https://news.google.com/rss/search?q=patents+innovation+intellectual+property&hl=en-US&gl=US&ceid=US:en',

    // === MEDIO AMBIENTE ===
    google_environment: 'https://news.google.com/rss/search?q=environment+sustainability+climate&hl=en-US&gl=US&ceid=US:en',

    // === POLÍTICA (Relacionada con Mercados) ===
    google_politics_markets: 'https://news.google.com/rss/search?q=politics+economy+markets+regulation&hl=en-US&gl=US&ceid=US:en',

    // === MINDFULNESS & BIENESTAR ===
    google_mindfulness: 'https://news.google.com/rss/search?q=mindfulness+meditation+mental+health&hl=en-US&gl=US&ceid=US:en',

    // === DEPORTES ESTRATÉGICOS (Airsoft) ===
    google_airsoft: 'https://news.google.com/rss/search?q=airsoft+tactical+military+simulation&hl=en-US&gl=US&ceid=US:en'
};

// Función auxiliar para obtener un bot aleatorio según el tipo
const getBotForCategory = (category) => {
    const relevantBots = botProfiles.filter(b =>
        category === 'mix' ? true : b.sourceType === category
    );
    return relevantBots[Math.floor(Math.random() * relevantBots.length)] || botProfiles[0];
};

// Función para limpiar HTML de las descripciones RSS
const cleanDescription = (html) => {
    if (!html) return '';
    let text = html.replace(/<[^>]*>?/gm, '');
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    return text.trim().substring(0, 200);
};

// Función para generar hash único de contenido (deduplicación)
const generateContentHash = (title, content) => {
    const text = `${title}${content}`.toLowerCase().replace(/\s+/g, '');
    return crypto.createHash('md5').update(text).digest('hex');
};

// Función para calcular score de relevancia - EXPANDIDA
const calculateRelevanceScore = (item, sourceType) => {
    let score = 50; // Base score
    const text = `${item.title} ${item.contentSnippet || ''}`.toLowerCase();

    // Keywords de ULTRA alto valor (Crypto & Tech)
    const ultraHighKeywords = ['bitcoin', 'ethereum', 'polygon', 'matic', 'defi', 'nft', 'web3', 'blockchain'];
    const highValueKeywords = ['crypto', 'metaverse', 'trading', 'investment', 'ai', 'machine learning', 'biotech'];

    // Keywords por categoría
    const financeKeywords = ['market', 'stock', 'forex', 'technical analysis', 'chart', 'bull', 'bear'];
    const techKeywords = ['programming', 'development', 'software', 'code', 'api', 'framework'];
    const scienceKeywords = ['research', 'innovation', 'discovery', 'study', 'patent', 'breakthrough'];
    const businessKeywords = ['startup', 'entrepreneur', 'strategy', 'management', 'growth', 'revenue'];
    const healthKeywords = ['health', 'fitness', 'wellness', 'mindfulness', 'meditation', 'nutrition'];
    const ecoKeywords = ['environment', 'sustainability', 'climate', 'renewable', 'green', 'carbon'];
    const designKeywords = ['design', 'architecture', 'creative', 'ux', 'ui', 'prototype'];
    const politicsKeywords = ['regulation', 'policy', 'government', 'legislation', 'law'];

    // Scoring por categorías
    ultraHighKeywords.forEach(kw => { if (text.includes(kw)) score += 20; });
    highValueKeywords.forEach(kw => { if (text.includes(kw)) score += 12; });
    financeKeywords.forEach(kw => { if (text.includes(kw)) score += 8; });
    techKeywords.forEach(kw => { if (text.includes(kw)) score += 8; });
    scienceKeywords.forEach(kw => { if (text.includes(kw)) score += 7; });
    businessKeywords.forEach(kw => { if (text.includes(kw)) score += 6; });
    healthKeywords.forEach(kw => { if (text.includes(kw)) score += 5; });
    ecoKeywords.forEach(kw => { if (text.includes(kw)) score += 5; });
    designKeywords.forEach(kw => { if (text.includes(kw)) score += 5; });
    politicsKeywords.forEach(kw => { if (text.includes(kw)) score += 4; });

    // Boost por tipo de fuente
    const sourceBoosts = {
        'crypto': 15, 'finance': 12, 'tech': 10, 'science': 8,
        'business': 7, 'health': 6, 'design': 5, 'politics': 4
    };
    score += sourceBoosts[sourceType] || 5;

    // Penalty por edad (noticias viejas menos relevantes)
    if (item.pubDate) {
        const age = Date.now() - new Date(item.pubDate).getTime();
        const hoursOld = age / (1000 * 60 * 60);
        if (hoursOld > 24) score -= 10;
        if (hoursOld > 48) score -= 20;
        if (hoursOld > 72) score -= 30;
    }

    return Math.max(0, Math.min(100, score));
};

// Función para extraer imagen de RSS
const extractImage = (item) => {
    // Intentar varias fuentes de imagen
    if (item['media:content'] && item['media:content'].$?.url) {
        return item['media:content'].$.url;
    }
    if (item['media:thumbnail'] && item['media:thumbnail'].$?.url) {
        return item['media:thumbnail'].$.url;
    }
    if (item.enclosure?.url) {
        return item.enclosure.url;
    }
    return null;
};

// Función para generar hashtags dinámicos por tipo
const generateHashtags = (sourceType, title) => {
    const baseHashtags = ['#News'];
    const text = title.toLowerCase();

    // Hashtags por tipo de fuente
    const typeHashtags = {
        'crypto': ['#Crypto', '#Blockchain', '#Web3'],
        'finance': ['#Finance', '#Trading', '#Markets'],
        'tech': ['#Technology', '#Innovation', '#Tech'],
        'science': ['#Science', '#Research', '#Innovation'],
        'business': ['#Business', '#Entrepreneurship', '#Strategy'],
        'health': ['#Health', '#Wellness', '#Fitness'],
        'design': ['#Design', '#Architecture', '#Creative'],
        'politics': ['#Politics', '#Policy', '#Regulation'],
        'sports': ['#Sports', '#Tactical', '#Training']
    };

    // Hashtags específicos por keywords
    if (text.includes('bitcoin') || text.includes('btc')) baseHashtags.push('#Bitcoin');
    if (text.includes('ethereum') || text.includes('eth')) baseHashtags.push('#Ethereum');
    if (text.includes('polygon') || text.includes('matic')) baseHashtags.push('#Polygon');
    if (text.includes('defi')) baseHashtags.push('#DeFi');
    if (text.includes('nft')) baseHashtags.push('#NFT');
    if (text.includes('ai') || text.includes('artificial intelligence')) baseHashtags.push('#AI');
    if (text.includes('biotech') || text.includes('genetics')) baseHashtags.push('#Biotech');
    if (text.includes('trading') || text.includes('technical analysis')) baseHashtags.push('#Trading');
    if (text.includes('environment') || text.includes('climate')) baseHashtags.push('#Sustainability');
    if (text.includes('mindfulness') || text.includes('meditation')) baseHashtags.push('#Mindfulness');

    // Combinar con hashtags del tipo
    const combinedHashtags = [...new Set([...baseHashtags, ...(typeHashtags[sourceType] || [])])];
    return combinedHashtags.slice(0, 5); // Máximo 5 hashtags
};

// Función principal para obtener noticias
const fetchNews = async () => {
    const startTime = Date.now();
    console.log('📰 [News Aggregator] Iniciando extracción de noticias...');
    let newPosts = [];
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    try {
        // 1. Fuentes RSS - DISTRIBUIDAS POR CATEGORÍA (25+ fuentes)
        const feedSources = [
            // === CRYPTO & BLOCKCHAIN (Top Priority) ===
            { url: RSS_FEEDS.google_crypto, type: 'crypto', limit: 5 },
            { url: RSS_FEEDS.google_defi, type: 'crypto', limit: 4 },
            { url: RSS_FEEDS.google_polygon, type: 'crypto', limit: 3 },
            { url: RSS_FEEDS.coindesk, type: 'crypto', limit: 6 },
            { url: RSS_FEEDS.cointelegraph, type: 'crypto', limit: 5 },

            // === FINANZAS & TRADING ===
            { url: RSS_FEEDS.google_finance, type: 'finance', limit: 4 },
            { url: RSS_FEEDS.google_trading, type: 'finance', limit: 4 },
            { url: RSS_FEEDS.yahoo_finance, type: 'finance', limit: 3 },

            // === TECNOLOGÍA & PROGRAMACIÓN ===
            { url: RSS_FEEDS.google_tech, type: 'tech', limit: 4 },
            { url: RSS_FEEDS.google_programming, type: 'tech', limit: 3 },
            { url: RSS_FEEDS.google_ai, type: 'tech', limit: 4 },

            // === CIENCIA & BIOTECNOLOGÍA ===
            { url: RSS_FEEDS.google_science, type: 'science', limit: 3 },
            { url: RSS_FEEDS.google_biotech, type: 'science', limit: 3 },

            // === ECONOMÍA ===
            { url: RSS_FEEDS.google_economy, type: 'finance', limit: 3 },
            { url: RSS_FEEDS.google_strategy, type: 'finance', limit: 2 },

            // === NEGOCIOS ===
            { url: RSS_FEEDS.google_business, type: 'business', limit: 3 },
            { url: RSS_FEEDS.google_management, type: 'business', limit: 2 },

            // === SALUD & FITNESS ===
            { url: RSS_FEEDS.google_health, type: 'health', limit: 3 },
            { url: RSS_FEEDS.google_mindfulness, type: 'health', limit: 2 },

            // === DISEÑO & ARQUITECTURA ===
            { url: RSS_FEEDS.google_design, type: 'design', limit: 2 },
            { url: RSS_FEEDS.google_architecture, type: 'design', limit: 2 },

            // === INNOVACIÓN ===
            { url: RSS_FEEDS.google_patents, type: 'tech', limit: 2 },

            // === MEDIO AMBIENTE ===
            { url: RSS_FEEDS.google_environment, type: 'science', limit: 2 },

            // === POLÍTICA & MERCADOS ===
            { url: RSS_FEEDS.google_politics_markets, type: 'politics', limit: 2 },

            // === DEPORTES ESTRATÉGICOS ===
            { url: RSS_FEEDS.google_airsoft, type: 'sports', limit: 1 }
        ];

        for (const source of feedSources) {
            // Skip fuentes que fallaron recientemente (retry después de 10 min)
            const lastFailure = failedSources.get(source.url);
            if (lastFailure && Date.now() - lastFailure < 10 * 60 * 1000) {
                skippedCount++;
                continue;
            }

            try {
                // Rate limiting: esperar 500ms entre requests
                if (successCount > 0) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                const feed = await parser.parseURL(source.url);

                feed.items.slice(0, source.limit).forEach(item => {
                    const bot = getBotForCategory(source.type);
                    const description = cleanDescription(item.contentSnippet || item.content || item.summary);

                    // Generar hash para deduplicación
                    const contentHash = generateContentHash(item.title, description);

                    // Skip si ya vimos este contenido
                    if (seenHashes.has(contentHash)) {
                        skippedCount++;
                        return;
                    }

                    // Calcular relevancia
                    const relevanceScore = calculateRelevanceScore(item, source.type);

                    // Generar hashtags dinámicos
                    const hashtags = generateHashtags(source.type, item.title);

                    seenHashes.add(contentHash);

                    newPosts.push({
                        id: `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        author: {
                            name: bot.username,
                            username: bot.handle,
                            avatar: bot.avatar,
                            verified: bot.verified,
                            isVIP: bot.isVIP
                        },
                        timestamp: new Date(item.pubDate || item.isoDate).toISOString(),
                        content: `📰 ${item.title}\n\n${description}${description.length >= 200 ? '...' : ''}`,
                        media: extractImage(item) ? [{
                            url: extractImage(item),
                            type: 'image'
                        }] : [],
                        stats: {
                            likes: Math.floor(Math.random() * 150) + 10,
                            comments: Math.floor(Math.random() * 30),
                            shares: Math.floor(Math.random() * 40),
                            views: Math.floor(Math.random() * 500) + 50
                        },
                        isVerified: true,
                        isNews: true,
                        newsSource: feed.title || 'News Feed',
                        externalLink: item.link,
                        hashtags,
                        contentHash,
                        relevanceScore,
                        sourceType: source.type
                    });
                });

                successCount++;
                failedSources.delete(source.url); // Remover de fallidos si ahora funciona
            } catch (err) {
                errorCount++;
                failedSources.set(source.url, Date.now()); // Marcar como fallido
                console.error(`❌ [RSS Error] ${source.url.substring(0, 50)}...:`, err.message);
            }
        }

        // 2. CryptoCompare API (Noticias de Crypto)
        try {
            const response = await axios.get('https://min-api.cryptocompare.com/data/v2/news/?lang=EN', {
                timeout: 8000
            });

            if (response.data && response.data.Data) {
                const apiNews = response.data.Data.slice(0, 6);

                apiNews.forEach(news => {
                    const bot = getBotForCategory('crypto');
                    const cleanBody = cleanDescription(news.body);
                    const hashtags = generateHashtags('crypto', news.title);

                    newPosts.push({
                        id: `cc_${news.id}`,
                        author: {
                            name: bot.username,
                            username: bot.handle,
                            avatar: bot.avatar,
                            verified: bot.verified,
                            isVIP: bot.isVIP
                        },
                        timestamp: new Date(news.published_on * 1000).toISOString(),
                        content: `🚨 ${news.title}\n\n${cleanBody}${cleanBody.length >= 200 ? '...' : ''}`,
                        media: news.imageurl ? [{
                            url: news.imageurl,
                            type: 'image'
                        }] : [],
                        stats: {
                            likes: Math.floor(Math.random() * 300) + 50,
                            comments: Math.floor(Math.random() * 60),
                            shares: Math.floor(Math.random() * 80),
                            views: Math.floor(Math.random() * 1000) + 100
                        },
                        isVerified: true,
                        isNews: true,
                        newsSource: news.source_info?.name || 'CryptoCompare',
                        externalLink: news.url,
                        hashtags
                    });
                });

                successCount++;
            }
        } catch (err) {
            errorCount++;
            console.error('❌ [CryptoCompare Error]:', err.message);
        }

        // 3. CoinGecko Trending (API pública)
        try {
            const response = await axios.get('https://api.coingecko.com/api/v3/search/trending', {
                timeout: 8000
            });

            if (response.data && response.data.coins) {
                const trending = response.data.coins.slice(0, 3);
                const bot = getBotForCategory('crypto');

                trending.forEach((coin, idx) => {
                    const coinData = coin.item;
                    newPosts.push({
                        id: `cg_trending_${coinData.id}_${Date.now()}`,
                        author: {
                            name: bot.username,
                            username: bot.handle,
                            avatar: bot.avatar,
                            verified: bot.verified,
                            isVIP: bot.isVIP
                        },
                        timestamp: new Date(Date.now() - idx * 60000).toISOString(),
                        content: `🔥 TRENDING: ${coinData.name} (${coinData.symbol})\n\nRank #${coinData.market_cap_rank || 'N/A'} | Score: ${coinData.score}\n\n${coinData.name} is currently trending on CoinGecko! 📈`,
                        media: coinData.large ? [{
                            url: coinData.large,
                            type: 'image'
                        }] : [],
                        stats: {
                            likes: Math.floor(Math.random() * 200) + 80,
                            comments: Math.floor(Math.random() * 40),
                            shares: Math.floor(Math.random() * 60),
                            views: Math.floor(Math.random() * 800) + 200
                        },
                        isVerified: true,
                        isNews: true,
                        newsSource: 'CoinGecko Trending',
                        externalLink: `https://www.coingecko.com/en/coins/${coinData.id}`,
                        hashtags: ['#Trending', '#Crypto', '#CoinGecko', `#${coinData.symbol}`, '#Markets']
                    });
                });

                successCount++;
            }
        } catch (err) {
            errorCount++;
            console.error('❌ [CoinGecko Error]:', err.message);
        }

        // Ordenar por relevancia y timestamp (híbrido)
        newPosts.sort((a, b) => {
            // Priorizar por relevancia primero
            const scoreDiff = (b.relevanceScore || 50) - (a.relevanceScore || 50);
            if (Math.abs(scoreDiff) > 15) return scoreDiff;

            // Si scores similares, por timestamp
            return new Date(b.timestamp) - new Date(a.timestamp);
        });    // Actualizar caché (mantener solo los últimos 80, top relevancia)
        newsPostsCache = [...newPosts, ...newsPostsCache]
            .filter((post, index, self) =>
                index === self.findIndex(p => p.id === post.id || p.contentHash === post.contentHash)
            )
            .slice(0, 150); // AUMENTADO: más posts en caché para 25+ fuentes

        // Limpiar hashes antiguos (mantener solo últimos 400)
        if (seenHashes.size > 400) {
            const hashArray = Array.from(seenHashes);
            seenHashes.clear();
            hashArray.slice(-300).forEach(h => seenHashes.add(h));
        }

        lastFetchTime = new Date();
        const elapsed = Date.now() - startTime;

        console.log(`✅ [News Aggregator] Completado en ${elapsed}ms`);
        console.log(`   📊 Posts nuevos: ${newPosts.length} | ⏭️  Duplicados saltados: ${skippedCount}`);
        console.log(`   💾 Caché total: ${newsPostsCache.length} posts`);
        console.log(`   ✅ Éxito: ${successCount} | ❌ Errores: ${errorCount} | 🔄 Sources en cooldown: ${failedSources.size}`);
        console.log(`   🎯 Avg relevance: ${(newPosts.reduce((sum, p) => sum + (p.relevanceScore || 0), 0) / newPosts.length || 0).toFixed(1)}`);

        return newsPostsCache;
    } catch (error) {
        console.error('🔥 [News Aggregator] Error crítico:', error.message);
        return newsPostsCache; // Retornar caché anterior en caso de error
    } finally {
        fetchInProgress = false;
    }
};// Función para obtener el caché actual
const getCachedNews = () => {
    return newsPostsCache;
};

// Función para obtener estadísticas
const getStats = () => {
    const avgRelevance = newsPostsCache.length > 0
        ? newsPostsCache.reduce((sum, p) => sum + (p.relevanceScore || 0), 0) / newsPostsCache.length
        : 0;

    return {
        totalPosts: newsPostsCache.length,
        lastUpdate: lastFetchTime,
        nextUpdate: lastFetchTime ? new Date(lastFetchTime.getTime() + 30 * 60 * 1000) : null,
        sources: Object.keys(RSS_FEEDS).length + 2,
        activeSources: (Object.keys(RSS_FEEDS).length + 2) - failedSources.size,
        failedSources: failedSources.size,
        bots: botProfiles.length,
        averageRelevance: avgRelevance.toFixed(1),
        uniqueHashes: seenHashes.size,
        fetchInProgress
    };
}; module.exports = {
    fetchNews,
    getCachedNews,
    getStats
};
