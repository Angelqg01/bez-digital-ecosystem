const User = require('../models/pg/User');
const Contact = require('../models/pg/Contact');

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
    
    for (const contactData of contacts) {
      const { emailHash, phoneHash, encryptedData } = contactData;
      if (!emailHash && !phoneHash) continue;

      // 1. ¿Algún usuario de BeZhas coincide con esos hashes?
      const matchedUser = await User.findByContactHashes({ emailHash, phoneHash });

      // 2. Nunca se empareja a un usuario consigo mismo.
      if (matchedUser && String(matchedUser.id) === String(ownerId)) continue;

      // 3. Crea o actualiza el contacto del propietario (un invited no se reabre: ver Contact.upsert).
      await Contact.upsert({
        ownerId,
        emailHash,
        phoneHash,
        encryptedData: encryptedData || 'encrypted_stub', // Sólo para pruebas: el cliente envía el dato cifrado.
        status: matchedUser ? 'is_user' : 'pending',
        matchedUserId: matchedUser ? matchedUser.id : null,
      });
    }

    // Marca que el usuario sincronizó contactos (analítica).
    await User.update(ownerId, { contactSync: { hasSynced: true, lastSync: new Date().toISOString() } });

    console.log(`[Queue] Successfully synced ${contacts.length} contacts for user ${ownerId}`);

  } catch (error) {
    console.error(`[Queue] Error syncing contacts for user ${userId}:`, error);
    throw error; // Re-throw to allow BullMQ to handle retries
  }
}

module.exports = {
  processContactSync
};
