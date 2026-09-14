/**
 * @deprecated — LEGACY SERVICE. Staking operations now live in bez-wallet SubApp.
 * Replacement: bez-wallet/src/services/walletBlockchainService.js
 * The Hub should link to bez-wallet/staking instead of handling staking directly.
 *
 * @dev A service module for interacting with the StakingPool smart contract.
 * It encapsulates all the blockchain interaction logic, keeping components clean.
 *
 * NOTA: el bloque `@deprecated` y los imports se habían insertado en mitad de
 * este comentario, dejando huérfanas las dos líneas de `@dev` y el cierre que
 * venía detrás. El fichero no parseaba, y no saltaba en el build solo porque
 * nada lo importa.
 */
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';
import { safeApprove } from '../utils/safeApprove';

/**
 * @dev Fetches staking data for a given user address.
 * @param {ethers.Contract} stakingPoolContract The staking pool contract instance.
 * @param {string} address The user's address.
 * @returns {Promise<Object>} An object containing stakedBalance and rewards.
 */
export const fetchUserStakingData = async (stakingPoolContract, address) => {
  if (!stakingPoolContract || !address) {
    throw new Error('Staking contract or user address not provided.');
  }
  try {
    const [stakeInfo, earnedRewards] = await Promise.all([
      stakingPoolContract.stakes(address),
      stakingPoolContract.earned(address),
    ]);
    return {
      stakedBalance: ethers.formatEther(stakeInfo.amount),
      rewards: ethers.formatEther(earnedRewards),
    };
  } catch (error) {
    console.error("Error fetching user staking data:", error);
    toast.error('Could not load your staking data.');
    return { stakedBalance: '0', rewards: '0' };
  }
};

/**
 * @dev Handles the entire stake process, including token approval.
 * @param {ethers.Contract} stakingPoolContract The staking pool contract instance.
 * @param {ethers.Contract} tokenContract The token contract instance.
 * @param {string} amount The amount to stake (in ether format).
 * @param {string} userAddress The user's address.
 */
export const stakeTokens = async (stakingPoolContract, tokenContract, amount, userAddress) => {
  const parsedAmount = ethers.parseEther(amount);

  // 1. Check allowance and approve if necessary.
  //
  // Éste era el caso de libro de la carrera del ERC-20: al aprobar justo
  // `parsedAmount` cuando ya había una asignación parcial viva, se pasaba de un
  // valor distinto de cero a otro, y el gastador podía quedarse con los dos.
  // `safeApprove` elige la vía segura según el token.
  const allowance = await tokenContract.allowance(userAddress, stakingPoolContract.target);
  if (allowance < parsedAmount) {
    toast.loading('Approving token spend...', { id: 'approve' });
    await safeApprove(tokenContract, userAddress, stakingPoolContract.target, parsedAmount);
    toast.success('Token approved!', { id: 'approve' });
  }

  // 2. Perform the stake transaction
  const stakeTx = await stakingPoolContract.stake(parsedAmount);
  toast.loading('Processing stake transaction...', { id: 'stake' });
  await stakeTx.wait();
  toast.success('Stake successful!', { id: 'stake' });
};

/**
 * @dev Handles the unstake process.
 * @param {ethers.Contract} stakingPoolContract The staking pool contract instance.
 * @param {string} amount The amount to unstake (in ether format).
 */
export const unstakeTokens = async (stakingPoolContract, amount) => {
  const parsedAmount = ethers.parseEther(amount);
  const unstakeTx = await stakingPoolContract.unstake(parsedAmount);
  toast.loading('Processing unstake transaction...', { id: 'unstake' });
  await unstakeTx.wait();
  toast.success('Unstake successful!', { id: 'unstake' });
};

/**
 * @dev Handles the reward claim process.
 * @param {ethers.Contract} stakingPoolContract The staking pool contract instance.
 */
export const claimRewards = async (stakingPoolContract) => {
  const claimTx = await stakingPoolContract.claimReward();
  toast.loading('Processing claim transaction...', { id: 'claim' });
  await claimTx.wait();
  toast.success('Rewards claimed!', { id: 'claim' });
};
