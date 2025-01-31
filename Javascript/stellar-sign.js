const axios = require('axios');
const StellarSdk = require('stellar-sdk');
const fs = require('fs');

const { PORTAL_API_URL, PORTAL_MPC_CLIENT_URL } = require('./config');

var rpcUrl = 'https://horizon-testnet.stellar.org';

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
  const stellarAddress = meResponse.data.metadata.namespaces.stellar.address;
  console.log(`My stellar address ${stellarAddress} and client id ${meResponse.data.id}`)
// 
  const server = new StellarSdk.Horizon.Server(rpcUrl);
  // Check if the destination account exists
  const destinationAddress = "GDDRVYLDWMDZ2YEPDN6CIXD3ZJMCKTA4VEPZA2UYZBXSZDWIUMPGZE42"
  let destinationAccountExists = true;
  try {
    await server.loadAccount(destinationAddress);
  } catch (error) {
    if (error instanceof StellarSdk.NotFoundError) {
      destinationAccountExists = false;
    } else {
      throw error; // Unexpected error, rethrow
    }
  }

  // If the destination account doesn't exist, create it
  if (!destinationAccountExists) {
    console.log(`Destination address ${destinationAddress} does not exist, creating it now...`)
    const sourceAccount = await server.loadAccount(stellarAddress);
    const createAccountTransaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.PUBLIC, // Defaulting to testnet
    })
      .addOperation(
        StellarSdk.Operation.createAccount({
          destination: destinationAddress,
          startingBalance: '3', // Minimum starting balance required
        }),
      )
      .setTimeout(0)
      .build();

    // Sign and submit the transaction
    // Serialize the transaction to XDR
    const serializedTransaction = createAccountTransaction.toXDR()

    // // Convert the serialized Buffer to a Base64 string
    const base64Transaction = serializedTransaction.toString('base64');

    // // Sign the transaction
    const signResponse = await axios.post(
      `${PORTAL_MPC_CLIENT_URL}/v1/sign`,
      {
        share: shares.ED25519.share,
        method: 'stellar_sendTransaction',
        rpcUrl,
        params: base64Transaction,
        chainId: 'stellar:testnet',
      },
      {
        headers: { Authorization: `Bearer ${clientApiKey}` },
      },
    );
    console.log("SignResponse: ", signResponse)
    if (signResponse.status != 200) {
      console.error('Failed to sign transaction:', signResponse.data);
      return;
    }
    console.log(
      `Successfully signed Stellar transaction ${signResponse.data.data}`,
    );
    console.log(`Successfully created address ${destinationAddress}!`)
    return;
  }


  const sourceAccount = await server.loadAccount(stellarAddress);
  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET, // Defaulting to testnet
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: destinationAddress, // example destination address
        asset: StellarSdk.Asset.native(),
        amount: '1', // amount to send
      }),
    )
    .setTimeout(30)
    .build();

  // Serialize the transaction to XDR
  const serializedTransaction = transaction.toXDR()

  // // Convert the serialized Buffer to a Base64 string
  const base64Transaction = serializedTransaction.toString('base64');

  // // Sign the transaction
  const signResponse = await axios.post(
    `${PORTAL_MPC_CLIENT_URL}/v1/sign`,
    {
      share: shares.ED25519.share,
      method: 'stellar_sendTransaction',
      rpcUrl,
      params: base64Transaction,
      chainId: 'stellar:testnet',
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
    `Successfully signed Stellar transaction ${signResponse.data.data}`,
  );
}

module.exports = {
  SignStellar
};
