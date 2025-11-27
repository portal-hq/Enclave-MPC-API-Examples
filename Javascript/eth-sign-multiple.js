const axios = require('axios');
const fs = require('fs');
const {
  PORTAL_MPC_CLIENT_URL,
  PORTAL_API_URL,
  SEPOLIA_RPC_URL,
} = require('./config');
const { Web3 } = require('web3');

async function getNextNonce(address, rpcUrl) {
  console.log(`Fetching nonce for address: ${address} with rpcUrl: ${rpcUrl}`);
  const web3 = new Web3(rpcUrl);
  const nonce = await web3.eth.getTransactionCount(address);
  return nonce;
}

async function SignMultipleEth() {
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

  if (meResponse.status !== 200) {
    console.error('Failed to get client info:', meResponse.data);
    return;
  }

  const ethAddress = meResponse.data.metadata.namespaces.eip155.address;
  console.log(
    `My eth address ${ethAddress} and client id ${meResponse.data.id}`,
  );

  // Get the current nonce
  const currentNonce = await getNextNonce(ethAddress, SEPOLIA_RPC_URL);
  console.log(`Starting with nonce: ${currentNonce}`);

  // Send 5 transactions with incrementing nonces
  const numTransactions = 5;
  const transactions = [];

  for (let i = 0; i < numTransactions; i++) {
    const nonce = Number(currentNonce) + i;
    const hexNonce = '0x' + nonce.toString(16);

    const transactionParams = {
      nonce: hexNonce,
      value: '0x1',
      from: ethAddress,
      to: '0xdFd8302f44727A6348F702fF7B594f127dE3A902',
      data: '0x',
      maxFeePerGas: '0x2540BE400', // 10 Gwei
      maxPriorityFeePerGas: '0x3B9ACA00', // 1 Gwei
      gasLimit: '0x5208', // 21000
    };

    console.log(`Sending transaction with nonce ${hexNonce}`);

    try {
      const signResponse = await axios.post(
        `${PORTAL_MPC_CLIENT_URL}/v1/sign`,
        {
          share: shares.SECP256K1.share,
          method: 'eth_sendTransaction',
          params: JSON.stringify(transactionParams),
          rpcUrl: SEPOLIA_RPC_URL,
          chainId: 'eip155:11155111', // Sepolia chain ID
        },
        {
          headers: { Authorization: `Bearer ${clientApiKey}` },
        },
      );

      if (signResponse.status === 200) {
        transactions.push({
          nonce: hexNonce,
          hash: signResponse.data.data,
        });
        console.log(
          `Successfully signed transaction with nonce ${hexNonce}, hash: ${signResponse.data.data}`,
        );
      } else {
        console.error(
          `Failed to sign transaction with nonce ${hexNonce}:`,
          signResponse.data,
        );
      }
    } catch (error) {
      console.error(
        `Error signing transaction with nonce ${hexNonce}:`,
        error.message,
      );
    }

    // Add a small delay between transactions to prevent rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('\nTransaction Summary:');
  transactions.forEach((tx) => {
    console.log(`Nonce: ${tx.nonce}, Hash: ${tx.hash}`);
  });
}

module.exports = SignMultipleEth;
