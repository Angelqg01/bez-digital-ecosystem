/**
 * BeZhas SDK - Contacts & Social Discovery Module
 * 
 * Provides methods for developers to integrate BeZhas Contact Synchronization
 * into their own applications (Wallets, dApps, Social platforms).
 */

class ContactsModule {
    /**
     * @param {Object} sdkInstance - The main BeZhas SDK instance
     */
    constructor(sdkInstance) {
        this.sdk = sdkInstance;
        this.baseUrl = this.sdk.config.apiUrl || 'https://api.bezhas.com/api';
    }

    /**
     * Helper to get headers for API calls
     */
    async _getHeaders() {
        // Assume SDK handles auth via config (API Key or JWT)
        const headers = {
            'Content-Type': 'application/json',
            ...(this.sdk.config.apiKey && { 'x-api-key': this.sdk.config.apiKey }),
            ...(this.sdk.config.token && { 'Authorization': `Bearer ${this.sdk.config.token}` })
        };
        return headers;
    }

    /**
     * Synchronize a list of hashed contacts
     * NOTE: Contacts must be hashed locally using SHA-256 before being passed to this method
     * to comply with BeZhas Privacy Policies.
     * 
     * @param {Array<{name: string, emailHash?: string, phoneHash?: string}>} contacts 
     * @returns {Promise<Object>} Response confirming queue
     */
    async syncContacts(contacts) {
        if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
            throw new Error('[BeZhas SDK] Contacts array is empty or invalid.');
        }

        const headers = await this._getHeaders();
        const response = await fetch(`${this.baseUrl}/contacts/sync`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ contacts })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`[BeZhas SDK] Failed to sync contacts: ${errorData.error || response.statusText}`);
        }

        return await response.json(); // { message: "..." }
    }

    /**
     * Get the authenticated user's matched contacts on the BeZhas network
     * 
     * @returns {Promise<Array>} Array of matched contacts
     */
    async getMatches() {
        const headers = await this._getHeaders();
        const response = await fetch(`${this.baseUrl}/contacts/matches`, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`[BeZhas SDK] Failed to get matches: ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        return data.matches || [];
    }

    /**
     * Send a friend request to a matched contact and claim the 50 BEZ-Coin reward
     * 
     * @param {string} contactId - The internal ID of the matched Contact record
     * @returns {Promise<Object>} Response confirming the reward
     */
    async addFriend(contactId) {
        if (!contactId) {
            throw new Error('[BeZhas SDK] contactId is required.');
        }

        const headers = await this._getHeaders();
        const response = await fetch(`${this.baseUrl}/contacts/${contactId}/add-friend`, {
            method: 'POST',
            headers
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`[BeZhas SDK] Failed to add friend: ${errorData.error || response.statusText}`);
        }

        return await response.json();
    }
}

module.exports = ContactsModule;
