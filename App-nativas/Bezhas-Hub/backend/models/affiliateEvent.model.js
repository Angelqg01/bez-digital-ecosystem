const mongoose = require('mongoose');

const affiliateEventSchema = new mongoose.Schema({
  // The user who gets the credit for the event
  referrerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  
  // The new user who was referred (only for 'signup' events)
  referredId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    index: true
  }, 
  
  eventType: { 
    type: String, 
    enum: ['click', 'signup', 'rewardable_action'], 
    required: true 
  },
  
  // Source information for analytics and fraud detection
  ipAddress: { type: String },
  userAgent: { type: String },
  
  // Attribution details
  referralCodeUsed: { type: String, index: true },
  attributionWindowEnds: { type: Date }, // e.g., 30 days from the initial click
  
  // Reward processing status
  rewardStatus: { 
    type: String, 
    enum: ['pending', 'processed', 'failed', 'ineligible'], 
    default: 'pending' 
  },
  
  // Details sent to the rewards service for auditing
  rewardDetails: {
    transactionId: String, // ID from the rewards service
    amount: String,
    currency: { type: String, default: 'Bez-Coin' }
  }
}, { timestamps: true });

const AffiliateEvent = mongoose.model('AffiliateEvent', affiliateEventSchema);

module.exports = AffiliateEvent;
