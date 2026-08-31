import { ethers } from 'ethers';

const BEZHAS_RPC_URL = import.meta.env.VITE_BEZHAS_RPC || 'http://127.0.0.1:8545';
const BEZHAS_API_URL = import.meta.env.VITE_BEZHAS_API || 'http://127.0.0.1:3001';

export class BeZhasPlatform {
  static async connectWallet() {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error("No Ethereum wallet found. Please install MetaMask or BeZhas PureScan Wallet.");
    }
    
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    
    // Simulate getting balance from BeZhas L2
    const balanceWei = await provider.getBalance(address);
    const balance = ethers.formatEther(balanceWei);
    
    // Check if user has DID registered (Mock for now, normally queries a Smart Contract)
    const isVerified = true; 

    return { address, balance: `${parseFloat(balance).toFixed(4)} BZ`, pureScanVerified: isVerified, signer };
  }

  static async negotiateBioAsset(agentId, prompt) {
    try {
      // Connect to the local AgentManager / OpenClaw API
      const response = await fetch(`${BEZHAS_API_URL}/api/v1/agents/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agent: agentId || 'broker',
          message: prompt,
          context: 'bz-genesis-negotiation'
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to reach BeZhas Agent Runtime');
      }
      
      const data = await response.json();
      return data.reply;
    } catch (error) {
      console.warn("Agent Runtime not reachable, falling back to local mock:", error);
      // Fallback for UI if server is not running
      return `[Broker Agent] I have analyzed the market. I can offer you 25.40 BZ-BIO for 100 USDC. The clinical trials attached to this asset are highly promising. Do you accept the trade?`;
    }
  }

  static async getColdChainStatus(shipmentId = 'BIO-8422') {
    // In a real scenario, this connects to the BZ CargoLink Smart Contract via Ethers.js
    // const contract = new ethers.Contract(CARGOLINK_ADDRESS, CARGOLINK_ABI, provider);
    // return await contract.getShipmentStatus(shipmentId);
    
    // Simulating real-time oracle fluctuations (-79 to -81 °C)
    const baseTemp = -80.0;
    const fluctuation = (Math.random() * 1.5 - 0.75).toFixed(1);
    const currentTemp = baseTemp + parseFloat(fluctuation);
    
    let statusLabel = 'Optimal';
    if (currentTemp > -79.0) statusLabel = 'Warning';
    if (currentTemp < -81.0) statusLabel = 'Critical (Too Cold)';

    return {
      shipmentId,
      status: statusLabel,
      temperature: `${currentTemp.toFixed(1)}°C`,
      lastUpdate: new Date().toLocaleTimeString(),
      location: 'Transit - BioHub Alpha'
    };
  }

  static async getClinicalTrialStats() {
    return {
      encryptedRecords: 1245,
      activeTrials: 3,
      recentCIDs: []
    };
  }

  static async uploadClinicalRecord(patientData) {
    // Step 1: De-identification via Edge AI Agent (Ollama / Local LLM)
    let processedData = "De-identified content";
    try {
      const response = await fetch(`${BEZHAS_API_URL}/api/v1/agents/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'medical',
          message: `De-identify the following clinical record, removing names and exact dates: ${patientData}`,
          context: 'edge-ai-ehr'
        })
      });
      if (response.ok) {
        const data = await response.json();
        processedData = data.reply;
      }
    } catch (e) {
      console.warn("Medical AI offline. Using local heuristic de-identification.");
      processedData = patientData.replace(/[A-Z][a-z]+ [A-Z][a-z]+/g, "[REDACTED NAME]");
    }

    // Step 2: Simulate Encryption & IPFS Upload
    await new Promise(resolve => setTimeout(resolve, 1200)); // Simulating network latency
    
    // Generate a random mock IPFS CID (Content Identifier)
    const randomHex = Math.random().toString(16).substring(2, 10);
    const mockCid = `Qm${randomHex}XyZ${Date.now().toString().substring(5)}BioAgNt`;

    return {
      success: true,
      ipfsCid: mockCid,
      timestamp: new Date().toISOString(),
      deIdentifiedPreview: processedData.substring(0, 50) + "..."
    };
  }

  static async getGuardianStatus() {
    // Simulates checking the Aegis security contract on BeZhas L2
    return {
      totalGuardians: 3,
      activeApprovals: 2,
      recoveryMode: false,
      nodes: [
        { id: '0xabc...111', status: 'active', label: 'Hardware Key' },
        { id: '0xdef...222', status: 'active', label: 'Trusted Family' },
        { id: '0xghi...333', status: 'pending', label: 'Bio-Metric Vault' }
      ]
    };
  }

  static async requestGuardianRecovery() {
    // Simulates an on-chain transaction requesting the 3rd guardian to approve via PureScan
    await new Promise(resolve => setTimeout(resolve, 2000));
    return {
      success: true,
      transactionHash: '0x' + Math.random().toString(16).substring(2, 64),
      message: 'Recovery request broadcasted to Aegis network.'
    };
  }
}
