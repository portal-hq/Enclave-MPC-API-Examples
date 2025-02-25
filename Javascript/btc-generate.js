// btc-generate.js
const bitcoin = require('bitcoin-sdk-js');

(async () => {
  // Generate a random key pair
  const keyPair = await bitcoin.wallet.generateKeyPair();
  const { publicKey, privateKey } = keyPair;

  console.log('Private Key:', privateKey);
  console.log('Public Key:', publicKey);

  // Generate Legacy (P2PKH) address
  const legacyAddress = await bitcoin.address.generateAddress(publicKey, 'legacy');
  console.log('Legacy Address (P2PKH):', legacyAddress);

  // Generate SegWit (P2WPKH) address
  const segwitAddress = await bitcoin.address.generateAddress(publicKey, 'segwit');
  console.log('SegWit Address (P2WPKH):', segwitAddress);
})();
