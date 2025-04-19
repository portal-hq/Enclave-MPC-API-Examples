const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { PORTAL_API_URL, PORTAL_MPC_CLIENT_URL, PORTAL_EX } = require('./config');

async function signupCoSigner(args = []) {
  console.log('Signing up co-signer user...');
  
  // Check if isAA is provided in the arguments
  const isAccountAbstracted = args.includes('isAA');
  const now = new Date();
  const myUUID = uuidv4();
  const username = 'sol-cosigner-' + now.toISOString() + myUUID;
  
  const portalExResponse = await axios.post(
    `${PORTAL_EX}/mobile/signup`,
    { username: username, isAccountAbstracted },
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );
  
  if (portalExResponse.status != 200) {
    console.error('Failed to sign up co-signer:', portalExResponse.data);
    return null;
  }
  
  console.log(`Successfully signed up co-signer user ${username}!`);
  return portalExResponse.data.clientApiKey;
}

async function generateCoSigner(clientApiKey) {
  console.log('Generating MPC shares for co-signer...');
  
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
    return null;
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
    return null;
  }
  
  return generateResponse.data;
}

async function createSolCoSigner() {
  console.log('Creating Solana co-signer wallet...');
  
  // Step 1: Sign up a new user
  const clientApiKey = await signupCoSigner();
  if (!clientApiKey) {
    console.error('Failed to sign up co-signer user.');
    return;
  }
  console.log('Co-signer signup completed successfully.');
  
  // Step 3: Generate wallet and shares directly (not using the Generate function)
  const shares = await generateCoSigner(clientApiKey);
  if (!shares) {
    console.error('Failed to generate co-signer wallet.');
    return;
  }
  console.log('Wallet generation completed successfully.');
  
  // Step 4: Save the clientApiKey and shares to specific files for the Solana co-signer
  fs.writeFileSync('sol-cosigner-clientApiKey.txt', clientApiKey);
  fs.writeFileSync('sol-cosigner-shares.txt', JSON.stringify(shares));
  console.log('Saved co-signer credentials to sol-cosigner-clientApiKey.txt and sol-cosigner-shares.txt');
  
  // Step 5: Get and print the Solana address
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
  
  const solanaAddress = meResponse.data.metadata.namespaces.solana.address;
  console.log('\n==========================================================');
  console.log(`Solana Address: ${solanaAddress}`);
  console.log('==========================================================');
  console.log('Please fund this address to use the co-signer wallet.');
}

module.exports = createSolCoSigner;

// Run the function if this script is executed directly
if (require.main === module) {
  createSolCoSigner().catch(console.error);
}
