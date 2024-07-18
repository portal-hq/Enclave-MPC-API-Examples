const axios = require('axios');
const fs = require('fs');
const { PORTAL_MPC_CLIENT_URL, ethRpc } = require('./config');

async function SignEth() {
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

  // Below is an example of an Ethereum eip1559 transaction
  const transactionParams = {
    maxFeePerGas: '0x2540BE400',
    nonce: '0x01',
    maxPriorityFeePerGas: '0x3B9ACA00',
    value: '0x3B9ACA00',
    from: '0xabda788be4d93f40f38a8ba47c32a2f2874564be',
    to: '0xcae0d97d201ad54275b6e8a6b547c7611ad47963',
    data: '',
    gasLimit: '0x3B9ACA00',
  };
  // Sign the transaction
  const signResponse = await axios.post(
    `${PORTAL_MPC_CLIENT_URL}/v1/sign`,
    {
      share: shares.SECP256K1.share,
      method: 'eth_signTransaction',
      params: JSON.stringify(transactionParams),
      rpcUrl: ethRpc,
      chainId: 'eip155:11155111', // Sepolia chain ID
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
    `Successfully Eth signed transaction with signature ${signResponse.data.data}!`,
  );
}

module.exports = SignEth;
