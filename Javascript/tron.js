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
  // Get the Tron address from the Ethereum address
  const ethAddress = meResponse.data.metadata.namespaces.eip155.address;
  const tronHexAddress = '41' + ethAddress.substring(2)
  const tronAddress = tnw.TronWeb.address.fromHex(tronHexAddress)
  // Setup simple transaction
  const tronWeb = new tnw.TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': '' }
  });
  console.log(`Tron Address: ${tronAddress}`);
  const fromTronHexAddress = tronWeb.address.toHex(tronAddress);
  
  const toHexAddress = '418840E6C55B9ADA326D211D818C34A994AECED808';
  const transactionBuidlerParsa = new tnw.TransactionBuilder(tronWeb);
  
  const transaction = await transactionBuidlerParsa.sendTrx(toHexAddress, 10, fromTronHexAddress);

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
  console.log(`Successfully signed Tron transaction with Signature: ${signature}`);
  transaction.signature = [signature];
  await tronWeb.trx.sendRawTransaction(transaction);
  console.log(`Successfully Submitted Transaction Hash with hash ${transaction.txID}`);
}

module.exports = {
    SignTron,
};
