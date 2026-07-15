const axios = require('axios');
const fs = require('fs');
const {
  PORTAL_MPC_CLIENT_URL,
  SEPOLIA_RPC_URL,
  PORTAL_API_URL,
} = require('./config');

// The chain to send on. Accepts a CAIP-2 chain ID (e.g. eip155:11155111 for
// Ethereum Sepolia) or a friendly name like "sepolia" or "base".
const CHAIN = 'eip155:11155111';

// Recipient address and amount. The amount is in human units, so "1" sends
// 1 token (the enclave handles each token's decimals for you).
const TO_ADDRESS = '0xdFd8302f44727A6348F702fF7B594f127dE3A902';
const AMOUNT = '1';

/**
 * Sends a token from the client's wallet using Portal's enclave `assets/send`
 * endpoint. The endpoint builds, signs, and broadcasts the transfer for you, so
 * you never have to hand-build the transaction (no contract ABI, no gas
 * estimation, no nonce management).
 *
 * @param {Object} [options]
 * @param {string} [options.token] The asset to send. Use "NATIVE" for the
 *   chain's native coin, a shorthand like "USDC" or "USDT", or a raw ERC-20
 *   contract address (e.g. '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' for
 *   USDC on Sepolia) if the shorthand isn't supported on your chain.
 * @param {boolean} [options.sponsorGas] Selects between the two supported flows:
 *   - AA flow (true): requires an Account Abstraction client, created at signup
 *     with `isAccountAbstracted: true` (run `yarn signup isAA`). Portal sponsors
 *     the gas, so the wallet does NOT need to hold any native token. Omitting
 *     sponsorGas produces the same behavior for AA clients.
 *   - Non-AA flow (false): a standard EOA wallet pays its own gas and MUST hold
 *     the chain's native token (e.g. Sepolia ETH). Without it, the request fails
 *     with an insufficient-balance error even when the wallet holds plenty of
 *     the token being sent.
 */
async function sendAsset({ token = 'NATIVE', sponsorGas } = {}) {
  // Read clientApiKey from file
  const clientApiKey = fs.readFileSync('clientApiKey.txt', 'utf8');

  // Read shares from file
  const shares = JSON.parse(fs.readFileSync('shares.txt', 'utf8'));

  // Check if shares and clientApiKey exist
  if (!shares || !clientApiKey) {
    console.error(
      'No shares or clientApiKey found, make sure to run the generate script first!',
    );
    return;
  }

  // Look up the wallet's EVM address so we can log who is sending.
  const meResponse = await axios.get(`${PORTAL_API_URL}/api/v3/clients/me`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientApiKey}`,
    },
  });
  if (meResponse.status != 200) {
    console.error('Failed to get client info:', meResponse.data);
    return;
  }
  const ethAddress = meResponse.data.metadata.namespaces.eip155.address;
  console.log(
    `Sending ${AMOUNT} ${token} from ${ethAddress} (sponsorGas=${sponsorGas})`,
  );

  // Send the asset. The enclave builds the transfer, signs it with the MPC
  // share, and broadcasts it through the provided RPC URL.
  const sendResponse = await axios.post(
    `${PORTAL_MPC_CLIENT_URL}/v1/assets/send`,
    {
      share: shares.SECP256K1.share,
      chain: CHAIN, // Or tron:mainnet, solana, etc.
      to: TO_ADDRESS,
      token, // NATIVE, USDC, USDT, or an ERC-20 contract address
      amount: AMOUNT,
      rpcUrl: SEPOLIA_RPC_URL,
      // `sponsorGas` only affects Account Abstraction clients. It is ignored for
      // standard clients (which always pay their own gas). Leaving it undefined
      // omits it from the request entirely.
      ...(sponsorGas === undefined ? {} : { sponsorGas }),
    },
    {
      headers: { Authorization: `Bearer ${clientApiKey}` },
    },
  );
  if (sendResponse.status != 200) {
    console.error('Failed to send transaction:', sendResponse.data);
    return;
  }
  console.log('Successfully sent transaction:', sendResponse.data);
}

/**
 * Sends the chain's native token (e.g. Sepolia ETH).
 */
async function SignEthAssets() {
  await sendAsset({ token: 'NATIVE' });
}

/**
 * AA flow: sends USDC with Portal sponsoring the gas. Requires an Account
 * Abstraction client (`yarn signup isAA`); the wallet does not need native gas.
 */
async function SendUsdcWithGasSponsorship() {
  await sendAsset({ token: 'USDC', sponsorGas: true });
}

/**
 * Non-AA flow: sends USDC where the wallet pays its own gas. The wallet must
 * hold the chain's native token (e.g. Sepolia ETH) to cover gas.
 */
async function SendUsdcPayingOwnGas() {
  await sendAsset({ token: 'USDC', sponsorGas: false });
}

module.exports = {
  sendAsset,
  SignEthAssets,
  SendUsdcWithGasSponsorship,
  SendUsdcPayingOwnGas,
};
