import axios from 'axios';
import 'dotenv/config';

export const SYNC_CONTACTS_TOOLS = [
    {
        name: "sync_contacts",
        description: "Synchronize a list of contacts (email or phone) to the BeZhas network. The contacts will be hashed locally before sending to ensure privacy. Use this to find out if specific contacts are already using the BeZhas platform.",
        inputSchema: {
            type: "object",
            properties: {
                contacts: {
                    type: "array",
                    description: "List of contacts to sync.",
                    items: {
                        type: "object",
                        properties: {
                            name: {
                                type: "string",
                                description: "Name of the contact"
                            },
                            email: {
                                type: "string",
                                description: "Email address of the contact (optional if phone is provided)"
                            },
                            phone: {
                                type: "string",
                                description: "Phone number of the contact (optional if email is provided)"
                            }
                        }
                    }
                },
                userToken: {
                    type: "string",
                    description: "The authentication token of the BeZhas user performing the sync."
                }
            },
            required: ["contacts", "userToken"],
        },
    }
];

export async function handleSyncContactsTool(name: string, args: any) {
    switch (name) {
        case "sync_contacts":
            return await syncContacts(args.contacts, args.userToken);
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}

async function syncContacts(contacts: any[], userToken: string) {
    if (!contacts || contacts.length === 0) {
        return {
            content: [{
                type: "text",
                text: "Error: No contacts provided for synchronization.",
            }],
            isError: true,
        };
    }

    try {
        // NOTE: In a real world scenario, the hashing would happen fully here before sending.
        // For the sake of this MCP tool acting as a client, we simulate the hashing or assume the 
        // backend can handle it if we are using internal networks, but ideally we use crypto here.
        // Dynamic import of crypto to avoid module issues if possible
        const crypto = await import('crypto');
        
        const hashData = (str: string) => {
            if (!str) return null;
            return crypto.createHash('sha256').update(str.toLowerCase().trim()).digest('hex');
        };

        const formattedContacts = contacts.map((c: any) => ({
            name: c.name || 'Unknown',
            emailHash: c.email ? hashData(c.email) : null,
            phoneHash: c.phone ? hashData(c.phone) : null
        })).filter((c: any) => c.emailHash || c.phoneHash);

        if (formattedContacts.length === 0) {
            return {
                content: [{
                    type: "text",
                    text: "Error: No valid emails or phone numbers found in the provided contacts.",
                }],
                isError: true,
            };
        }

        const API_URL = process.env.BEZHAS_API_URL || 'https://api.bezhas.com/api';

        const response = await axios.post(`${API_URL}/contacts/sync`, {
            contacts: formattedContacts
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            }
        });

        if (response.status === 202 || response.status === 200) {
            return {
                content: [{
                    type: "text",
                    text: `Successfully queued ${formattedContacts.length} contacts for synchronization.`,
                }],
            };
        } else {
            return {
                content: [{
                    type: "text",
                    text: `Failed to sync contacts. Status: ${response.status}`,
                }],
                isError: true,
            };
        }

    } catch (error: any) {
        return {
            content: [{
                type: "text",
                text: `Network or runtime error syncing contacts: ${error.message}`,
            }],
            isError: true,
        };
    }
}

export function registerSyncContactsMcp(server: any) {
    server.tool(
        "sync_contacts",
        "Synchronize a list of contacts (email or phone) to the BeZhas network. Local hashing ensures privacy.",
        {
            contacts: {
                type: "array",
                description: "List of contacts to sync.",
                items: {
                    type: "object",
                    properties: {
                        name: {
                            type: "string",
                            description: "Name of the contact"
                        },
                        email: {
                            type: "string",
                            description: "Email address of the contact"
                        },
                        phone: {
                            type: "string",
                            description: "Phone number of the contact"
                        }
                    }
                }
            },
            userToken: {
                type: "string",
                description: "The authentication token of the BeZhas user executing the sync."
            }
        },
        async (args: any) => {
            return await syncContacts(args.contacts, args.userToken);
        }
    );
}
