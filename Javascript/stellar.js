const StellarSdk = require('stellar-sdk');
const axios = require('axios');
const bs58 = require('bs58');
const crc = require('crc');
const fs = require('fs');
const { PORTAL_API_URL, PORTAL_MPC_CLIENT_URL } = require('./config');

async function SignStellar() {
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
  // Setup simple transaction
  const solanaAddress = meResponse.data.metadata.namespaces.solana.address;

  // Step 1: Decode Solana public key from base58
  const decodedKey = bs58.decode(solanaAddress);

  // Ensure that the decoded key is 32 bytes (ED25519 key length)
  if (decodedKey.length !== 32) {
    throw new Error('Invalid Solana public key length.');
  }

  // Encode the result using base32 (StrKey format used by Stellar)
  const stellarPublicKey = StellarSdk.StrKey.encodeEd25519PublicKey(decodedKey);
  console.log('Stellar Public Key:', stellarPublicKey);

  // Fund the Stellar account
  await fundStellarAccount(stellarPublicKey);

  // Set up Stellar transaction

  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org/',
  );

  const sourceAccount = await server.loadAccount(stellarPublicKey);
  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR', // example destination address
        asset: StellarSdk.Asset.native(),
        amount: '9', // amount to send
      }),
    )
    .setTimeout(30)
    .build();

  console.log('Transaction XDR:', transaction.toXDR());
  const transactionHashHex = transaction.hash().toString('hex');
  transaction.sign;
  console.log('Transaction Hash (Hex):', transactionHashHex);

  console.log(sourceAccount.balances);

  // Sign the transaction hash (the transaction must be signed before submission)
  const signResponse = await axios.post(
    `${PORTAL_MPC_CLIENT_URL}/v1/raw/sign/ED25519`,
    {
      share: shares.ED25519.share,
      param: transactionHashHex,
    },
    {
      headers: { Authorization: `Bearer ${clientApiKey}` },
    },
  );

  if (signResponse.status != 200) {
    console.error('Failed to sign message:', signResponse.data);
    return;
  }

  const signature = signResponse.data.data;
  console.log(`Successfully signed Stellar transaction: ${signature}`);
  // Step 1: Convert hex string to a byte array
  const byteArray = Buffer.from(signature, 'hex');

  // Step 2: Convert the byte array to a Base64-encoded string
  const base64Signature = byteArray.toString('base64');

  // Append the signature to the transaction
  transaction.addSignature(stellarPublicKey, base64Signature);
  try {
    // Submit the transaction to the Stellar network
    const result = await server.submitTransaction(transaction);
    console.log('Transaction Result:', result);
  } catch (error) {
    console.error('Error submitting transaction:', error.response.data);
    console.error('Error submitting transaction:', error.response.data.extras);
  }
}

async function fundStellarAccount(stellarPublicKey) {
  try {
    // Fund the new Stellar account using Friendbot on the testnet
    const response = await axios.get(
      `https://friendbot.stellar.org?addr=${stellarPublicKey}`,
    );

    console.log(`Successfully funded Stellar account: ${stellarPublicKey}`);
    console.log('Friendbot response:', response.data);

    return response.data;
  } catch (error) {
    console.error('Error funding the account with Friendbot:', error.message);
  }
}

module.exports = {
  SignStellar,
};
