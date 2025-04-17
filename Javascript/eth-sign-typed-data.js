const axios = require('axios');
const fs = require('fs');
const { PORTAL_MPC_CLIENT_URL, ethRpc } = require('./config');

async function SignEthTypedData() {
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

  // The typed data payload to sign
  // First element is the address, second element is the typed data JSON string
  const typedDataPayload = [
    "0xaeabe5b13828f691fdb56007502ef9035c95e8b2",
    `{
      "types": {
        "EIP712Domain": [
          {"name": "name", "type": "string"},
          {"name": "version", "type": "string"},
          {"name": "chainId", "type": "uint256"},
          {"name": "verifyingContract", "type": "address"}
        ],
        "Person": [
          {"name": "name", "type": "string"},
          {"name": "wallet", "type": "address"}
        ],
        "Mail": [
          {"name": "from", "type": "Person"},
          {"name": "to", "type": "Person"},
          {"name": "contents", "type": "string"}
        ]
      },
      "primaryType": "Mail",
      "domain": {
        "name": "Ether Mail",
        "version": "1",
        "chainId": 1,
        "verifyingContract": "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC"
      },
      "message": {
        "from": {
          "name": "Cow",
          "wallet": "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826"
        },
        "to": {
          "name": "Bob",
          "wallet": "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"
        },
        "contents": "Hello, Bob!"
      }
    }`
  ];

  // Sign the typed data
  const signResponse = await axios.post(
    `${PORTAL_MPC_CLIENT_URL}/v1/sign`,
    {
      share: shares.SECP256K1.share,
      method: 'eth_signTypedData_v4',
      params: JSON.stringify(typedDataPayload),
      rpcUrl: ethRpc,
      chainId: 'eip155:1', // Using mainnet chain ID as per the typed data
    },
    {
      headers: { Authorization: `Bearer ${clientApiKey}` },
    },
  );

  if (signResponse.status != 200) {
    console.error('Failed to sign typed data:', signResponse.data);
    return;
  }

  console.log(
    `Successfully signed typed data with signature ${signResponse.data.data}!`,
  );
}

module.exports = SignEthTypedData;
