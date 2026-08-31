import { API_BASE } from './api';

// Optimized JSON parser with error handling
const json = async (res) => {
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }

    const text = await res.text();
    if (!text) {
        return null; // Handle empty responses
    }

    try {
        return JSON.parse(text);
    } catch (e) {
        console.error('Failed to parse JSON:', text);
        throw new Error('Invalid JSON response from server');
    }
};

// Quests
export const fetchQuests = async () => fetch(`${API_BASE}/api/quests`).then(json).catch(err => {
    console.error('fetchQuests error:', err);
    return []; // Return empty array as fallback
});

export const fetchQuestProgress = async (wallet) => fetch(`${API_BASE}/api/quests/progress/${wallet}`).then(json).catch(err => {
    console.error('fetchQuestProgress error:', err);
    return [];
});

export const updateQuestProgress = async (payload) => fetch(`${API_BASE}/api/quests/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
}).then(json);

export const completeQuest = async (payload) => fetch(`${API_BASE}/api/quests/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
}).then(json);

// Badges
export const fetchBadges = async () => fetch(`${API_BASE}/api/badges`).then(json).catch(err => {
    console.error('fetchBadges error:', err);
    return [];
});

export const fetchUserBadges = async (wallet) => fetch(`${API_BASE}/api/badges/user/${wallet}`).then(json).catch(err => {
    console.error('fetchUserBadges error:', err);
    return [];
});

export const updateUserStats = async (payload) => fetch(`${API_BASE}/api/badges/stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
}).then(json);

// Groups
export const fetchGroups = async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const suffix = q ? `?${q}` : '';
    return fetch(`${API_BASE}/api/groups${suffix}`).then(json).catch(err => {
        console.error('fetchGroups error:', err);
        return [];
    });
};

export const joinGroup = async (id, walletAddress) => fetch(`${API_BASE}/api/groups/${id}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress })
}).then(json);

export const leaveGroup = async (id, walletAddress) => fetch(`${API_BASE}/api/groups/${id}/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress })
}).then(json);

export const createGroup = async (payload) => fetch(`${API_BASE}/api/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
}).then(json);

// Marketplace (backend fallback)
export const fetchBackendListings = async () => fetch(`${API_BASE}/api/marketplace/listings`).then(json).catch(err => {
    console.error('fetchBackendListings error:', err);
    return [];
});