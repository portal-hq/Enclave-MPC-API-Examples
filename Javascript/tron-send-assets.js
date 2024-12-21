const axios = require('axios');
const tnw = require('tronweb');
const fs = require('fs');
const protobuf = require('protobufjs');

const { PORTAL_API_URL, PORTAL_MPC_CLIENT_URL } = require('./config');

var rpcUrl = 'grpc.nile.trongrid.io:50051?api_key=API_KEY'

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

  const signResponse = await axios.post(
    `${PORTAL_MPC_CLIENT_URL}/v1/assets/send`,
    {
      share: shares.SECP256K1.share,
      chain: 'tron:nile', // Or tron:mainnet or tron:shasta
      to: 'TKF4o1BhWqftkmvYC1DmCdMfdXkULoVNbT',
      token: 'USDT', // Or NATIVE
      amount: "0.1",
      rpcUrl: rpcUrl, // grpc url
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
    `Successfully signed Stellar transaction ${signResponse.data.transactionHash}`,
  );
}

module.exports = {
  SignTron
};
