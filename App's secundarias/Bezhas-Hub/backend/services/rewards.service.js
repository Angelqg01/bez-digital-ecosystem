const axios = require('axios');

// A dedicated service to communicate with the internal rewards microservice.

const rewardsApiClient = axios.create({
  baseURL: process.env.REWARDS_SERVICE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.REWARDS_SERVICE_API_KEY
  },
  timeout: 5000 // 5-second timeout for API calls
});

/**
 * Grants a reward for a new user registration through a referral.
 * @param {string} referrerId - The ID of the user who referred.
 * @param {string} referredId - The ID of the new user who was referred.
 * @param {string} eventType - The type of event, e.g., 'USER_SIGNUP'.
 * @returns {Promise<object>} The response from the rewards service.
 */
const grantReferralReward = async (referrerId, referredId, eventType) => {
  if (!process.env.REWARDS_SERVICE_URL || !process.env.REWARDS_SERVICE_API_KEY) {
    // In a real production environment, you might want to queue this and retry later.
    // For now, we log a warning if the service isn't configured.
    console.warn('Rewards service is not configured. Skipping reward grant.');
    return { status: 'skipped', reason: 'Rewards service not configured.' };
  }

  try {
    const payload = {
      recipientId: referrerId,
      eventType,
      source: 'affiliate_program',
      metadata: {
        referredUserId: referredId
      }
    };

    const response = await rewardsApiClient.post('/grant', payload);
    return response.data;

  } catch (error) {
    // Log the error and re-throw or handle it as needed
    const errorInfo = error.response ? error.response.data : error.message;
    console.error('Error granting reward:', errorInfo);
    throw new Error('Failed to grant reward due to an issue with the rewards service.');
  }
};

/**
 * Grants a reward for a user's first successful contact synchronization.
 * @param {string} userId - The ID of the user to be rewarded.
 * @param {number} contactCount - The number of contacts synced.
 * @returns {Promise<object>} The response from the rewards service.
 */
const grantContactSyncReward = async (userId, contactCount) => {
  if (!process.env.REWARDS_SERVICE_URL || !process.env.REWARDS_SERVICE_API_KEY) {
    console.warn('Rewards service is not configured. Skipping contact sync reward.');
    return { status: 'skipped', reason: 'Rewards service not configured.' };
  }

  try {
    const payload = {
      recipientId: userId,
      eventType: 'CONTACT_SYNC_COMPLETED',
      source: 'contact_sync_program',
      metadata: {
        syncedContacts: contactCount
      }
    };

    const response = await rewardsApiClient.post('/grant', payload);
    return response.data;

  } catch (error) {
    const errorInfo = error.response ? error.response.data : error.message;
    console.error('Error granting contact sync reward:', errorInfo);
    throw new Error('Failed to grant contact sync reward.');
  }
};

module.exports = {
  grantReferralReward,
  grantContactSyncReward
};
