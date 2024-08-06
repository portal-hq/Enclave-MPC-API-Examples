const axios = require('axios');
const fs = require('fs');
const bs58 = require('bs58');
const nacl = require('tweetnacl');
const { decodeUTF8 } = require('tweetnacl-util');
const {
  Connection,
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
  Keypair,
} = require('@solana/web3.js');
const { PORTAL_API_URL, PORTAL_MPC_CLIENT_URL } = require('./config');

var rpcUrl = 'https://api.devnet.solana.com';

async function SignSol(feePayerAddress) {
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
  const fromPublicKey = new PublicKey(solanaAddress);
  const toPublicKey = new PublicKey(
    'GPsPXxoQA51aTJJkNHtFDFYui5hN5UxcFPnheJEHa5Du',
  );
  const connection = new Connection(rpcUrl);
  const { blockhash } = await connection.getLatestBlockhash('finalized');
  let tx = new Transaction({
    recentBlockhash: blockhash,
    feePayer:
      feePayerAddress !== '' ? new PublicKey(feePayerAddress) : fromPublicKey,
  }).add(
    SystemProgram.transfer({
      fromPubkey: fromPublicKey,
      toPubkey: toPublicKey,
      lamports: LAMPORTS_PER_SOL * 0.00001, // 0.01 SOL
    }),
  );

  // Serialize the transaction to a Buffer
  const serializedTransaction = tx.serialize({ requireAllSignatures: false });

  // Convert the serialized Buffer to a Base64 string
  const base64Transaction = serializedTransaction.toString('base64');

  // Sign the transaction
  const signResponse = await axios.post(
    `${PORTAL_MPC_CLIENT_URL}/v1/sign`,
    {
      share: shares.ED25519.share,
      method: 'sol_signTransaction',
      params: base64Transaction,
      rpcUrl,
      chainId: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
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
    `Successfully signed Solana transaction ${signResponse.data.data}`,
  );

  const transactionBuffer = bs58.decode(signResponse.data.data);

  const transaction = Transaction.from(transactionBuffer);

  return {
    transaction,
    firstSignature: signResponse.data.data,
  };
}

async function CoSignTransaction() {
  // Generate a local keypair
  const localKeypair = Keypair.generate();

  console.log(`Fee payer: ${localKeypair.publicKey.toBase58()}`);

  const { transaction, firstSignature } = await SignSol(
    localKeypair.publicKey.toBase58(),
  );

  // Partially sign the transaction using the local keypair
  transaction.partialSign(localKeypair);

  // Verify if the transaction is fully signed
  if (!transaction.verifySignatures()) {
    console.error('Transaction signatures are not valid');
    return;
  }

  console.log(`Transaction is fully signed by both parties and it is valid`);
}

async function SignSolMessage(message) {
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
  // Setup message params
  const messageParams = JSON.stringify([message]);
  // Sign the message
  const signResponse = await axios.post(
    `${PORTAL_MPC_CLIENT_URL}/v1/sign`,
    {
      share: shares.ED25519.share,
      method: 'sol_signMessage',
      params: messageParams,
      rpcUrl,
      chainId: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
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
  console.log(`Successfully signed Solana message ${signature}`);
  // Setup Solana public key
  const solanaAddress = meResponse.data.metadata.namespaces.solana.address;
  const fromPublicKey = new PublicKey(solanaAddress);

  // Decode the message
  const messageBytes = decodeUTF8(message);

  // Convert base58 encoded signature to Uint8Array
  const uint8ArraySignature = bs58.decode(signature);

  // Verify the signature
  const isCorrectSigture = nacl.sign.detached.verify(
    messageBytes,
    uint8ArraySignature,
    fromPublicKey.toBytes(),
  );
  console.log(`Signature verification successful: ${isCorrectSigture}`);
  return;
}

module.exports = {
  SignSol,
  SignSolMessage,
  CoSignTransaction,
};
