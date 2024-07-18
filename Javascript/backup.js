const axios = require('axios');
const fs = require('fs');
const { PORTAL_API_URL, PORTAL_MPC_CLIENT_URL } = require('./config');

async function Backup() {
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

  // Backup MPC shares
  const backupResponse = await axios.post(
    `${PORTAL_MPC_CLIENT_URL}/v1/backup`,
    {
      generateResponse: JSON.stringify(shares),
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clientApiKey}`,
      },
    },
  );
  if (backupResponse.status != 200) {
    console.error('Failed to backup MPC shares:', backupResponse.data);
    return;
  }
  const { SECP256K1, ED25519 } = backupResponse.data;
  console.log(
    `Successfully backed up MPC shares ${SECP256K1.id} and ${ED25519.id}!`,
  );

  const patchResponse = await axios.patch(
    `${PORTAL_API_URL}/api/v3/clients/me/backup-share-pairs`,
    {
      status: 'STORED_CLIENT_BACKUP_SHARE',
      backupSharePairIds: [SECP256K1.id, ED25519.id],
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

  // Write backup shares to file
  fs.writeFileSync('backupShares.txt', JSON.stringify(backupResponse.data));
  console.log('Successfully updated MPC shares status!');
}

module.exports = Backup;
