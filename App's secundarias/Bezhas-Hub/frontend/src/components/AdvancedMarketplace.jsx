import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import DOMPurify from 'dompurify';

const AdvancedMarketplace = ({ 
  contract, 
  nftContract,
  tokenContract,
  userAddress 
}) => {
  const [listings, setListings] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('browse');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [userNFTs, setUserNFTs] = useState([]);
  
  // Form states
  const [listingForm, setListingForm] = useState({
    tokenId: '',
    price: '',
    categoryId: 1,
    duration: 7,
    title: '',
    description: '',
    tags: ''
  });

  const handleListingFormChange = (field, value) => {
    const sanitizedValue = typeof value === 'string' ? DOMPurify.sanitize(value) : value;
    setListingForm(prev => ({ ...prev, [field]: sanitizedValue }));
  };

  const handlePriceRangeChange = (field, value) => {
    const sanitizedValue = DOMPurify.sanitize(value);
    setPriceRange(prev => ({ ...prev, [field]: sanitizedValue }));
  };

  const loadCategories = useCallback(async () => {
    try {
      const categoryNames = ['Art', 'Gaming', 'Music', 'Sports', 'Collectibles', 'Utility'];
      const categoryData = categoryNames.map((name, index) => ({
        id: index + 1,
        name,
        description: `${name} NFTs`,
        itemCount: 0
      }));
      setCategories(categoryData);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }, []);

  const loadListings = useCallback(async () => {
    try {
      const mockListings = [
        {
          id: 1,
          tokenId: 1,
          seller: '0x1234567890123456789012345678901234567890',
          price: '0.5',
          categoryId: 1,
          status: 'ACTIVE',
          createdAt: Date.now() / 1000,
          expiresAt: (Date.now() / 1000) + (7 * 24 * 3600),
          title: 'Digital Art #1',
          description: 'Beautiful digital artwork',
          tags: ['art', 'digital', 'collectible'],
          views: 42,
          favorites: 12
        }
      ];
      setListings(mockListings);
    } catch (error) {
      console.error('Error loading listings:', error);
    }
  }, []);

  const loadAuctions = useCallback(async () => {
    try {
      const mockAuctions = [
        {
          id: 1,
          tokenId: 2,
          seller: '0x1234567890123456789012345678901234567890',
          startingPrice: '0.1',
          reservePrice: '0.5',
          currentBid: '0.3',
          currentBidder: '0x9876543210987654321098765432109876543210',
          categoryId: 1,
          startTime: Date.now() / 1000,
          endTime: (Date.now() / 1000) + (3 * 24 * 3600),
          status: 'ACTIVE',
          bidCount: 5
        }
      ];
      setAuctions(mockAuctions);
    } catch (error) {
      console.error('Error loading auctions:', error);
    }
  }, []);

  const loadUserNFTs = useCallback(async () => {
    try {
      if (!nftContract || !userAddress) return;

      const mockNFTs = [
        { tokenId: 1, tokenURI: '', isListed: false },
        { tokenId: 2, tokenURI: '', isListed: false }
      ];
      setUserNFTs(mockNFTs);
    } catch (error) {
      console.error('Error loading user NFTs:', error);
    }
  }, [nftContract, userAddress]);

  const loadMarketplaceData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCategories(),
        loadListings(),
        loadAuctions()
      ]);
    } catch (error) {
      console.error('Error loading marketplace data:', error);
    } finally {
      setLoading(false);
    }
  }, [loadCategories, loadListings, loadAuctions]);

  useEffect(() => {
    if (contract && userAddress) {
      loadMarketplaceData();
      loadUserNFTs();
    }
  }, [contract, userAddress, loadMarketplaceData, loadUserNFTs]);

  const listItem = async () => {
    if (!contract || !listingForm.tokenId || !listingForm.price) return;

    setLoading(true);
    try {
      const price = ethers.utils.parseEther(listingForm.price);
      const duration = listingForm.duration * 24 * 3600;
      const tags = listingForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag);

      const tx = await contract.listItem(
        nftContract.address,
        listingForm.tokenId,
        price,
        listingForm.categoryId,
        duration,
        listingForm.title,
        listingForm.description,
        tags
      );
      await tx.wait();

      await loadListings();
      setListingForm({
        tokenId: '',
        price: '',
        categoryId: 1,
        duration: 7,
        title: '',
        description: '',
        tags: ''
      });
    } catch (error) {
      console.error('Error listing item:', error);
    } finally {
      setLoading(false);
    }
  };

  const buyItem = async (listingId) => {
    if (!contract || !tokenContract) return;

    setLoading(true);
    try {
      const listing = listings.find(l => l.id === listingId);
      if (!listing) return;

      const price = ethers.utils.parseEther(listing.price);
      
      const allowance = await tokenContract.allowance(userAddress, contract.address);
      if (allowance.lt(price)) {
        const approveTx = await tokenContract.approve(contract.address, price);
        await approveTx.wait();
      }

      const tx = await contract.buyItem(listingId);
      await tx.wait();

      await loadListings();
    } catch (error) {
      console.error('Error buying item:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterListings = () => {
    let filtered = [...listings];

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(listing => listing.categoryId === parseInt(selectedCategory));
    }

    if (searchQuery) {
      filtered = filtered.filter(listing => 
        listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (priceRange.min) {
      filtered = filtered.filter(listing => parseFloat(listing.price) >= parseFloat(priceRange.min));
    }
    if (priceRange.max) {
      filtered = filtered.filter(listing => parseFloat(listing.price) <= parseFloat(priceRange.max));
    }

    return filtered;
  };

  const formatTimeRemaining = (timestamp) => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = timestamp - now;
    
    if (remaining <= 0) return 'Expired';
    
    const days = Math.floor(remaining / (24 * 3600));
    const hours = Math.floor((remaining % (24 * 3600)) / 3600);
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown';
  };

  return (
    <div className="advanced-marketplace">
      <div className="marketplace-header">
        <h2>NFT Marketplace</h2>
        <div className="marketplace-stats">
          <div className="stat-item">
            <span className="stat-number">{listings.length}</span>
            <span className="stat-label">Active Listings</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{auctions.length}</span>
            <span className="stat-label">Live Auctions</span>
          </div>
        </div>
      </div>

      <div className="marketplace-tabs">
        <button
          className={`tab-btn ${activeTab === 'browse' ? 'active' : ''}`}
          onClick={() => setActiveTab('browse')}
        >
          Browse
        </button>
        <button
          className={`tab-btn ${activeTab === 'auctions' ? 'active' : ''}`}
          onClick={() => setActiveTab('auctions')}
        >
          Auctions
        </button>
        <button
          className={`tab-btn ${activeTab === 'sell' ? 'active' : ''}`}
          onClick={() => setActiveTab('sell')}
        >
          Sell NFT
        </button>
      </div>

      {(activeTab === 'browse' || activeTab === 'auctions') && (
        <div className="marketplace-filters">
          <div className="search-section">
            <input
              type="text"
              placeholder="Search NFTs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(DOMPurify.sanitize(e.target.value))}
              className="search-input"
            />
            <button
              className="filter-toggle"
              onClick={() => setShowFilters(!showFilters)}
            >
              🔍 Filters
            </button>
          </div>

          {showFilters && (
            <div className="filters-panel">
              <div className="filter-group">
                <label>Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Price Range (ETH)</label>
                <div className="price-range">
                  <input
                    type="number"
                    placeholder="Min"
                    value={priceRange.min}
                    onChange={(e) => handlePriceRangeChange('min', e.target.value)}
                  />
                  <span>to</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={priceRange.max}
                    onChange={(e) => handlePriceRangeChange('max', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="marketplace-content">
        {loading && (
          <div className="loading-overlay">
            <p>Loading...</p>
          </div>
        )}

        {activeTab === 'browse' && (
          <div className="listings-grid">
            {filterListings().map(listing => (
              <div key={listing.id} className="nft-card">
                <div className="nft-image">
                  <div className="placeholder-image">NFT #{listing.tokenId}</div>
                  <div className="nft-category">{getCategoryName(listing.categoryId)}</div>
                </div>
                
                <div className="nft-info">
                  <h3>{listing.title}</h3>
                  <p className="nft-description">{listing.description}</p>
                  
                  <div className="nft-stats">
                    <span>👁️ {listing.views}</span>
                    <span>❤️ {listing.favorites}</span>
                    <span>⏰ {formatTimeRemaining(listing.expiresAt)}</span>
                  </div>
                  
                  <div className="nft-price">
                    <span className="price">{listing.price} ETH</span>
                    <span className="seller">by {listing.seller.slice(0, 6)}...</span>
                  </div>
                  
                  <div className="nft-actions">
                    <button
                      className="buy-btn"
                      onClick={() => buyItem(listing.id)}
                      disabled={listing.seller === userAddress}
                    >
                      {listing.seller === userAddress ? 'Your Item' : 'Buy Now'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'sell' && (
          <div className="sell-section">
            <div className="sell-form">
              <h3>List NFT for Sale</h3>
              
              <div className="form-group">
                <label>Select NFT</label>
                <select
                  value={listingForm.tokenId}
                  onChange={(e) => handleListingFormChange('tokenId', e.target.value)}
                >
                  <option value="">Select an NFT</option>
                  {userNFTs.map(nft => (
                    <option key={nft.tokenId} value={nft.tokenId}>
                      NFT #{nft.tokenId}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Price (ETH)</label>
                <input
                  type="number"
                  step="0.001"
                  value={listingForm.price}
                  onChange={(e) => handleListingFormChange('price', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={listingForm.title}
                  onChange={(e) => handleListingFormChange('title', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={listingForm.description}
                  onChange={(e) => handleListingFormChange('description', e.target.value)}
                />
              </div>

              <button
                className="list-btn"
                onClick={listItem}
                disabled={!listingForm.tokenId || !listingForm.price || !listingForm.title}
              >
                List for Sale
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedMarketplace;
