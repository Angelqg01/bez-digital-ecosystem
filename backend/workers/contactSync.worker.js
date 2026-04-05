const User = require('../models/user.model');
const Contact = require('../models/contact.model');

/**
 * Process a batch of hashed contacts for a specific user.
 * 
 * @param {Object} job - The BullMQ job object
 * @param {Object} job.data - The data passed to the queue
 * @param {string} job.data.userId - The ID of the user owning the contacts
 * @param {Array} job.data.contacts - The array of sanitized contact hashes
 */
async function processContactSync(job) {
  const { userId, contacts } = job.data;
  
  try {
    const ownerId = userId;
    
    // Process each contact individually or in batches
    for (const contactData of contacts) {
      const { emailHash, phoneHash, encryptedData } = contactData;
      
      // 1. Search for matching User in our system using the hashes.
      let matchedUser = null;
      
      if (emailHash || phoneHash) {
        const query = {
          $or: []
        };
        
        if (emailHash) query.$or.push({ emailHash });
        if (phoneHash) query.$or.push({ phoneHash });

        matchedUser = await User.findOne(query).select('_id');
      }
      
      // 2. Determine match status
      let status = 'pending';
      let matchedUserId = undefined;

      if (matchedUser) {
        status = 'is_user';
        matchedUserId = matchedUser._id;
        
        // Ensure you don't match the user with themselves
        if (matchedUserId.toString() === ownerId.toString()) {
            continue; // Skip their own contact
        }
      }

      // 3. Upsert the Contact record for the specific owner
      // We search by either emailHash or phoneHash within the owner's contacts
      const matchCriteria = { ownerId };
      if (emailHash && phoneHash) {
          matchCriteria.$or = [{ emailHash }, { phoneHash }];
      } else if (emailHash) {
          matchCriteria.emailHash = emailHash;
      } else {
          matchCriteria.phoneHash = phoneHash;
      }

      await Contact.findOneAndUpdate(
        matchCriteria, 
        {
          ownerId,
          emailHash,
          phoneHash,
          encryptedData: encryptedData || 'encrypted_stub', // Fallback for testing/stubbing
          status,
          matchedUserId
        },
        { upsert: true, new: true } // Create if doesn't exist, update if it does
      );
    }

    // Mark that the user has performed a sync recently (optional analytics step)
    await User.findByIdAndUpdate(ownerId, {
      $set: { 'contactSync.hasSynced': true, 'contactSync.lastSync': new Date() }
    });

    console.log(`[Queue] Successfully synced ${contacts.length} contacts for user ${ownerId}`);

  } catch (error) {
    console.error(`[Queue] Error syncing contacts for user ${userId}:`, error);
    throw error; // Re-throw to allow BullMQ to handle retries
  }
}

module.exports = {
  processContactSync
};
