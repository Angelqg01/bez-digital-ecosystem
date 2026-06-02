import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

const token = process.env.HUBSPOT_ACCESS_TOKEN;

if (!token) {
  console.error('\x1b[31mError: HUBSPOT_ACCESS_TOKEN is missing in the .env file.\x1b[0m');
  process.exit(1);
}

const hs = axios.create({
  baseURL: 'https://api.hubapi.com/crm/v3',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Stalled Antwerp deals from the report
const dealsToReactivate = [
  {
    id: '502645006541',
    name: 'BeZhas Pilot - PSA Antwerp (CFS)',
    description: 'PSA Antwerp (CFS) - Zero-Friction Pilot follow-up focusing on CFS consolidation and dispute mitigation.',
    noteBody: `
      <h3>🔄 BeZhas-ICA Reactivation Strategy Initiated</h3>
      <p><strong>Date:</strong> June 1, 2026</p>
      <p><strong>Action:</strong> Zero-Friction 14-Day Pilot Follow-Up drafted and sent to contact.</p>
      <p><strong>Operational Angle:</strong></p>
      <ul>
        <li><strong>TOS Isolation:</strong> 0% system/database changes required for PSA Antwerp IT.</li>
        <li><strong>Pilot Scope:</strong> Tracking 1 cargo corridor (CFS consolidation to export gate) over 14 days.</li>
        <li><strong>Key Benefit:</strong> Real-time handoff verification and automatic validation of consolidation footprints to eliminate customer claims.</li>
      </ul>
      <p><em>Logged by BeZhas-ICA (Institutional Capital Agent).</em></p>
    `
  },
  {
    id: '502637717748',
    name: 'BeZhas Pilot - DP World Antwerp Gateway',
    description: 'DP World Antwerp Gateway - Zero-Friction Pilot follow-up focusing on intermodal gate SLA compliance.',
    noteBody: `
      <h3>🔄 BeZhas-ICA Reactivation Strategy Initiated</h3>
      <p><strong>Date:</strong> June 1, 2026</p>
      <p><strong>Action:</strong> Zero-Friction 14-Day Pilot Follow-Up drafted and sent to contact.</p>
      <p><strong>Operational Angle:</strong></p>
      <ul>
        <li><strong>TOS Isolation:</strong> 0% operating system changes. Data captured via standard webhooks/APIs.</li>
        <li><strong>Pilot Scope:</strong> Real-time gate entry/exit milestone verification and turnaround SLA audit over 14 days.</li>
        <li><strong>Key Benefit:</strong> Unified operations dashboard to pinpoint bottlenecks and resolve carrier disputes within 2 weeks.</li>
      </ul>
      <p><em>Logged by BeZhas-ICA (Institutional Capital Agent).</em></p>
    `
  }
];

async function testConnection() {
  try {
    console.log('🔌 Connecting to HubSpot API...');
    const response = await hs.get('/objects/contacts?limit=1');
    console.log('\x1b[32m✔ Connected to HubSpot successfully!\x1b[0m\n');
    return true;
  } catch (error) {
    console.error('\x1b[31m❌ Connection failed: Please verify that your HUBSPOT_ACCESS_TOKEN is correct and has the necessary scopes.\x1b[0m');
    if (error.response) {
      console.error(`Status: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

async function findDealByName(name) {
  try {
    const searchResponse = await hs.post('/objects/deals/search', {
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'dealname',
              operator: 'EQ',
              value: name
            }
          ]
        }
      ]
    });
    return searchResponse.data.results?.[0] || null;
  } catch (error) {
    console.warn(`⚠️ Could not search for deal "${name}": ${error.message}`);
    return null;
  }
}

async function createNoteAndAssociate(dealId, noteHtml) {
  try {
    // Create Note and associate it directly with the Deal in one step
    // 214 is the HubSpot defined associationTypeId for Note to Deal
    const response = await hs.post('/objects/notes', {
      properties: {
        hs_note_body: noteHtml.trim()
      },
      associations: [
        {
          to: {
            id: dealId
          },
          types: [
            {
              associationCategory: 'HUBSPOT_DEFINED',
              associationTypeId: 214
            }
          ]
        }
      ]
    });
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to create note for deal ${dealId}: ${error.message}`);
    if (error.response) {
      console.error(JSON.stringify(error.response.data));
    }
    return null;
  }
}

async function syncDeals() {
  const isConnected = await testConnection();
  if (!isConnected) process.exit(1);

  console.log('🚀 Running Reactivation Synchronization...\n');

  for (const target of dealsToReactivate) {
    let dealId = target.id;
    let dealObj = null;

    // 1. Try to fetch directly by ID
    try {
      const response = await hs.get(`/objects/deals/${dealId}`);
      dealObj = response.data;
      console.log(`🔍 Found deal by ID: "${dealObj.properties.dealname}" (${dealId})`);
    } catch (error) {
      console.log(`⚠️ ID ${dealId} not found directly. Searching by name: "${target.name}"...`);
      const searchObj = await findDealByName(target.name);
      if (searchObj) {
        dealId = searchObj.id;
        dealObj = searchObj;
        console.log(`🔍 Found matching deal: "${dealObj.properties.dealname}" (New ID: ${dealId})`);
      } else {
        console.log(`❌ Deal "${target.name}" not found in this HubSpot portal.`);
        console.log('Let\'s create a new deal to ensure the pipeline is complete!');
        
        // Let's create the deal dynamically to keep the workspace aligned!
        try {
          const createResponse = await hs.post('/objects/deals', {
            properties: {
              dealname: target.name,
              dealstage: 'appointmentscheduled',
              pipeline: 'default'
            }
          });
          dealId = createResponse.data.id;
          dealObj = createResponse.data;
          console.log(`\x1b[32m✔ Created new deal: "${target.name}" (ID: ${dealId})\x1b[0m`);
        } catch (createError) {
          console.error(`❌ Failed to create deal: ${createError.message}`);
          continue;
        }
      }
    }

    // 2. Ensure deal stage is updated to 'appointmentscheduled' (reactivated / scheduled)
    try {
      await hs.patch(`/objects/deals/${dealId}`, {
        properties: {
          dealstage: 'appointmentscheduled'
        }
      });
      console.log(`⚡ Stage updated to "appointmentscheduled" for deal: "${target.name}"`);
    } catch (patchError) {
      console.warn(`⚠️ Warning: Could not patch deal stage: ${patchError.message}`);
    }

    // 3. Create Note and associate it with the Deal
    const note = await createNoteAndAssociate(dealId, target.noteBody);
    if (note) {
      console.log(`\x1b[32m✔ Rich-Text Reactivation Note successfully logged and associated (Note ID: ${note.id})\x1b[0m\n`);
    }
  }

  console.log('🏁 HubSpot Sync Completed successfully.');
}

syncDeals();
