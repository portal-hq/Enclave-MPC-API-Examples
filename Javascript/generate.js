const axios = require('axios');
const fs = require('fs');
const { PORTAL_API_URL, PORTAL_MPC_CLIENT_URL } = require('./config');

async function Generate() {
  // Read clientApiKey from file
  const clientApiKey = fs.readFileSync('clientApiKey.txt', 'utf8');
  if (!clientApiKey) {
    console.error(
      'No clientApiKey found, make sure to run the signup script first!',
    );
    return;
  }

  // Generate MPC shares
  const generateResponse = await axios.post(
    `${PORTAL_MPC_CLIENT_URL}/v1/generate`,
    {},
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clientApiKey}`,
      },
    },
  );
  if (generateResponse.status != 200) {
    console.error('Failed to generate MPC shares:', generateResponse.data);
    return;
  }
  const { SECP256K1, ED25519 } = generateResponse.data;
  console.log(
    `Successfully generated MPC shares ${SECP256K1.id} and ${ED25519.id}!`,
  );

  // Update MPC shares status
  const patchResponse = await axios.patch(
    `${PORTAL_API_URL}/api/v3/clients/me/signing-share-pairs`,
    {
      status: 'STORED_CLIENT',
      signingSharePairIds: [SECP256K1.id, ED25519.id],
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clientApiKey}`,
      },
    },
  );
  if (patchResponse.status != 204) {
    console.error('Failed to update MPC shares status:', patchResponse.data);
    return;
  }
  // Write shares to file
  fs.writeFileSync('shares.txt', JSON.stringify(generateResponse.data));

  // Get wallet addresses
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
  // Setup simple transaction
  const solanaAddress = meResponse.data.metadata.namespaces.solana.address;
  const eip155Address = meResponse.data.metadata.namespaces.eip155.address;
  console.log(
    `Successfully generated wallets with Solana address ${solanaAddress} and Eth address ${eip155Address}!`,
  );
}

module.exports = Generate;
