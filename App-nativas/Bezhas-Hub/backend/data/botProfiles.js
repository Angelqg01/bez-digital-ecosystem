/**
 * Bot Profiles para News Aggregator
 * Estos usuarios "publicarán" las noticias automáticamente
 */

const botProfiles = [
  {
    id: "bot_crypto_daily",
    username: "Crypto Daily",
    handle: "@cryptodaily",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=CryptoDaily",
    sourceType: "crypto",
    bio: "Your daily dose of crypto news 🚀",
    verified: true,
    isVIP: true
  },
  {
    id: "bot_market_watch",
    username: "Market Watcher",
    handle: "@marketwatch",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Market",
    sourceType: "finance",
    bio: "Tracking global markets 24/7 📈",
    verified: true,
    isVIP: true
  },
  {
    id: "bot_tech_trends",
    username: "Tech Trends",
    handle: "@techtrends",
    avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=Tech",
    sourceType: "tech",
    bio: "Latest in tech and innovation 💡",
    verified: true,
    isVIP: false
  },
  {
    id: "bot_defi_pulse",
    username: "DeFi Pulse",
    handle: "@defipulse",
    avatar: "https://api.dicebear.com/7.x/shapes/svg?seed=DeFi",
    sourceType: "crypto",
    bio: "Decentralized Finance updates 🏦",
    verified: true,
    isVIP: true
  },
  {
    id: "bot_blockchain_news",
    username: "Blockchain Insider",
    handle: "@blockchaininsider",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Blockchain",
    sourceType: "crypto",
    bio: "Breaking blockchain news & analysis 🔗",
    verified: true,
    isVIP: true
  },
  {
    id: "bot_web3_today",
    username: "Web3 Today",
    handle: "@web3today",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Web3",
    sourceType: "tech",
    bio: "Your Web3 daily digest 🌐",
    verified: true,
    isVIP: false
  },
  {
    id: "bot_nft_tracker",
    username: "NFT Tracker",
    handle: "@nfttracker",
    avatar: "https://api.dicebear.com/7.x/shapes/svg?seed=NFT",
    sourceType: "crypto",
    bio: "Latest NFT trends & drops 🎨",
    verified: true,
    isVIP: true
  },
  {
    id: "bot_finance_live",
    username: "Finance Live",
    handle: "@financelive",
    avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=Finance",
    sourceType: "finance",
    bio: "Real-time financial news 💰",
    verified: true,
    isVIP: true
  }
];

module.exports = botProfiles;
