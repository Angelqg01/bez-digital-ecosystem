import { useState } from 'react';
import http from '../services/http';

// This is a mock function to simulate reading contacts from a device.
// In a real mobile app, you would use a native API (e.g., via Capacitor or React Native).
const getMockContacts = () => [
  { name: 'Alice', email: 'alice@example.com', phone: '111222333' },
  { name: 'Bob', email: 'bob@example.com' },
  { name: 'Charlie', phone: '444555666' },
  { name: 'David (Already on BeZhas)', email: 'david.existing@bezhas.com' }
];

const ContactSync = ({ walletAddress }) => {
  const [status, setStatus] = useState('idle'); // idle, syncing, success, error
  const [message, setMessage] = useState('');

  const handleSync = async () => {
    if (!walletAddress) {
      setMessage('Please connect your wallet first.');
      setStatus('error');
      return;
    }

    setStatus('syncing');
    setMessage('Reading contacts... (simulation)');

    // 1. Get contacts (simulated)
    const contacts = getMockContacts();

    // 2. Send to backend
    try {
      setMessage(`Sending ${contacts.length} contacts to be processed...`);
      const response = await http.post('/api/contacts/sync', { contacts }, {
        headers: {
          'x-wallet-address': walletAddress // Simulated auth
        }
      });

      const result = response.data;

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(result.error || 'Failed to start sync process.');
      }

      setStatus('success');
      setMessage(result.message);

    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  return (
    <div className="contact-sync-container section-card">
      <h2>Grow Your Network</h2>
      <p>Sync your contacts to find friends already on BeZhas and earn Bez-Coin for your first sync!</p>

      <div className="opt-in-notice">
        <p><strong>Privacy Notice:</strong> By clicking 'Sync Contacts', you agree to let BeZhas securely process your contacts to suggest connections. We hash personal information and encrypt original data. You can delete this data at any time.</p>
      </div>

      <button onClick={handleSync} disabled={status === 'syncing'}>
        {status === 'syncing' ? 'Syncing...' : 'Sync Contacts & Earn Reward'}
      </button>

      {message && (
        <div className={`sync-status ${status}`}>
          <p>{message}</p>
        </div>
      )}
    </div>
  );
};

export default ContactSync;
