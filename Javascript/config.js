require('dotenv').config();

// Environment configuration
const ENV = process.env.NODE_ENV || 'DEV';

// Get configuration values from environment variables
const PORTAL_API_URL = process.env[`${ENV}_PORTAL_API_URL`];
const PORTAL_MPC_CLIENT_URL = process.env[`${ENV}_PORTAL_MPC_CLIENT_URL`];
const PORTAL_EX = process.env[`${ENV}_PORTAL_EX`];

// Common configuration from environment variables
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const SEPOLIA_RPC_URL = process.env.ETH_SEPOLIA_RPC_URL;
const BLOCKCYPHER_API_URL = process.env.BLOCKCYPHER_API_URL;
const BLOCKCYPHER_TOKEN = process.env.BLOCKCYPHER_TOKEN || '';
const BITCOIN_FEE_RATE = parseInt(process.env.BITCOIN_FEE_RATE || '10', 10); // satoshis per byte
const BITCOIN_DUST_LIMIT = parseInt(
  process.env.BITCOIN_DUST_LIMIT || '546',
  10,
); // minimum output value in satoshis
const TATUM_API_KEY = process.env.TATUM_API_KEY;
const TATUM_API_URL = process.env.TATUM_API_URL;

const getAlchemyRpcUrl = (chainId) => {
  console.log(`Getting Alchemy RPC URL for chainId: ${chainId}`);
  switch (chainId) {
    case 'eip155:8453':
      return `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    case 'eip155:11155111':
      return `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    default:
      throw new Error(`Unsupported chainId: ${chainId}`);
  }
};

module.exports = {
  ALCHEMY_API_KEY,
  BITCOIN_DUST_LIMIT,
  BITCOIN_FEE_RATE,
  BLOCKCYPHER_API_URL,
  BLOCKCYPHER_TOKEN,
  PORTAL_API_URL,
  PORTAL_EX,
  PORTAL_MPC_CLIENT_URL,
  SEPOLIA_RPC_URL,
  TATUM_API_KEY,
  TATUM_API_URL,
  getAlchemyRpcUrl,
};
