import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAccount } from 'wagmi';
import CryptoJS from 'crypto-js';

// If you have a configured axios instance, use it here, e.g., import api from '../utils/api';
// Using fetch for simplicity in this implementation based on assuming typical generic routes.

const ContactSyncPage = () => {
  const { isConnected } = useAccount();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      navigate('/');
    }
  }, [isConnected, navigate]);

  // Fetch Existing Matches from backend
  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const token = localStorage.getItem('token'); // Fallback to token if required
        const res = await fetch('/api/contacts/matches', {
          headers: {
             'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
           const data = await res.json();
           setMatches(data.matches || []);
        }
      } catch (err) {
        console.error("Error fetching matches:", err);
      }
    };
    if (isConnected) fetchMatches();
  }, [isConnected]);

  // Helper to standardise and hash strings locally
  const hashData = (string) => {
    if (!string) return null;
    const cleanStr = string.toLowerCase().trim();
    return CryptoJS.SHA256(cleanStr).toString();
  };

  /**
   * Browser Contact Picker API implementation
   * (Currently available on Android Chrome and some other modern mobile browsers)
   */
  const handleBrowserContactPicker = async () => {
    if (!('contacts' in navigator && 'ContactsManager' in window)) {
       toast.error('This browser does not support the Contact Picker API. Please use the CSV upload on Desktop.');
       return;
    }

    try {
      const props = ['name', 'email', 'tel'];
      const opts = { multiple: true };
      const contacts = await navigator.contacts.select(props, opts);
      
      const formattedContacts = contacts.map(c => ({
         name: (c.name && c.name[0]) || '',
         emailHash: c.email && c.email[0] ? hashData(c.email[0]) : null,
         phoneHash: c.tel && c.tel[0] ? hashData(c.tel[0]) : null,
      })).filter(c => c.emailHash || c.phoneHash);

      await uploadContactHashes(formattedContacts);

    } catch (err) {
      console.error("Contact Picker Error:", err);
      toast.error("Failed to read contacts. Did you grant permission?");
    }
  };

  /**
   * CSV Parsing for Fallback (exported from Outlook/Mac/Gmail)
   */
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csvData = event.target.result;
      const rows = csvData.split('\n');
      
      const formattedContacts = [];
      
      // Simple CSV parser (assuming column names exist)
      // Note: A real implementation might use Papaparse or similar robust library
      const headers = rows[0].toLowerCase().split(',');
      const emailIdx = headers.findIndex(h => h.includes('email'));
      const phoneIdx = headers.findIndex(h => h.includes('phone'));
      const nameIdx = headers.findIndex(h => h.includes('name'));

      for (let i = 1; i < rows.length; i++) {
         const cols = rows[i].split(',');
         if (cols.length > 1) {
            const emailHash = emailIdx >= 0 && cols[emailIdx] ? hashData(cols[emailIdx]) : null;
            const phoneHash = phoneIdx >= 0 && cols[phoneIdx] ? hashData(cols[phoneIdx]) : null;
            
            if (emailHash || phoneHash) {
              formattedContacts.push({
                 name: nameIdx >= 0 ? cols[nameIdx] : 'Unknown',
                 emailHash,
                 phoneHash
              });
            }
         }
      }

      await uploadContactHashes(formattedContacts);
    };
    reader.readAsText(file);
  };

  const uploadContactHashes = async (contactsArray) => {
    if (contactsArray.length === 0) {
      toast.error('No valid contacts found with emails or phone numbers.');
      return;
    }

    setIsProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/contacts/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ contacts: contactsArray })
      });

      if (res.status === 202) {
         toast.success(`Successfully uploaded ${contactsArray.length} encrypted contacts! We will notify you of matches.`);
      } else {
         toast.error('Failed to sync contacts.');
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error('An error occurred during synchronization.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddFriend = async (contactId) => {
     try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/contacts/${contactId}/add-friend`, {
           method: 'POST',
           headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
           toast.success('Friend Request Sent! You earned 50 BEZ-Coins! 🎉');
           // Update local state to remove from matches or show 'invited'
           setMatches(matches.map(m => m._id === contactId ? { ...m, status: 'invited' } : m));
        }
     } catch (err) {
        toast.error('Failed to add friend.');
     }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl pt-24 text-white">
      <div className="bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-700 relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-fuchsia-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>

        <h1 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-fuchsia-400">
          Sync Contacts, Find Friends, Earn BEZ!
        </h1>
        
        <p className="text-slate-300 mb-6 text-lg">
          Connect your contacts to find out who is already on BeZhas.
          <br/><span className="text-primary-400 font-semibold">Earn 50 BEZ-Coins</span> for every matched friend you add!
        </p>

        <div className="bg-slate-900/50 border border-slate-700 p-4 rounded-lg mb-8">
           <h3 className="text-white font-semibold flex items-center mb-2">
             <svg className="w-5 h-5 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
             Privacy First Guarantee
           </h3>
           <p className="text-sm text-slate-400">
             Your privacy is our priority. We never upload your raw phone numbers or emails to our servers. All data is securely hashed locally on your device before transfer using SHA-256 encryption.
           </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-12">
           <button 
             onClick={handleBrowserContactPicker}
             disabled={isProcessing}
             className="flex-1 bg-gradient-to-r from-primary-600 to-fuchsia-600 hover:from-primary-500 hover:to-fuchsia-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition active:scale-95 disabled:opacity-50"
           >
             {isProcessing ? 'Processing...' : 'Sync Mobile Contacts'}
           </button>
           
           <div className="flex-1 relative">
             <input 
               type="file" 
               accept=".csv" 
               onChange={handleCSVUpload}
               disabled={isProcessing}
               className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
             />
             <div className="bg-slate-700 hover:bg-slate-600 border border-slate-500 flex items-center justify-center text-white font-bold py-3 px-6 rounded-lg shadow-lg transition">
                {isProcessing ? 'Processing CSV...' : 'Upload Contacts CSV'}
             </div>
           </div>
        </div>

        {/* Matches Section */}
        {matches.length > 0 && (
           <div className="mt-8">
             <h2 className="text-2xl font-bold mb-4 border-b border-slate-700 pb-2">Your Matched Friends</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matches.map(match => (
                   <div key={match._id} className="bg-slate-700/50 p-4 rounded-lg flex justify-between items-center border border-slate-600">
                      <div className="flex items-center">
                         <div className="w-12 h-12 bg-slate-600 rounded-full flex items-center justify-center text-xl font-bold mr-4 overflow-hidden">
                           {match.matchedUserId?.profileImage ? (
                               <img src={match.matchedUserId.profileImage} alt="Profile" className="w-full h-full object-cover" />
                           ) : (
                               match.matchedUserId?.username?.charAt(0) || '?'
                           )}
                         </div>
                         <div>
                            <p className="font-bold text-white">{match.matchedUserId?.username || 'Unknown User'}</p>
                         </div>
                      </div>
                      <button 
                         onClick={() => handleAddFriend(match._id)}
                         disabled={match.status === 'invited'}
                         className={`px-4 py-2 rounded-lg font-bold text-sm transition ${
                            match.status === 'invited' 
                            ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                            : 'bg-green-500 hover:bg-green-400 text-white'
                         }`}
                      >
                         {match.status === 'invited' ? 'Invited' : '+ Add (Earn 50 BEZ)'}
                      </button>
                   </div>
                ))}
             </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default ContactSyncPage;
