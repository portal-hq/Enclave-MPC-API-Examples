require('dotenv').config();

// Environment configuration
const ENV = process.env.NODE_ENV || 'DEV';

// Get configuration values from environment variables
const PORTAL_API_URL = process.env[`${ENV}_PORTAL_API_URL`];
const PORTAL_MPC_CLIENT_URL = process.env[`${ENV}_PORTAL_MPC_CLIENT_URL`];
const PORTAL_EX = process.env[`${ENV}_PORTAL_EX`];

// Common configuration from environment variables
const ethRpc = process.env.ETH_RPC_URL;
const BLOCKCYPHER_API_URL = process.env.BLOCKCYPHER_API_URL;
const BLOCKCYPHER_TOKEN = process.env.BLOCKCYPHER_TOKEN || "";
const BITCOIN_FEE_RATE = parseInt(process.env.BITCOIN_FEE_RATE || "10", 10); // satoshis per byte
const BITCOIN_DUST_LIMIT = parseInt(process.env.BITCOIN_DUST_LIMIT || "546", 10); // minimum output value in satoshis
const TATUM_API_KEY = process.env.TATUM_API_KEY;
const TATUM_API_URL = process.env.TATUM_API_URL;

module.exports = {
  PORTAL_API_URL,
  PORTAL_MPC_CLIENT_URL,
  PORTAL_EX,
  ethRpc,
  BLOCKCYPHER_API_URL,
  BLOCKCYPHER_TOKEN,
  BITCOIN_FEE_RATE,
  BITCOIN_DUST_LIMIT,
  TATUM_API_KEY,
  TATUM_API_URL
};
