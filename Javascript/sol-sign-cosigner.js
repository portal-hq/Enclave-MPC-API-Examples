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

async function CoSignTransactionWithCoSigner() {
  console.log('Starting co-signing process with Solana co-signer...');
  
  // Step 1: Read the co-signer's share and client API key
  const cosignerClientApiKey = fs.readFileSync('sol-cosigner-clientApiKey.txt', 'utf8');
  const cosignerShares = JSON.parse(fs.readFileSync('sol-cosigner-shares.txt', 'utf8'));
  
  // Step 2: Read the regular client's share and API key
  const clientApiKey = fs.readFileSync('clientApiKey.txt', 'utf8');
  const clientShares = JSON.parse(fs.readFileSync('shares.txt', 'utf8'));
  
  // Check if all credentials exist
  if (!cosignerShares || !cosignerClientApiKey || !clientShares || !clientApiKey) {
    console.error(
      'Missing credentials. Make sure to run both the regular signup/generate and createSolCoSigner scripts first!',
    );
    return;
  }
  
  // Step 3: Get addresses for both clients
  // Get co-signer address
  const cosignerResponse = await axios.get(`${PORTAL_API_URL}/api/v3/clients/me`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cosignerClientApiKey}`,
    },
  });
  
  if (cosignerResponse.status != 200) {
    console.error('Failed to get co-signer client info:', cosignerResponse.data);
    return;
  }
  
  // Get regular client address
  const clientResponse = await axios.get(`${PORTAL_API_URL}/api/v3/clients/me`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientApiKey}`,
    },
  });
  
  if (clientResponse.status != 200) {
    console.error('Failed to get client info:', clientResponse.data);
    return;
  }
  
  const cosignerSolanaAddress = cosignerResponse.data.metadata.namespaces.solana.address;
  const clientSolanaAddress = clientResponse.data.metadata.namespaces.solana.address;
  
  console.log(`Co-signer Solana address: ${cosignerSolanaAddress}`);
  console.log(`Client Solana address: ${clientSolanaAddress}`);
  
  // Step 4: Create a Solana transaction with co-signer as fee payer
  const fromPublicKey = new PublicKey(clientSolanaAddress);
  const toPublicKey = new PublicKey(
    'GPsPXxoQA51aTJJkNHtFDFYui5hN5UxcFPnheJEHa5Du',
  );
  const feePayerPublicKey = new PublicKey(cosignerSolanaAddress);
  
  const connection = new Connection(rpcUrl);
  const { blockhash } = await connection.getLatestBlockhash('finalized');
  
  let tx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: feePayerPublicKey,
  }).add(
    SystemProgram.transfer({
      fromPubkey: fromPublicKey,
      toPubkey: toPublicKey,
      lamports: LAMPORTS_PER_SOL * 0.00001, // 0.00001 SOL
    }),
  );
  
  // Serialize the transaction to a Buffer
  const serializedTransaction = tx.serialize({ requireAllSignatures: false });
  
  // Convert the serialized Buffer to a Base64 string
  const base64Transaction = serializedTransaction.toString('base64');
  
  // Step 5: Sign the transaction with the regular client
  console.log('Signing transaction with regular client...');
  const clientSignResponse = await axios.post(
    `${PORTAL_MPC_CLIENT_URL}/v1/sign`,
    {
      share: clientShares.ED25519.share,
      method: 'sol_signTransaction',
      params: base64Transaction,
      rpcUrl,
      chainId: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    },
    {
      headers: { Authorization: `Bearer ${clientApiKey}` },
    },
  );
  
  if (clientSignResponse.status != 200) {
    console.error('Failed to sign transaction with client:', clientSignResponse.data);
    return;
  }
  
  // Step 6: Convert the returned value from base58 to base64 and print it
  const clientSignatureBase58 = clientSignResponse.data.data;
  const clientSignatureBuffer = bs58.decode(clientSignatureBase58);
  const clientSignatureBase64 = clientSignatureBuffer.toString('base64');
  
  console.log(`Client signature (base58): ${clientSignatureBase58}`);
  console.log(`Client signature (base64): ${clientSignatureBase64}`);
  
  // Step 7: Decode the signed transaction and sign it again with the co-signer
  const clientSignedTransaction = Transaction.from(clientSignatureBuffer);
  
  // Serialize the partially signed transaction
  const partiallySignedTransaction = clientSignedTransaction.serialize({ requireAllSignatures: false });
  const partiallySignedBase64 = partiallySignedTransaction.toString('base64');
  
  console.log('Signing transaction with co-signer...');
  const cosignerSignResponse = await axios.post(
    `${PORTAL_MPC_CLIENT_URL}/v1/sign`,
    {
      share: cosignerShares.ED25519.share,
      method: 'sol_signTransaction',
      params: partiallySignedBase64,
      rpcUrl,
      chainId: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    },
    {
      headers: { Authorization: `Bearer ${cosignerClientApiKey}` },
    },
  );
  
  if (cosignerSignResponse.status != 200) {
    console.error('Failed to sign transaction with co-signer:', cosignerSignResponse.data);
    return;
  }
  
  // Step 8: Print the returned response after converting from base58 to base64
  const cosignerSignatureBase58 = cosignerSignResponse.data.data;
  const cosignerSignatureBuffer = bs58.decode(cosignerSignatureBase58);
  const cosignerSignatureBase64 = cosignerSignatureBuffer.toString('base64');
  
  console.log(`Co-signer signature (base58): ${cosignerSignatureBase58}`);
  console.log(`Co-signer signature (base64): ${cosignerSignatureBase64}`);
  
  // Verify the final transaction
  const finalTransaction = Transaction.from(cosignerSignatureBuffer);
  
  if (!finalTransaction.verifySignatures()) {
    console.error('Final transaction signatures are not valid');
    return;
  }
  
  console.log('\nTransaction is fully signed by both parties and is valid!');
  console.log(`From address: ${fromPublicKey.toBase58()}`);
  console.log(`Fee payer address: ${feePayerPublicKey.toBase58()}`);
  console.log(`To address: ${toPublicKey.toBase58()}`);
  console.log(`Amount: ${LAMPORTS_PER_SOL * 0.00001} SOL`);
}

// Run the function if this script is executed directly
if (require.main === module) {
  CoSignTransactionWithCoSigner().catch(console.error);
}

module.exports = {
  CoSignTransactionWithCoSigner,
};
