import React, { useState, useEffect } from 'react';
import { Shield, Activity, Database, Key, Server, Coins, Hexagon, Fingerprint } from 'lucide-react';
import { motion } from 'framer-motion';

// Mock BeZhas Platform SDK hook
import { BeZhasPlatform } from './lib/bezhas-sdk';

// Wallet login / subscribe (shared)
import WalletAuthButton from './WalletAuthButton.jsx';

const useBeZhasPlatform = () => {
  const [status, setStatus] = useState('disconnected');
  const [wallet, setWallet] = useState(null);

  const connect = async () => {
    try {
      setStatus('connecting');
      const w = await BeZhasPlatform.connectWallet();
      setWallet(w);
      setStatus('connected');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  return { status, wallet, connect };
};

const BZGenesisApp = () => {
  const { status, wallet, connect } = useBeZhasPlatform();
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Negotiation state
  const [agentReply, setAgentReply] = useState('');
  const [negotiating, setNegotiating] = useState(false);

  // Cold Chain State
  const [coldChainData, setColdChainData] = useState(null);

  // Clinical Trials State
  const [clinicalStats, setClinicalStats] = useState({ encryptedRecords: 0, activeTrials: 0, recentCIDs: [] });
  const [uploadingEHR, setUploadingEHR] = useState(false);
  const [ehrStatusMsg, setEhrStatusMsg] = useState('');

  // Guardian State
  const [guardianData, setGuardianData] = useState(null);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    // Fetch initial data
    BeZhasPlatform.getColdChainStatus().then(setColdChainData);
    BeZhasPlatform.getClinicalTrialStats().then(setClinicalStats);
    BeZhasPlatform.getGuardianStatus().then(setGuardianData);
    
    
    // Simulate IoT real-time polling from CargoLink oracle every 4 seconds
    const interval = setInterval(async () => {
      const data = await BeZhasPlatform.getColdChainStatus();
      setColdChainData(data);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleNegotiate = async () => {
    setNegotiating(true);
    const reply = await BeZhasPlatform.negotiateBioAsset('broker', 'Please evaluate my 100 USDC for BZ-BIO trade offer.');
    setAgentReply(reply);
    setNegotiating(false);
  };

  const handleUploadEHR = async () => {
    setUploadingEHR(true);
    setEhrStatusMsg('1/3: De-identifying via Edge AI...');
    
    const mockRecord = "Patient John Doe, 45 years old, experienced mild fever on 2026-05-01 after trial dose.";
    const result = await BeZhasPlatform.uploadClinicalRecord(mockRecord);
    
    setEhrStatusMsg('2/3: Encrypting payload...');
    await new Promise(r => setTimeout(r, 600)); // UX delay
    
    setEhrStatusMsg('3/3: Pinning to IPFS...');
    await new Promise(r => setTimeout(r, 600)); // UX delay

    setClinicalStats(prev => ({
      ...prev,
      encryptedRecords: prev.encryptedRecords + 1,
      recentCIDs: [result.ipfsCid, ...prev.recentCIDs].slice(0, 2)
    }));
    
    setEhrStatusMsg('');
    setUploadingEHR(false);
  };

  const handleGuardianRecovery = async () => {
    if (!guardianData) return;
    setRecovering(true);
    
    // Simulate smart contract call to Aegis
    await BeZhasPlatform.requestGuardianRecovery();
    
    // Update local state to simulate the 3rd node approving the recovery
    setGuardianData(prev => {
      const newNodes = [...prev.nodes];
      newNodes[2].status = 'active'; // The Bio-Metric Vault approves
      return {
        ...prev,
        activeApprovals: 3,
        recoveryMode: true,
        nodes: newNodes
      };
    });
    setRecovering(false);
  };

  return (
    <div className="bz-app-container">
      {/* Sidebar Navigation */}
      <nav className="bz-sidebar">
        <div className="bz-logo">
          <Hexagon className="bz-icon-primary" size={32} />
          <span>BZ Genesis</span>
        </div>
        
        <div className="bz-nav-links">
          <button className={`bz-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <Activity size={20} /> Dashboard
          </button>
          <button className={`bz-nav-item ${activeTab === 'identity' ? 'active' : ''}`} onClick={() => setActiveTab('identity')}>
            <Fingerprint size={20} /> PureScan DID
          </button>
          <button className={`bz-nav-item ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')}>
            <Database size={20} /> Clinical Data
          </button>
          <button className={`bz-nav-item ${activeTab === 'wallet' ? 'active' : ''}`} onClick={() => setActiveTab('wallet')}>
            <Coins size={20} /> Wallet & Assets
          </button>
          <button className={`bz-nav-item ${activeTab === 'guardians' ? 'active' : ''}`} onClick={() => setActiveTab('guardians')}>
            <Shield size={20} /> Guardians
          </button>
        </div>
        
        <div className="bz-network-status">
          <div className={`status-indicator ${status}`}></div>
          <span>{status === 'connected' ? 'BeZhas L2 Connected' : 'Connecting...'}</span>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="bz-main-content">
        <header className="bz-header">
          <h1>Bio-Agent Ecosystem</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {wallet ? (
              <div className="bz-wallet-chip">
                <span className="address">{wallet.address.slice(0,6)}...{wallet.address.slice(-4)}</span>
                <span className="balance">{wallet.balance}</span>
                {wallet.pureScanVerified && <Shield size={16} className="verified-icon" />}
              </div>
            ) : (
              <button className="bz-btn primary" onClick={connect}>Connect PureScan Wallet</button>
            )}
            <WalletAuthButton accent="#7c3aed" statement="Inicia sesión en BZ Genesis." subscribePlan={{ amountBEZ: 75, label: 'Bio-Agent Access' }} />
          </div>
        </header>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bz-dashboard-grid"
        >
          {/* Clinical Trials & EHR Card */}
          <div className="bz-card gradient-border">
            <div className="card-header">
              <Database className="card-icon" />
              <h3>Clinical Trials EHR</h3>
            </div>
            <div className="card-body">
              <p>Edge AI De-Identification active.</p>
              <div className="stat-row">
                <span>Encrypted Records</span>
                <strong>{clinicalStats.encryptedRecords.toLocaleString()}</strong>
              </div>
              <div className="stat-row">
                <span>Active Trials</span>
                <strong>{clinicalStats.activeTrials}</strong>
              </div>
              
              {clinicalStats.recentCIDs.length > 0 && (
                <div style={{marginTop: '12px', fontSize: '0.8rem', color: 'var(--bz-text-muted)'}}>
                  <span>Latest IPFS CIDs:</span>
                  {clinicalStats.recentCIDs.map(cid => (
                    <div key={cid} style={{fontFamily: 'monospace', color: 'var(--bz-primary)', marginTop: '4px'}}>
                      {cid.slice(0, 12)}...{cid.slice(-4)}
                    </div>
                  ))}
                </div>
              )}

              <button 
                className="bz-btn primary" 
                style={{marginTop: '20px', width: '100%'}}
                onClick={handleUploadEHR}
                disabled={uploadingEHR}
              >
                {uploadingEHR ? ehrStatusMsg : 'Upload & De-identify Record'}
              </button>
            </div>
          </div>

          {/* IoT Cold Chain Monitor */}
          <div className="bz-card">
            <div className="card-header">
              <Server className="card-icon" />
              <h3>IoT Cold Chain</h3>
            </div>
            <div className="card-body">
              <p>Monitoring biological shipments via <strong>BZ CargoLink</strong>.</p>
              
              {coldChainData ? (
                <>
                  <div className={`status-box ${coldChainData.status.toLowerCase().includes('optimal') ? 'optimal' : 'warning'}`}>
                    <div style={{display: 'flex', flexDirection: 'column'}}>
                      <span className="temp">{coldChainData.temperature}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--bz-text-muted)'}}>Last Oracle Sync: {coldChainData.lastUpdate}</span>
                    </div>
                    <span className="status" style={{color: coldChainData.status.includes('Optimal') ? 'var(--bz-success)' : 'var(--bz-warning)'}}>
                      {coldChainData.status}
                    </span>
                  </div>
                  <div className="stat-row">
                    <span>Shipment ID</span>
                    <strong>{coldChainData.shipmentId}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Location Checkpoint</span>
                    <strong>{coldChainData.location}</strong>
                  </div>
                </>
              ) : (
                <div className="status-box">Loading sensor data...</div>
              )}
              <button className="bz-btn secondary" style={{marginTop: '16px', width: '100%'}}>View On-Chain Logs</button>
            </div>
          </div>

          {/* Social Recovery Guardians */}
          <div className="bz-card">
            <div className="card-header">
              <Key className="card-icon" />
              <h3>Security Guardians</h3>
            </div>
            <div className="card-body">
              <p>Social recovery network status via <strong>Aegis</strong>.</p>
              
              {guardianData ? (
                <>
                  <div className="guardian-status">
                    {guardianData.nodes.map((node, i) => (
                      <div key={i} className={`guardian-node ${node.status}`} title={node.label}></div>
                    ))}
                    <span style={{color: guardianData.activeApprovals >= 3 ? 'var(--bz-success)' : 'inherit'}}>
                      {guardianData.activeApprovals}/{guardianData.totalGuardians} Approvals
                    </span>
                  </div>
                  
                  {guardianData.recoveryMode && (
                    <div style={{color: 'var(--bz-success)', fontSize: '0.85rem', marginBottom: '16px'}}>
                      ✓ Identity Restored via Bio-Metric Consensus
                    </div>
                  )}

                  <button 
                    className="bz-btn secondary" 
                    style={{width: '100%'}}
                    onClick={handleGuardianRecovery}
                    disabled={recovering || guardianData.recoveryMode}
                  >
                    {recovering ? 'Pinging Aegis Network...' : (guardianData.recoveryMode ? 'Recovery Complete' : 'Trigger Bio-Metric Guardian')}
                  </button>
                </>
              ) : (
                <div>Loading Aegis Guardians...</div>
              )}
            </div>
          </div>

          {/* Token Swap Interface */}
          <div className="bz-card col-span-2">
            <div className="card-header">
              <Coins className="card-icon" />
              <h3>Broker Negotiation & Swap</h3>
            </div>
            <div className="card-body swap-interface">
              <p>AI Agents negotiating bio-asset trades.</p>
              
              {agentReply && (
                <div className="agent-chat-bubble" style={{ background: 'rgba(37, 175, 244, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', borderLeft: '3px solid var(--bz-primary)' }}>
                  <strong>🤖 Broker AI:</strong> {agentReply}
                </div>
              )}

              <div className="swap-box">
                <div className="swap-input">
                  <label>Pay</label>
                  <input type="text" defaultValue="100.00" />
                  <span>USDC</span>
                </div>
                <div className="swap-icon">↓</div>
                <div className="swap-input">
                  <label>Receive (Est.)</label>
                  <input type="text" value="25.40" readOnly />
                  <span>BZ-BIO</span>
                </div>
              </div>
              <button 
                className="bz-btn primary full-width" 
                onClick={handleNegotiate}
                disabled={negotiating}
              >
                {negotiating ? 'Agent is negotiating...' : (agentReply ? 'Accept Trade' : 'Start Agent Negotiation')}
              </button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default BZGenesisApp;
