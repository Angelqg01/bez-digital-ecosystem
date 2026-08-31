import axios from 'axios';

class PriceService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 60000; // 1 minute cache
    this.apiKeys = {
      coingecko: process.env.REACT_APP_COINGECKO_API_KEY || '',
      coinmarketcap: process.env.REACT_APP_COINMARKETCAP_API_KEY || '',
      cryptocompare: process.env.REACT_APP_CRYPTOCOMPARE_API_KEY || ''
    };
    this.baseUrls = {
      coingecko: 'https://api.coingecko.com/api/v3',
      coinmarketcap: 'https://pro-api.coinmarketcap.com/v1',
      cryptocompare: 'https://min-api.cryptocompare.com/data'
    };
  }

  // Check if cached data is still valid
  isCacheValid(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.cacheTimeout;
  }

  // Get cached data or null if invalid
  getCachedData(cacheKey) {
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }
    return null;
  }

  // Set cache data
  setCacheData(cacheKey, data) {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  // Get token price from CoinGecko
  async getPriceFromCoinGecko(tokenIds, vsCurrencies = ['usd']) {
    try {
      const cacheKey = `coingecko_${tokenIds.join(',')}_${vsCurrencies.join(',')}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const response = await axios.get(`${this.baseUrls.coingecko}/simple/price`, {
        params: {
          ids: tokenIds.join(','),
          vs_currencies: vsCurrencies.join(','),
          include_24hr_change: true,
          include_market_cap: true,
          include_24hr_vol: true
        },
        headers: this.apiKeys.coingecko ? {
          'X-CG-Demo-API-Key': this.apiKeys.coingecko
        } : {}
      });

      this.setCacheData(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('CoinGecko API error:', error);
      throw new Error('Failed to fetch price from CoinGecko');
    }
  }

  // Get token price from CoinMarketCap
  async getPriceFromCoinMarketCap(symbols, convert = 'USD') {
    try {
      const cacheKey = `coinmarketcap_${symbols.join(',')}_${convert}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      if (!this.apiKeys.coinmarketcap) {
        throw new Error('CoinMarketCap API key not configured');
      }

      const response = await axios.get(`${this.baseUrls.coinmarketcap}/cryptocurrency/quotes/latest`, {
        params: {
          symbol: symbols.join(','),
          convert: convert
        },
        headers: {
          'X-CMC_PRO_API_KEY': this.apiKeys.coinmarketcap
        }
      });

      this.setCacheData(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('CoinMarketCap API error:', error);
      throw new Error('Failed to fetch price from CoinMarketCap');
    }
  }

  // Get token price from CryptoCompare
  async getPriceFromCryptoCompare(fromSymbols, toSymbols = ['USD']) {
    try {
      const cacheKey = `cryptocompare_${fromSymbols.join(',')}_${toSymbols.join(',')}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const response = await axios.get(`${this.baseUrls.cryptocompare}/pricemultifull`, {
        params: {
          fsyms: fromSymbols.join(','),
          tsyms: toSymbols.join(',')
        },
        headers: this.apiKeys.cryptocompare ? {
          'Authorization': `Apikey ${this.apiKeys.cryptocompare}`
        } : {}
      });

      this.setCacheData(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('CryptoCompare API error:', error);
      throw new Error('Failed to fetch price from CryptoCompare');
    }
  }

  // Get aggregated price data from multiple sources
  async getAggregatedPrice(tokenSymbol, tokenId = null) {
    const results = {
      symbol: tokenSymbol,
      prices: {},
      average: 0,
      sources: []
    };

    try {
      // Try CoinGecko first (most reliable)
      if (tokenId) {
        try {
          const coingeckoData = await this.getPriceFromCoinGecko([tokenId]);
          if (coingeckoData[tokenId]) {
            results.prices.coingecko = {
              price: coingeckoData[tokenId].usd,
              change24h: coingeckoData[tokenId].usd_24h_change,
              marketCap: coingeckoData[tokenId].usd_market_cap,
              volume24h: coingeckoData[tokenId].usd_24h_vol
            };
            results.sources.push('coingecko');
          }
        } catch (error) {
          console.warn('CoinGecko failed:', error.message);
        }
      }

      // Try CryptoCompare
      try {
        const cryptoCompareData = await this.getPriceFromCryptoCompare([tokenSymbol]);
        if (cryptoCompareData.RAW && cryptoCompareData.RAW[tokenSymbol]) {
          const data = cryptoCompareData.RAW[tokenSymbol].USD;
          results.prices.cryptocompare = {
            price: data.PRICE,
            change24h: data.CHANGEPCT24HOUR,
            marketCap: data.MKTCAP,
            volume24h: data.VOLUME24HOURTO
          };
          results.sources.push('cryptocompare');
        }
      } catch (error) {
        console.warn('CryptoCompare failed:', error.message);
      }

      // Calculate average price
      const prices = Object.values(results.prices).map(p => p.price).filter(p => p > 0);
      if (prices.length > 0) {
        results.average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      }

      return results;
    } catch (error) {
      console.error('Error getting aggregated price:', error);
      throw error;
    }
  }

  // Get historical price data
  async getHistoricalPrices(tokenId, days = 7, interval = 'daily') {
    try {
      const cacheKey = `historical_${tokenId}_${days}_${interval}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const response = await axios.get(`${this.baseUrls.coingecko}/coins/${tokenId}/market_chart`, {
        params: {
          vs_currency: 'usd',
          days: days,
          interval: interval
        },
        headers: this.apiKeys.coingecko ? {
          'X-CG-Demo-API-Key': this.apiKeys.coingecko
        } : {}
      });

      const data = {
        prices: response.data.prices.map(([timestamp, price]) => ({
          timestamp: new Date(timestamp),
          price: price
        })),
        marketCaps: response.data.market_caps.map(([timestamp, cap]) => ({
          timestamp: new Date(timestamp),
          marketCap: cap
        })),
        volumes: response.data.total_volumes.map(([timestamp, volume]) => ({
          timestamp: new Date(timestamp),
          volume: volume
        }))
      };

      this.setCacheData(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error getting historical prices:', error);
      throw new Error('Failed to fetch historical prices');
    }
  }

  // Get trending tokens
  async getTrendingTokens() {
    try {
      const cacheKey = 'trending_tokens';
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const response = await axios.get(`${this.baseUrls.coingecko}/search/trending`, {
        headers: this.apiKeys.coingecko ? {
          'X-CG-Demo-API-Key': this.apiKeys.coingecko
        } : {}
      });

      this.setCacheData(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Error getting trending tokens:', error);
      throw new Error('Failed to fetch trending tokens');
    }
  }

  // Get market data for top tokens
  async getTopTokens(limit = 100, page = 1) {
    try {
      const cacheKey = `top_tokens_${limit}_${page}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const response = await axios.get(`${this.baseUrls.coingecko}/coins/markets`, {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: limit,
          page: page,
          sparkline: true,
          price_change_percentage: '1h,24h,7d'
        },
        headers: this.apiKeys.coingecko ? {
          'X-CG-Demo-API-Key': this.apiKeys.coingecko
        } : {}
      });

      this.setCacheData(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Error getting top tokens:', error);
      throw new Error('Failed to fetch top tokens');
    }
  }

  // Search for tokens
  async searchTokens(query) {
    try {
      const response = await axios.get(`${this.baseUrls.coingecko}/search`, {
        params: { query },
        headers: this.apiKeys.coingecko ? {
          'X-CG-Demo-API-Key': this.apiKeys.coingecko
        } : {}
      });

      return response.data;
    } catch (error) {
      console.error('Error searching tokens:', error);
      throw new Error('Failed to search tokens');
    }
  }

  // Get DeFi protocols data
  async getDeFiProtocols() {
    try {
      const cacheKey = 'defi_protocols';
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const response = await axios.get(`${this.baseUrls.coingecko}/coins/categories`, {
        headers: this.apiKeys.coingecko ? {
          'X-CG-Demo-API-Key': this.apiKeys.coingecko
        } : {}
      });

      const defiData = response.data.filter(category =>
        category.name.toLowerCase().includes('defi') ||
        category.name.toLowerCase().includes('decentralized')
      );

      this.setCacheData(cacheKey, defiData);
      return defiData;
    } catch (error) {
      console.error('Error getting DeFi protocols:', error);
      throw new Error('Failed to fetch DeFi protocols');
    }
  }

  // Get gas prices
  async getGasPrices() {
    try {
      const cacheKey = 'gas_prices';
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      // Using EthGasStation API alternative
      const response = await axios.get('https://api.etherscan.io/api', {
        params: {
          module: 'gastracker',
          action: 'gasoracle',
          apikey: process.env.REACT_APP_ETHERSCAN_API_KEY || 'YourApiKeyToken'
        }
      });

      if (response.data.status === '1') {
        const gasData = {
          slow: parseInt(response.data.result.SafeGasPrice),
          standard: parseInt(response.data.result.ProposeGasPrice),
          fast: parseInt(response.data.result.FastGasPrice),
          timestamp: Date.now()
        };

        this.setCacheData(cacheKey, gasData);
        return gasData;
      }

      throw new Error('Invalid gas price response');
    } catch (error) {
      console.error('Error getting gas prices:', error);
      // Return default values if API fails
      return {
        slow: 20,
        standard: 25,
        fast: 30,
        timestamp: Date.now()
      };
    }
  }

  // Get exchange rates for fiat currencies
  async getExchangeRates(baseCurrency = 'USD') {
    try {
      const cacheKey = `exchange_rates_${baseCurrency}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const response = await axios.get(`${this.baseUrls.coingecko}/exchange_rates`, {
        headers: this.apiKeys.coingecko ? {
          'X-CG-Demo-API-Key': this.apiKeys.coingecko
        } : {}
      });

      this.setCacheData(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Error getting exchange rates:', error);
      throw new Error('Failed to fetch exchange rates');
    }
  }

  // Format price with appropriate decimals
  formatPrice(price, currency = 'USD') {
    if (typeof price !== 'number' || isNaN(price)) return '0.00';

    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: price < 0.01 ? 6 : 2,
      maximumFractionDigits: price < 0.01 ? 6 : 2
    });

    return formatter.format(price);
  }

  // Format percentage change
  formatPercentage(percentage) {
    if (typeof percentage !== 'number' || isNaN(percentage)) return '0.00%';

    const formatted = percentage.toFixed(2);
    const sign = percentage >= 0 ? '+' : '';
    return `${sign}${formatted}%`;
  }

  // Format market cap
  formatMarketCap(marketCap) {
    if (typeof marketCap !== 'number' || isNaN(marketCap)) return '$0';

    if (marketCap >= 1e12) {
      return `$${(marketCap / 1e12).toFixed(2)}T`;
    } else if (marketCap >= 1e9) {
      return `$${(marketCap / 1e9).toFixed(2)}B`;
    } else if (marketCap >= 1e6) {
      return `$${(marketCap / 1e6).toFixed(2)}M`;
    } else if (marketCap >= 1e3) {
      return `$${(marketCap / 1e3).toFixed(2)}K`;
    } else {
      return `$${marketCap.toFixed(2)}`;
    }
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }

  // Get cache stats
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  // ============================================
  // BEZ-Coin Specific Methods
  // ============================================

  /**
   * Get BEZ price from backend QuickSwap Oracle
   * @returns {Promise<Object>} Price data from oracle
   */
  async getBezPriceFromOracle() {
    try {
      const cacheKey = 'bez_oracle_price';
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await axios.get(`${apiUrl}/api/fiat/price-info`);

      if (response.data?.success) {
        const priceData = response.data.priceInfo;
        this.setCacheData(cacheKey, priceData);
        return priceData;
      }

      throw new Error('Invalid oracle response');
    } catch (error) {
      console.warn('Failed to fetch from oracle, using fallback:', error.message);
      return null;
    }
  }

  /**
   * Get BEZ token price in specified currency
   * Uses QuickSwap LP Pool oracle as primary source
   * @param {string} currency - Currency code (EUR, USD, etc.)
   * @returns {Promise<number>} Price of 1 BEZ in the currency
   */
  async getBezPrice(currency = 'EUR') {
    try {
      const cacheKey = `bez_price_${currency}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      // ============================================
      // PRIMARY: QuickSwap Oracle (Backend)
      // ============================================
      // Fallback prices based on LP pool (0.00075 USD)
      const FALLBACK_PRICE_USD = 0.00075;
      const EUR_USD_RATE = 1.08;

      const fallbackPrices = {
        USD: FALLBACK_PRICE_USD,
        EUR: FALLBACK_PRICE_USD / EUR_USD_RATE,
        GBP: FALLBACK_PRICE_USD / 1.27,
        BTC: FALLBACK_PRICE_USD / 42000,
        ETH: FALLBACK_PRICE_USD / 2500
      };

      // Try to get from backend oracle
      try {
        const oracleData = await this.getBezPriceFromOracle();
        if (oracleData?.prices) {
          let price;
          if (currency === 'USD') {
            price = oracleData.prices.bezUsd;
          } else if (currency === 'EUR') {
            price = oracleData.prices.bezEur;
          } else {
            // Convert from USD
            const usdPrice = oracleData.prices.bezUsd;
            const conversionRate = fallbackPrices[currency] / FALLBACK_PRICE_USD;
            price = usdPrice * conversionRate;
          }

          if (price && price > 0) {
            this.setCacheData(cacheKey, price);
            console.log(`[PriceService] BEZ/${currency} from Oracle: ${price}`);
            return price;
          }
        }
      } catch (oracleError) {
        console.warn('[PriceService] Oracle unavailable:', oracleError.message);
      }

      // FALLBACK: Use configured prices
      const price = fallbackPrices[currency] || fallbackPrices.USD;
      console.warn(`[PriceService] Using fallback BEZ/${currency}: ${price}`);
      this.setCacheData(cacheKey, price);
      return price;

    } catch (error) {
      console.error('Error fetching BEZ price:', error);
      // Final fallback based on LP pool price (0.00075 USD)
      const fallback = {
        EUR: 0.00070,
        USD: 0.00075,
        GBP: 0.00060
      };
      return fallback[currency] || 0.00075;
    }
  }

  /**
   * Calculate BEZ equivalent for a fiat amount
   * @param {number} fiatAmount - Amount in fiat currency
   * @param {string} currency - Currency code
   * @returns {Promise<number>} Amount of BEZ tokens needed
   */
  async calculateBezEquivalent(fiatAmount, currency = 'EUR') {
    const bezPrice = await this.getBezPrice(currency);
    return fiatAmount / bezPrice;
  }

  /**
   * Convert BEZ amount to fiat currency
   * @param {number} bezAmount - Amount of BEZ tokens
   * @param {string} currency - Currency code
   * @returns {Promise<number>} Value in fiat currency
   */
  async convertBezToFiat(bezAmount, currency = 'EUR') {
    const bezPrice = await this.getBezPrice(currency);
    return bezAmount * bezPrice;
  }

  /**
   * Get vendor fee in BEZ tokens (50€ equivalent)
   * @returns {Promise<Object>} Vendor fee details
   */
  async getVendorFeeDetails() {
    const feeInEur = 50;
    const [bezEquivalent, bezPriceEur, bezPriceUsd] = await Promise.all([
      this.calculateBezEquivalent(feeInEur, 'EUR'),
      this.getBezPrice('EUR'),
      this.getBezPrice('USD')
    ]);

    return {
      eurAmount: feeInEur,
      bezAmount: bezEquivalent,
      bezPriceEur: bezPriceEur,
      bezPriceUsd: bezPriceUsd,
      usdEquivalent: feeInEur / bezPriceEur * bezPriceUsd
    };
  }

  /**
   * Get complete price information including oracle source
   * @returns {Promise<Object>} Complete price info
   */
  async getCompletePriceInfo() {
    const [oracleData, bezPriceEur, bezPriceUsd] = await Promise.all([
      this.getBezPriceFromOracle(),
      this.getBezPrice('EUR'),
      this.getBezPrice('USD')
    ]);

    return {
      prices: {
        bezEur: bezPriceEur,
        bezUsd: bezPriceUsd
      },
      oracle: oracleData ? {
        source: oracleData.cache?.source || 'backend',
        poolAddress: oracleData.config?.pool,
        lastUpdate: oracleData.cache?.timestamp,
        isValid: oracleData.cache?.isValid
      } : null,
      tokenomics: oracleData?.tokenomics || null
    };
  }
}

// Create singleton instance
const priceService = new PriceService();

export default priceService;
