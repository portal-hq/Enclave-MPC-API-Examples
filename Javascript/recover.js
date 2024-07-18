const axios = require('axios');
const fs = require('fs');
const { PORTAL_API_URL, PORTAL_MPC_CLIENT_URL } = require('./config');

async function Recover() {
  // Read clientApiKey from file
  const clientApiKey = fs.readFileSync('clientApiKey.txt', 'utf8');

  // Read shares from file
  const shares = JSON.parse(fs.readFileSync('backupShares.txt', 'utf8'));

  // Check if shares and clientApiKey exist
  if (!shares || !clientApiKey) {
    console.error(
      'No shares or clientApiKey found, make sure to run the generate script first!',
    );
    return;
  }

  const recoverResponse = await axios.post(
    `${PORTAL_MPC_CLIENT_URL}/v1/recover`,
    {
      backupResponse: JSON.stringify(shares),
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clientApiKey}`,
      },
    },
  );
  if (recoverResponse.status != 200) {
    console.error('Failed to recover MPC shares:', recoverResponse.data);
    return;
  }
  const { SECP256K1, ED25519 } = recoverResponse.data;
  console.log(
    'Successfully recovered signing shares with ID:',
    SECP256K1.id,
    ED25519.id,
  );
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
  console.log('Successfully updated MPC shares status!');
}

module.exports = Recover;
