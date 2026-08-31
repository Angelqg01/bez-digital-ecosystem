import { useEffect, useCallback } from 'react';
import { useWeb3 } from '../context/Web3Context';

/**
 * @dev Custom hook to subscribe to a smart contract event.
 * Handles the lifecycle of the event listener, subscribing on mount
 * and unsubscribing on unmount.
 * @param {string} contractName The name of the contract in the Web3Context (e.g., 'stakingPool').
 * @param {string} eventName The name of the event to listen to (e.g., 'Staked').
 * @param {Function} callback The function to execute when the event is triggered.
 */
export const useContractEvent = (contractName, eventName, callback) => {
  const { contracts } = useWeb3();

  // Memoize the callback to prevent re-subscribing on every render
  const memoizedCallback = useCallback(callback, [callback]);

  useEffect(() => {
    const contract = contracts[contractName];

    if (!contract) {
      console.warn(`Contract "${contractName}" not found for event listener.`);
      return;
    }

    console.log(`Subscribing to "${eventName}" on "${contractName}"`);
    contract.on(eventName, memoizedCallback);

    // Cleanup function to unsubscribe when the component unmounts
    return () => {
      console.log(`Unsubscribing from "${eventName}" on "${contractName}"`);
      contract.off(eventName, memoizedCallback);
    };
  }, [contractName, eventName, memoizedCallback, contracts]);
};
