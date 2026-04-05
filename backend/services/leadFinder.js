const axios = require('axios');

const MCP_BASE = process.env.MCP_SERVER_URL || 'http://localhost:8080';

/**
 * Lead Finder Service
 * Uses Firecrawl MCP to discover leads from LinkedIn, company pages, and social media.
 */

/**
 * Search for leads on LinkedIn/web using Firecrawl scraping
 * @param {Object} opts - Search options
 * @param {string} opts.query - Search query (e.g., "AI startup founders Barcelona")
 * @param {string} opts.platform - Platform to search (linkedin, twitter, web)
 * @param {number} opts.maxResults - Max results to return
 * @param {Object} opts.filters - Additional filters (industry, location, role)
 */
async function findLeads({ query, platform = 'linkedin', maxResults = 20, filters = {} }) {
    const searchUrls = buildSearchUrls(query, platform, filters);
    const results = [];

    for (const url of searchUrls) {
        try {
            const res = await axios.post(`${MCP_BASE}/api/mcp/firecrawl`, {
                action: 'scrape_page',
                url,
                extractSchema: {
                    type: 'object',
                    properties: {
                        profiles: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    title: { type: 'string' },
                                    company: { type: 'string' },
                                    location: { type: 'string' },
                                    profileUrl: { type: 'string' },
                                    email: { type: 'string' },
                                    bio: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            }, { timeout: 30000 });

            if (res.data?.profiles) {
                results.push(...res.data.profiles);
            } else if (res.data?.data?.profiles) {
                results.push(...res.data.data.profiles);
            }
        } catch (err) {
            console.warn(`⚠️ LeadFinder: Failed to scrape ${url}: ${err.message}`);
        }

        if (results.length >= maxResults) break;
    }

    // Deduplicate by name+company
    const seen = new Set();
    const unique = results.filter(lead => {
        const key = `${lead.name?.toLowerCase()}-${lead.company?.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return {
        leads: unique.slice(0, maxResults),
        total: unique.length,
        query,
        platform,
        scrapedAt: new Date().toISOString(),
    };
}

/**
 * Build search URLs for different platforms
 */
function buildSearchUrls(query, platform, filters) {
    const encodedQuery = encodeURIComponent(query);
    const urls = [];

    switch (platform) {
        case 'linkedin':
            urls.push(`https://www.google.com/search?q=site:linkedin.com/in+${encodedQuery}`);
            if (filters.company) {
                urls.push(`https://www.google.com/search?q=site:linkedin.com/in+${encodedQuery}+"${encodeURIComponent(filters.company)}"`);
            }
            break;
        case 'twitter':
            urls.push(`https://www.google.com/search?q=site:twitter.com+${encodedQuery}`);
            break;
        case 'web':
        default:
            urls.push(`https://www.google.com/search?q=${encodedQuery}+contact+email`);
            if (filters.industry) {
                urls.push(`https://www.google.com/search?q=${encodedQuery}+${encodeURIComponent(filters.industry)}+founder+CEO`);
            }
            break;
    }

    return urls;
}

/**
 * Enrich a lead with additional information
 */
async function enrichLead(lead) {
    if (!lead.profileUrl) return lead;

    try {
        const res = await axios.post(`${MCP_BASE}/api/mcp/firecrawl`, {
            action: 'scrape_page',
            url: lead.profileUrl,
            extractSchema: {
                type: 'object',
                properties: {
                    fullName: { type: 'string' },
                    headline: { type: 'string' },
                    about: { type: 'string' },
                    experience: { type: 'array', items: { type: 'object' } },
                    skills: { type: 'array', items: { type: 'string' } },
                    connections: { type: 'string' },
                },
            },
        }, { timeout: 20000 });

        return { ...lead, enriched: res.data?.data || res.data, enrichedAt: new Date().toISOString() };
    } catch (err) {
        return { ...lead, enrichmentError: err.message };
    }
}

module.exports = { findLeads, enrichLead, buildSearchUrls };
