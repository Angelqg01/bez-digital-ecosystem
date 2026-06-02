// Direcciones y ABIs de los contratos BeZhas
import BeZhasRealEstateAbi from '../../../artifacts/contracts/BeZhasRealEstate.sol/BeZhasRealEstate.json';
import LogisticsContainerAbi from '../../../artifacts/contracts/LogisticsContainer.sol/LogisticsContainer.json';

// Usar una dirección válida por defecto si no hay variable de entorno (ej. dirección local de Hardhat)
// Si la dirección es un string inválido como "DIRECCION_DEL_CONTRATO...", ethers fallará al intentar resolverlo como nombre ENS.
export const REALESTATE_CONTRACT_ADDRESS = import.meta.env.VITE_REALESTATE_CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
export const LOGISTICS_CONTRACT_ADDRESS = import.meta.env.VITE_LOGISTICS_CONTRACT_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

export const BeZhasRealEstateABI = BeZhasRealEstateAbi.abi;
export const LogisticsContainerABI = LogisticsContainerAbi.abi;
