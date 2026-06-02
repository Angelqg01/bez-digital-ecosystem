const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  // Link to the user who uploaded this contact
  ownerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  
  // We use hashes of personal data to find matches without storing raw PII in a queryable format.
  phoneHash: { type: String, index: true }, 
  emailHash: { type: String, index: true },
  
  // The original contact data is encrypted for use in consented marketing campaigns.
  // This ensures data at rest is not human-readable.
  encryptedData: { 
    type: String, 
    required: true 
  },
  
  status: { 
    type: String, 
    enum: ['pending', 'is_user', 'invited'], 
    default: 'pending' 
  },
  
  // If a match is found, we store the user ID for easy linking.
  matchedUserId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }
}, { timestamps: true });

// Compound index to optimize queries for finding a specific contact for a specific owner
contactSchema.index({ ownerId: 1, emailHash: 1 });
contactSchema.index({ ownerId: 1, phoneHash: 1 });

const Contact = mongoose.model('Contact', contactSchema);

module.exports = Contact;
