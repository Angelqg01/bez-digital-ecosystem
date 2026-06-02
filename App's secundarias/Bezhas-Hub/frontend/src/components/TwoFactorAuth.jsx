import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import QRCode from 'qrcode';

const TwoFactorAuth = ({ userAddress, authContract, onClose }) => {
  const [step, setStep] = useState('setup'); // setup, verify, success
  const [secret, setSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkTwoFactorStatus();
    if (step === 'setup') {
      generateSecret();
    }
  }, [userAddress]);

  const checkTwoFactorStatus = async () => {
    try {
      if (authContract && userAddress) {
        const enabled = await authContract.is2FAEnabled(userAddress);
        setIsEnabled(enabled);
        if (enabled) {
          setStep('manage');
        }
      }
    } catch (error) {
      console.error('Error checking 2FA status:', error);
    }
  };

  const generateSecret = () => {
    // Generate a random 32-character secret
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSecret(result);
    generateQRCode(result);
    generateBackupCodes();
  };

  const generateQRCode = async (secret) => {
    try {
      const otpauth = `otpauth://totp/BeZhas:${userAddress}?secret=${secret}&issuer=BeZhas`;
      const qrUrl = await QRCode.toDataURL(otpauth);
      setQrCodeUrl(qrUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      setError('Failed to generate QR code');
    }
  };

  const generateBackupCodes = () => {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    setBackupCodes(codes);
  };

  const enable2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Hash the secret for storage
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes(secret));
      
      const tx = await authContract.setup2FA(secretHash);
      await tx.wait();

      // Verify the code
      const codeHash = ethers.keccak256(ethers.toUtf8Bytes(verificationCode));
      const verifyTx = await authContract.verify2FA(codeHash);
      await verifyTx.wait();

      setStep('success');
      setIsEnabled(true);
    } catch (error) {
      console.error('Error enabling 2FA:', error);
      setError('Failed to enable 2FA. Please check your code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const disable2FA = async () => {
    setLoading(true);
    setError('');

    try {
      const tx = await authContract.disable2FA();
      await tx.wait();
      
      setIsEnabled(false);
      setStep('setup');
      generateSecret();
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      setError('Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const downloadBackupCodes = () => {
    const content = `BeZhas 2FA Backup Codes\n\nGenerated: ${new Date().toISOString()}\nAccount: ${userAddress}\n\nBackup Codes (use each only once):\n${backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}\n\nKeep these codes safe and secure!`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bezhas-2fa-backup-codes-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (step === 'setup') {
    return (
      <div className="two-factor-auth">
        <div className="modal-overlay" onClick={onClose}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Set up Two-Factor Authentication</h2>
              <button className="close-button" onClick={onClose}>×</button>
            </div>

            <div className="modal-body">
              <div className="setup-step">
                <h3>Step 1: Scan QR Code</h3>
                <p>Use an authenticator app like Google Authenticator or Authy to scan this QR code:</p>
                
                {qrCodeUrl && (
                  <div className="qr-code-container">
                    <img src={qrCodeUrl} alt="2FA QR Code" />
                  </div>
                )}

                <div className="manual-entry">
                  <p>Or enter this secret manually:</p>
                  <code className="secret-code">{secret}</code>
                </div>
              </div>

              <div className="setup-step">
                <h3>Step 2: Enter Verification Code</h3>
                <p>Enter the 6-digit code from your authenticator app:</p>
                
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="verification-input"
                  maxLength="6"
                />
              </div>

              {error && <div className="error-message">{error}</div>}
            </div>

            <div className="modal-footer">
              <button onClick={onClose} className="cancel-button">Cancel</button>
              <button 
                onClick={enable2FA} 
                disabled={loading || verificationCode.length !== 6}
                className="enable-button"
              >
                {loading ? 'Enabling...' : 'Enable 2FA'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="two-factor-auth">
        <div className="modal-overlay" onClick={onClose}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>2FA Enabled Successfully!</h2>
              <button className="close-button" onClick={onClose}>×</button>
            </div>

            <div className="modal-body">
              <div className="success-message">
                <div className="success-icon">✅</div>
                <p>Two-factor authentication has been enabled for your account.</p>
              </div>

              <div className="backup-codes-section">
                <h3>Backup Codes</h3>
                <p>Save these backup codes in a safe place. You can use them to access your account if you lose your authenticator device:</p>
                
                <div className="backup-codes">
                  {backupCodes.map((code, index) => (
                    <div key={index} className="backup-code">
                      {index + 1}. {code}
                    </div>
                  ))}
                </div>

                <button onClick={downloadBackupCodes} className="download-button">
                  Download Backup Codes
                </button>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={onClose} className="done-button">Done</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'manage') {
    return (
      <div className="two-factor-auth">
        <div className="modal-overlay" onClick={onClose}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Manage Two-Factor Authentication</h2>
              <button className="close-button" onClick={onClose}>×</button>
            </div>

            <div className="modal-body">
              <div className="status-section">
                <div className="status-indicator enabled">
                  <span className="status-icon">🔒</span>
                  <span>2FA is currently enabled</span>
                </div>
                <p>Your account is protected with two-factor authentication.</p>
              </div>

              <div className="actions-section">
                <h3>Actions</h3>
                <button 
                  onClick={() => setStep('setup')} 
                  className="reconfigure-button"
                >
                  Reconfigure 2FA
                </button>
                
                <button 
                  onClick={disable2FA} 
                  disabled={loading}
                  className="disable-button danger"
                >
                  {loading ? 'Disabling...' : 'Disable 2FA'}
                </button>
              </div>

              {error && <div className="error-message">{error}</div>}
            </div>

            <div className="modal-footer">
              <button onClick={onClose} className="close-modal-button">Close</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default TwoFactorAuth;
