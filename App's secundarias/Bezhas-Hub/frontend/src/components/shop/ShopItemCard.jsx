import React, { memo } from 'react';
import Card from '../ui/Card';
import { Star, User } from 'lucide-react';
import './ShopComponents.css';

const ShopItemCard = ({ item, onClick }) => {
  return (
    <Card className="shop-item-card" onClick={onClick}>
      <div className="item-image-container">
        <img src={item.image} alt={item.name} className="item-image" />
        <div className="item-price-badge">
          {item.price} BEZ
        </div>
      </div>
      
      <div className="item-info">
        <h3 className="item-title">{item.name}</h3>
        <p className="item-description">{item.description}</p>
        
        <div className="item-meta">
          <div className="item-seller">
            <User size={14} />
            <span>{item.seller}</span>
          </div>
          <div className="item-rating">
            <Star size={14} fill="currentColor" />
            <span>{item.rating}</span>
            <span className="sales-count">({item.sales} ventas)</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default memo(ShopItemCard);
