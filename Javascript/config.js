require('dotenv').config();

const PORTAL_API_URL = 'https://api.portalhq.io';
const PORTAL_MPC_CLIENT_URL = 'https://mpc-client.portalhq.io:443';
const PORTAL_EX = 'https://portalex-mpc.portalhq.io';

const ethRpc =
  process.env.ETH_RPC_URL || 'https://sepolia.infura.io/v3/<API_KEY>';

module.exports = {
  PORTAL_API_URL,
  PORTAL_MPC_CLIENT_URL,
  PORTAL_EX,
  ethRpc,
};
