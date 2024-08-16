const tnw = require('tronweb');
const axios = require('axios');
const { PORTAL_API_URL, PORTAL_MPC_CLIENT_URL } = require('./config');

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
  const tronWeb = new tnw.TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': '' }
  });
  console.log(`Tron Address: ${tronAddress}`);
  const fromTronHexAddress = tronWeb.address.toHex(tronAddress);
  console.log(`Tron Hex Address: ${fromTronHexAddress}`);
  const toHexAddress = '418840E6C55B9ADA326D211D818C34A994AECED808';
  const transactionBuidlerParsa = new tnw.TransactionBuilder(tronWeb);
  // console.log('Transaction Builder: ', transactionBuidlerParsa);
  const transaction = await transactionBuidlerParsa.sendTrx(toHexAddress, 100, fromTronHexAddress);
  console.log('Transaction: ', transaction);
  // tronWeb.trx.signMessageV2('message')
  console.log('Transaction Hash: ', transaction.txID);
  // Sign the message
  const signResponse = await axios.post(
    `${PORTAL_MPC_CLIENT_URL}/v1/raw/sign/SECP256K1`,
    {
      share: shares.SECP256K1.share,
      param: transaction.txID,
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
  console.log(`Successfully signed Tron transaction ${signature}`);
  transaction.signature = [signature];
  console.log('Signed Transaction: ', transaction);
  const result = await tronWeb.trx.sendRawTransaction(transaction);
  console.log('Transaction Result: ', result);
}

module.exports = {
    SignTron,
};
