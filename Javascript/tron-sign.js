const axios = require('axios');
const tnw = require('tronweb');
const fs = require('fs');
const protobuf = require('protobufjs');

const { PORTAL_API_URL, PORTAL_MPC_CLIENT_URL } = require('./config');

// var rpcUrl = 'grpc.shasta.trongrid.io:50051?api_key=<API_KEY>';
var rpcUrl = 'grpc.nile.trongrid.io:50051?api_key=<API_KEY>';

async function SignTron() {
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
  const tronAddress = meResponse.data.metadata.namespaces.tron.address;
  console.log(`My Tron address ${tronAddress} and client id ${meResponse.data.id}`)


  const tronWeb = new tnw.TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': 'API_KEY' },
  });
  const fromTronHexAddress = tronWeb.address.toHex(tronAddress);
  const toHexAddress = '418840E6C55B9ADA326D211D818C34A994AECED808';
  const transactionBuidlerParsa = new tnw.TransactionBuilder(tronWeb);


  const transaction = await transactionBuidlerParsa.sendTrx(
    toHexAddress,
    1,
    fromTronHexAddress,
  );

  // // Serialize the transaction
  const txPb = tronWeb.utils.transaction.txJsonToPb(transaction)
  const rawData = txPb.getRawData().serializeBinary();

  // // Base64 encode the serialized transaction
  const base64Transaction = Buffer.from(rawData).toString('base64');

  // Sign the transaction
  const signResponse = await axios.post(
    `${PORTAL_MPC_CLIENT_URL}/v1/sign`,
    {
      share: shares.SECP256K1.share,
      method: 'tron_sendTransaction',
      rpcUrl,
      params: base64Transaction,
      chainId: 'tron:nile',
    },
    {
      headers: { Authorization: `Bearer ${clientApiKey}` },
    },
  );

  if (signResponse.status != 200) {
    console.error('Failed to sign transaction:', signResponse.data);
    return;
  }

  if (signResponse.status != 200) {
    console.error('Failed to sign transaction:', signResponse.data);
    return;
  }
  console.log(
    `Successfully signed and submitted Tron transaction ${signResponse.data.data}`,
  );
}

module.exports = {
  SignTron
};
