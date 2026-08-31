import { useState } from 'react';
import { ethers } from 'ethers';
import { BezhasTokenAddress, BezhasTokenABI, BezhasBridgeAddress, BezhasBridgeABI } from '../contract-config';

// Define network configurations for CCIP
const networkConfig = {
  sepolia: {
    chainId: '11155111',
    chainSelector: '16015286601757825753',
    name: 'Sepolia',
  },
  amoy: {
    chainId: '80002',
    chainSelector: '12532609583862916517',
    name: 'Polygon Amoy',
  },
};

const Bridge = ({ signer }) => {
  const [amount, setAmount] = useState('');
  const [destinationChain, setDestinationChain] = useState(networkConfig.amoy.chainSelector);
  const [isBridging, setIsBridging] = useState(false);
  const [message, setMessage] = useState('');

  const handleBridge = async (e) => {
    e.preventDefault();
    if (!signer || !amount) {
      setMessage('Please connect your wallet and enter an amount.');
      return;
    }

    setIsBridging(true);
    setMessage('Bridging tokens...');

    try {
      const tokenContract = new ethers.Contract(BezhasTokenAddress, BezhasTokenABI, signer);
      const bridgeContract = new ethers.Contract(BezhasBridgeAddress, BezhasBridgeABI, signer);

      const tokensToSend = ethers.parseUnits(amount, 18);

      // 1. Approve the bridge contract to spend tokens
      setMessage('Approving token transfer...');
      const approveTx = await tokenContract.approve(BezhasBridgeAddress, tokensToSend);
      await approveTx.wait();
      setMessage('Approval successful! Initiating bridge transfer...');

      // 2. Call the bridge contract to transfer tokens
      const receiverAddress = await signer.getAddress();
      const transferTx = await bridgeContract.transferTokens(
        destinationChain,
        receiverAddress,
        tokensToSend
      );

      const receipt = await transferTx.wait();
      setMessage(`Bridge transaction successful! Transaction hash: ${receipt.hash}`);

    } catch (error) {
      console.error("Error during bridging:", error);
      setMessage(`Error: ${error.reason || error.message}`);
    } finally {
      setIsBridging(false);
    }
  };

  return (
    <div className="bridge-container card mt-4">
      <h2 className="card-title">Token Bridge</h2>
      <p>Transfer your BEZ tokens between Sepolia and Polygon Amoy.</p>
      <form onSubmit={handleBridge}>
        <div className="form-group">
          <label htmlFor="amount">Amount</label>
          <input
            type="number"
            id="amount"
            className="form-control"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="destination">To Network</label>
          <select
            id="destination"
            className="form-control"
            value={destinationChain}
            onChange={(e) => setDestinationChain(e.target.value)}
          >
            <option value={networkConfig.amoy.chainSelector}>Polygon Amoy</option>
            <option value={networkConfig.sepolia.chainSelector}>Sepolia</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary w-100" disabled={isBridging}>
          {isBridging ? 'Bridging...' : 'Bridge Tokens'}
        </button>
      </form>
      {message && (
        <div className="alert alert-info mt-3">
          <p>{message}</p>
        </div>
      )}
    </div>
  );
};

export default Bridge;
