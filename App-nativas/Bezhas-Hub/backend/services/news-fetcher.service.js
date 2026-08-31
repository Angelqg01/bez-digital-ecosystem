const axios = require('axios');

/**
 * Fetches crypto news from CryptoCompare API
 * @returns {Promise<Array>} Array of normalized news items
 */
async function fetchCryptoNews() {
    try {
        console.log("🔄 Fetching crypto news...");
        const response = await axios.get('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
        const newsData = response.data.Data;

        if (!newsData || !Array.isArray(newsData)) {
            console.error("❌ Invalid data format from CryptoCompare");
            return [];
        }

        // Normalize data
        return newsData.slice(0, 10).map(item => ({
            title: item.title,
            content: item.body,
            imageUrl: item.imageurl,
            externalUrl: item.url,
            source: item.source,
            publishedAt: item.published_on * 1000, // Convert to ms
            category: 'crypto'
        }));

    } catch (error) {
        console.error("❌ Error fetching news:", error.message);
        return [];
    }
}

module.exports = { fetchCryptoNews };
