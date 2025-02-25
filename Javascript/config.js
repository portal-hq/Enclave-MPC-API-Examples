require('dotenv').config();

const PORTAL_API_URL = 'https://api.portalhq.io';
const PORTAL_MPC_CLIENT_URL = 'https://mpc-client.portalhq.io:443';
const PORTAL_EX = 'https://portalex-mpc.portalhq.io';

const ethRpc =
   'https://eth-sepolia.g.alchemy.com/v2/';

const BLOCKCYPHER_API_URL = 'https://api.blockcypher.com/v1/btc/test3'
const BLOCKCYPHER_TOKEN = process.env.BLOCKCYPHER_TOKEN || ""
const BITCOIN_FEE_RATE = 10 // satoshis per byte
const BITCOIN_DUST_LIMIT = 546 // minimum output value in satoshis
const TATUM_API_KEY = '';
const TATUM_API_URL = 'https://api.tatum.io/v3';

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
