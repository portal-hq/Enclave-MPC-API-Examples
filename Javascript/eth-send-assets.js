const axios = require('axios');
const fs = require('fs');
const { PORTAL_MPC_CLIENT_URL, ethRpc, PORTAL_API_URL } = require('./config');

async function SignEthAssets() {
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
  // Get the Tron address from the Ethereum address
  const ethAddress = meResponse.data.metadata.namespaces.eip155.address;
  console.log(`Eth Address: ${ethAddress}`);
  // Sign the transaction
  const signResponse = await axios.post(
    `${PORTAL_MPC_CLIENT_URL}/v1/assets/send`,
    {
        share: shares.SECP256K1.share,
        chain: 'eip155:11155111', // Or tron:mainnet or tron:shasta
        to: '0xdFd8302f44727A6348F702fF7B594f127dE3A902',
        token: 'NATIVE', // Or NATIVE USDT
        amount: "1",
        rpcUrl: ethRpc, // grpc url
    },
    {
      headers: { Authorization: `Bearer ${clientApiKey}` },
    },
  );
  if (signResponse.status != 200) {
    console.error('Failed to sign transaction:', signResponse.data);
    return;
  }
  console.log(
    `Successfully Eth signed transaction with signature:`, signResponse.data,
  );
}

module.exports = SignEthAssets;
