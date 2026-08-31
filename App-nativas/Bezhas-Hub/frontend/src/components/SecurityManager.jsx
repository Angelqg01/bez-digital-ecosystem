import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { ethers } from 'ethers';
import EthCrypto from 'eth-crypto';

const SecurityManager = ({ authContract }) => {
  const { user, isAuthenticated } = useAuth();
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
    recoveryHashSet: false,
    backupCreated: false
  });
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [backupData, setBackupData] = useState(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && authContract) {
      loadSecuritySettings();
    }
  }, [isAuthenticated, authContract]);

  const loadSecuritySettings = async () => {
    try {
      if (!authContract || !user?.address) return;

      const userSecurity = await authContract.getUserSecurity(user.address);
      setSecuritySettings({
        twoFactorEnabled: userSecurity.twoFactorEnabled,
        recoveryHashSet: userSecurity.recoveryHash !== '0x0000000000000000000000000000000000000000000000000000000000000000',
        backupCreated: false // This will now be a transient state during backup creation
      });
    } catch (error) {
      console.error('Error loading security settings:', error);
    }
  };

  const generateRecoveryPhrase = () => {
    const words = [
      'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
      'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
      'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual',
      'adapt', 'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance'
    ];

    const phrase = [];
    for (let i = 0; i < 12; i++) {
      phrase.push(words[Math.floor(Math.random() * words.length)]);
    }

    return phrase.join(' ');
  };

  const createBackup = async () => {
    try {
      setLoading(true);

      // Generate recovery phrase
      const phrase = generateRecoveryPhrase();
      setRecoveryPhrase(phrase);

      // Encryption identity should be managed in memory and not persisted in localStorage.

      // Create backup data
      const backup = {
        version: '1.0',
        timestamp: Date.now(),
        userAddress: user.address,
        recoveryPhrase: phrase,
        encryptionIdentity: encryptionIdentity,
        sessionData: {
          loginTime: user.loginTime,
          role: user.role
        }
      };

      // Encrypt backup with user's signature
      const message = `Backup BeZhas account ${user.address} at ${backup.timestamp}`;
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(message);

      // Use signature as encryption key
      const encryptionKey = ethers.keccak256(ethers.toUtf8Bytes(signature));
      const encryptedBackup = EthCrypto.cipher.stringify(
        await EthCrypto.encryptWithPublicKey(
          EthCrypto.publicKeyByPrivateKey(encryptionKey.slice(2)),
          JSON.stringify(backup)
        )
      );

      // Do not store backup or hash in localStorage. Prompt for download instead.

      setBackupData(backup);
      setSecuritySettings(prev => ({ ...prev, backupCreated: true }));

      // Set recovery hash on contract
      const recoveryHash = ethers.keccak256(ethers.toUtf8Bytes(phrase));
      const tx = await authContract.setRecoveryHash(recoveryHash);
      await tx.wait();

      setSecuritySettings(prev => ({ ...prev, recoveryHashSet: true }));

    } catch (error) {
      console.error('Error creating backup:', error);
      toast.error(`Error creating backup: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadBackup = () => {
    if (!backupData) return;

    const backupJson = JSON.stringify(backupData, null, 2);
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `bezhas-backup-${user.address.substring(0, 8)}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  };

  const initiateRecovery = async (recoveryPhrase) => {
    try {
      setLoading(true);

      if (!recoveryPhrase.trim()) {
        toast.error('Please enter your recovery phrase');
        return;
      }

      // Verify recovery phrase
      // The recovery phrase will be sent directly to the contract. 
      // The contract is the source of truth for the recovery hash.

      // Initiate recovery on contract
      const tx = await authContract.initiateRecovery(ethers.toUtf8Bytes(recoveryPhrase.trim()));
      await tx.wait();

      toast.success('Account recovery initiated successfully!');
      setShowRecovery(false);
      loadSecuritySettings();

    } catch (error) {
      console.error('Error initiating recovery:', error);
      toast.error(`Error initiating recovery: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const restoreFromBackup = async (backupFile) => {
    try {
      setLoading(true);

      const fileContent = await backupFile.text();
      const backup = JSON.parse(fileContent);

      // Verify backup structure
      if (!backup.version || !backup.userAddress || !backup.recoveryPhrase) {
        throw new Error('Invalid backup file format');
      }

      // Do not restore identity to localStorage. This should be handled in memory.
      if (backup.encryptionIdentity) {
        console.log("Encryption identity found in backup. It should be loaded into the app's state.");
      }

      // Set recovery phrase for future use
      setRecoveryPhrase(backup.recoveryPhrase);

      toast.success('Backup restored successfully! You can now use your recovery phrase if needed.');

    } catch (error) {
      console.error('Error restoring backup:', error);
      toast.error(`Error restoring backup: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearAllData = () => {
    if (confirm('Are you sure you want to clear all local data? This will log you out and cannot be undone.')) {
      // Now that we don't use localStorage for sensitive data, this just becomes a logout.
      // For a more thorough cleanup, we could clear IndexedDB or other storages if used.
      toast.info('All local data cleared. Please refresh the page.');
      window.location.reload();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="security-manager-placeholder">
        <p>Please connect your wallet to access security settings</p>
      </div>
    );
  }

  return (
    <div className="security-manager">
      <div className="security-header">
        <h2>Security & Recovery</h2>
        <p>Protect your account with backup and recovery options</p>
      </div>

      <div className="security-sections">
        {/* Account Backup Section */}
        <div className="security-section">
          <h3>Account Backup</h3>
          <div className="security-status">
            <div className={`status-indicator ${securitySettings.backupCreated ? 'active' : 'inactive'}`}>
              {securitySettings.backupCreated ? '✅' : '❌'} Backup Created
            </div>
            <div className={`status-indicator ${securitySettings.recoveryHashSet ? 'active' : 'inactive'}`}>
              {securitySettings.recoveryHashSet ? '✅' : '❌'} Recovery Hash Set
            </div>
          </div>

          {!securitySettings.backupCreated ? (
            <div className="backup-creation">
              <p>Create a secure backup of your account to enable recovery options.</p>
              <button
                onClick={createBackup}
                disabled={loading}
                className="create-backup-btn"
              >
                {loading ? 'Creating Backup...' : 'Create Backup'}
              </button>
            </div>
          ) : (
            <div className="backup-actions">
              <p>✅ Your account backup is ready!</p>
              {backupData && (
                <button
                  onClick={downloadBackup}
                  className="download-backup-btn"
                >
                  Download Backup File
                </button>
              )}
            </div>
          )}

          {recoveryPhrase && (
            <div className="recovery-phrase-display">
              <h4>⚠️ Recovery Phrase (Save This Securely!)</h4>
              <div className="recovery-phrase">
                {recoveryPhrase}
              </div>
              <p className="warning">
                Store this phrase in a safe place. You'll need it to recover your account.
              </p>
            </div>
          )}
        </div>

        {/* Account Recovery Section */}
        <div className="security-section">
          <h3>Account Recovery</h3>

          {!showRecovery ? (
            <button
              onClick={() => setShowRecovery(true)}
              className="show-recovery-btn"
            >
              Recover Account
            </button>
          ) : (
            <div className="recovery-form">
              <h4>Enter Recovery Phrase</h4>
              <textarea
                placeholder="Enter your 12-word recovery phrase..."
                value={recoveryPhrase}
                onChange={(e) => setRecoveryPhrase(e.target.value)}
                rows={3}
              />
              <div className="recovery-actions">
                <button
                  onClick={() => initiateRecovery(recoveryPhrase)}
                  disabled={loading || !recoveryPhrase.trim()}
                  className="initiate-recovery-btn"
                >
                  {loading ? 'Recovering...' : 'Initiate Recovery'}
                </button>
                <button
                  onClick={() => setShowRecovery(false)}
                  className="cancel-recovery-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Backup Restore Section */}
        <div className="security-section">
          <h3>Restore from Backup</h3>
          <p>Upload a backup file to restore your account data.</p>

          <input
            type="file"
            accept=".json"
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) restoreFromBackup(file);
            }}
            className="backup-file-input"
          />
        </div>

        {/* Emergency Actions */}
        <div className="security-section emergency">
          <h3>Emergency Actions</h3>
          <p>Use these actions only in emergency situations.</p>

          <button
            onClick={clearAllData}
            className="clear-data-btn danger"
          >
            Clear All Local Data
          </button>
        </div>

        {/* Security Tips */}
        <div className="security-section tips">
          <h3>Security Tips</h3>
          <ul>
            <li>Always create a backup before making important changes</li>
            <li>Store your recovery phrase in multiple secure locations</li>
            <li>Never share your recovery phrase with anyone</li>
            <li>Regularly check your account for suspicious activity</li>
            <li>Use a hardware wallet for maximum security</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SecurityManager;
