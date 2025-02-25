/**
 * Bitcoin Transaction Handler
 * 
 * This module provides functionality to create, sign, and broadcast Bitcoin transactions
 * using a Portal MPC wallet and bitcoinjs-lib.
 */

const fs = require('fs');
const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
const { BIP32Factory } = require('bip32');
const { Point } = require('@noble/secp256k1');
const BigInteger = require('bigi');
const axios = require('axios');

// Import helper functions
const { 
  broadcastTransaction, 
  fetchUTXOs, 
  fetchUTXODetails,
  getFeeEstimate
} = require('./btc-utils.js');

// Import configuration 
const {
  PORTAL_API_URL,
  PORTAL_MPC_CLIENT_URL,
  BITCOIN_DUST_LIMIT
} = require('./config.js');

// Configuration
const TESTNET = true; // Override to use mainnet
const network = TESTNET ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;

/**
 * Creates an axios instance with retry capability
 * @returns {Object} Configured axios instance
 */
function createPortalAxios() {
  const instance = axios.create({
    timeout: 10000,
    maxRedirects: 5,
    validateStatus: null,
  });

  // Add retry interceptor
  instance.interceptors.response.use(null, async (error) => {
    if (error.config && error.config.__retryCount < 3) {
      error.config.__retryCount = error.config.__retryCount || 0;
      error.config.__retryCount++;

      console.log(`Retrying request (${error.config.__retryCount}/3)...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * error.config.__retryCount));
      return instance(error.config);
    }
    return Promise.reject(error);
  });

  return instance;
}

/**
 * Signs transaction data using Portal MPC
 * @param {string} hexData - Hash to sign in hex format
 * @param {string} clientApiKey - Portal API key
 * @param {Object} shares - Portal shares
 * @returns {string} Signature in hex format
 */
async function portalSign(hexData, clientApiKey, shares) {
  const portalAxios = createPortalAxios();
  
  try {
    console.log("Making Portal sign request...");
    console.log("Transaction hash to sign:", hexData);

    const signResponse = await portalAxios.post(
      `${PORTAL_MPC_CLIENT_URL}/v1/raw/sign/SECP256K1`,
      {
        share: shares.SECP256K1.share,
        param: hexData,
      },
      {
        headers: {
          Authorization: `Bearer ${clientApiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (signResponse.status !== 200) {
      throw new Error(`Failed to sign message: ${JSON.stringify(signResponse.data)}`);
    }

    if (!signResponse.data || !signResponse.data.data) {
      throw new Error("Invalid signature response format from Portal");
    }

    const signature = signResponse.data.data;
    console.log(`Successfully signed transaction with signature: ${signature}`);
    return signature;
  } catch (error) {
    console.error("Portal Sign Error:", error.message);
    throw error;
  }
}

/**
 * Fetches wallet information from Portal
 * @param {string} clientApiKey - Portal API key
 * @returns {Object} Public key coordinates
 */
async function getPortalWallet(clientApiKey) {
  const portalAxios = createPortalAxios();
  
  try {
    console.log("Fetching wallet information from Portal...");
    const response = await portalAxios.get(
      `${PORTAL_API_URL}/api/v3/clients/me`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${clientApiKey}`,
        },
      },
    );

    if (response.status !== 200) {
      throw new Error(`Failed to get client info: ${JSON.stringify(response.data)}`);
    }

    if (!response.data || !response.data.wallets) {
      throw new Error("Invalid wallet response format from Portal");
    }

    const secp256k1Key = response.data.wallets.find(
      (item) => item.curve === "SECP256K1",
    )?.publicKey;
    
    if (!secp256k1Key) {
      throw new Error("No SECP256K1 wallet found in Portal account");
    }

    console.log("Successfully retrieved SECP256K1 public key from Portal");
    return JSON.parse(secp256k1Key);
  } catch (error) {
    console.error("Portal Wallet Error:", error.message);
    throw error;
  }
}

/**
 * Compresses a public key point on the secp256k1 curve
 * @param {string} xHex - X coordinate as hex string
 * @param {string} yHex - Y coordinate as hex string
 * @returns {string} Compressed public key as hex string
 */
function compressPublicKey(xHex, yHex) {
  const point = new Point(BigInt(`0x${xHex}`), BigInt(`0x${yHex}`));
  const compressed = point.toRawBytes(true);
  return Buffer.from(compressed).toString('hex');
}

/**
 * Calculates the virtual size of a transaction
 * @param {number} numInputs - Number of inputs
 * @param {number} numOutputs - Number of outputs
 * @returns {number} Virtual size in vBytes
 */
function calculateVirtualSize(numInputs, numOutputs) {
// Assuming P2WPKH inputs and outputs
const baseSize = 10; // Version + locktime
const inputSize = 41; // outpoint(36) + sequence(4) + count(1)
const inputWitnessSize = 107; // signature(72) + pubkey(33) + count(1) + length(1)
const outputSize = 31; // value(8) + script_len(1) + script(22)

const totalBaseSize =
    baseSize + inputSize * numInputs + outputSize * numOutputs;
const totalWitnessSize = inputWitnessSize * numInputs;

// Virtual size calculation: (base size * 4 + witness size) / 4
return Math.ceil((totalBaseSize * 4 + totalWitnessSize) / 4);
}


/**
 * Creates and broadcasts a Bitcoin transaction
 * @param {Object} options - Transaction options
 * @param {string} options.destinationAddress - Recipient address
 * @param {number} options.amount - Amount to send in satoshis
 * @param {string} options.feeLevel - Fee level (high/medium/low)
 * @returns {string} Transaction ID
 */
async function createTransaction(destinationAddress) {
  try {
    const amount = 546;
    const feeLevel = 'low';
    console.log("Starting Bitcoin transaction process...");

    // Load configuration
    const clientApiKey = fs.readFileSync('clientApiKey.txt', 'utf8').trim();
    const shares = JSON.parse(fs.readFileSync('shares.txt', 'utf8'));

    // 1. Get public key coordinates from portal wallet
    const { x, y } = await getPortalWallet(clientApiKey);
    
    // Convert decimal strings to BigInteger instances
    const xBigInt = BigInteger(x);
    const yBigInt = BigInteger(y);

    // Convert to hex and pad to 64 characters
    const xHex = xBigInt.toHex().padStart(64, "0");
    const yHex = yBigInt.toHex().padStart(64, "0");
    
    // Create public key Buffer (33 bytes for compressed)
    const publicKeyBuffer = Buffer.concat([
      Buffer.from([
        yBigInt.mod(BigInteger.valueOf(2)).equals(BigInteger.ZERO)
          ? 0x02
          : 0x03,
      ]),
      Buffer.from(xHex, "hex"),
    ]);

    if (!ecc.isPoint(publicKeyBuffer)) {
      throw new Error("Invalid public key coordinates");
    }

    // Generate addresses
    const p2wpkh = bitcoin.payments.p2wpkh({
      pubkey: publicKeyBuffer,
      network,
    });

    console.log(`Bitcoin ${TESTNET ? 'Testnet' : 'Mainnet'} Address: ${p2wpkh.address}`);

    // Get UTXOs for the address
    console.log(`Fetching UTXOs for address: ${p2wpkh.address}`);
    const utxos = await fetchUTXOs(p2wpkh.address);
    
    if (!utxos || utxos.length === 0) {
      throw new Error(`No UTXOs found for address: ${p2wpkh.address}`);
    }
    
    // Create a new PSBT
    const psbt = new bitcoin.Psbt({ network });

    // Track total input value
    let totalInputValue = 0;
    const utxoDetailsList = [];

    // loop through utxos
    for (let i = 0; i < utxos.length; i++) {
        const utxoDetails = await fetchUTXODetails(utxos[i].txHash, utxos[i].index);
        utxoDetailsList.push(utxoDetails);

        // Add the selected input
        psbt.addInput({
            hash: utxoDetails.hash,
            index: utxoDetails.index,
            witnessUtxo: {
            script: Buffer.from(utxoDetails.script, 'hex'),
            value: utxoDetails.value,
            },
        });

        totalInputValue += utxoDetails.value;
    }
    
    // Get current recommended fee rates
    const feeRates = await getFeeEstimate();
    const selectedFeeRate = feeRates[feeLevel];
    console.log(`Using ${feeLevel} fee rate: ${selectedFeeRate} sat/byte`);


    // Calculate transaction size and fee
    const virtualSize = calculateVirtualSize(utxos.length, 2);
    const fee = virtualSize * selectedFeeRate;

    // Validate the transaction amount
    if (!amount || amount < BITCOIN_DUST_LIMIT) {
      throw new Error(`Amount (${amount} satoshis) is below the dust limit (${BITCOIN_DUST_LIMIT} satoshis)`);
    }

    // Calculate change amount
    const changeAmount = totalInputValue - amount - fee;
    if (changeAmount < 0) {
      throw new Error(`Insufficient funds. Have ${totalInputValue} satoshis, need ${amount + fee} satoshis (including ${fee} satoshi fee)`);
    }

    console.log("\nTransaction details:");
    console.log(`- Total input: ${totalInputValue} satoshis from ${utxos.length} UTXOs`);
    console.log(`- Send amount: ${amount} satoshis`);
    console.log(`- Network fee: ${fee} satoshis (${selectedFeeRate} sat/vB, size: ${virtualSize} vB)`);
    console.log(`- Change amount: ${changeAmount} satoshis`);
    console.log(`- Destination address: ${destinationAddress}`);
    // Add the recipient output
    psbt.addOutput({
      address: destinationAddress,
      value: amount,
    });

    // Add change output if applicable
    if (changeAmount >= 0) {
      psbt.addOutput({
        address: p2wpkh.address,
        value: changeAmount,
      });
    }

    // Loop through the psbt inputs to sign
    for (let i = 0; i < psbt.inputCount; i++) {
        // Get the correct previous output script
        const prevScriptFormatted =  bitcoin.payments.p2pkh({hash: Buffer.from(utxoDetailsList[i].script, 'hex').slice(2)}).output;
        
        // Create hash for signature
        const hashForSig = bitcoin.Transaction.fromBuffer(psbt.data.globalMap.unsignedTx.toBuffer())
        .hashForWitnessV0(
            i,
            prevScriptFormatted,
            utxoDetailsList[i].value,
            bitcoin.Transaction.SIGHASH_ALL
        );
        
        console.log("Hash for signature:", hashForSig.toString('hex'));

        // Get signature from Portal
        const portalSig = await portalSign(
            hashForSig.toString("hex"), 
            clientApiKey, 
            shares
        );

        // Split into r and s components (32 bytes each)
        const r = Buffer.from(portalSig.slice(0, 64), 'hex');
        const s = Buffer.from(portalSig.slice(64, 128), 'hex');
        const rawSig = Buffer.concat([r, s]);

        // Create signature with sighash flag
        const sigBuffer = bitcoin.script.signature.encode(
            rawSig, 
            bitcoin.Transaction.SIGHASH_ALL
        );

        // Add signature to PSBT
        psbt.updateInput(i, {
            partialSig: [{
                pubkey: publicKeyBuffer,
                signature: sigBuffer
            }]
        });

    }
    
    // Finalize and extract transaction
    console.log("Finalizing transaction...");
    psbt.finalizeAllInputs();
    
    const tx = psbt.extractTransaction();
    const txHex = tx.toHex();
    const txId = tx.getId();

    console.log("Broadcasting transaction...");
    await broadcastTransaction(txHex);
    
    console.log(`Transaction broadcast successfully! TXID: ${txId}`);
    return txId;
  } catch (error) {
    console.error("Error creating transaction:", error.message);
    throw error;
  }
}

module.exports = {
  createTransaction,
  getPortalWallet,
  compressPublicKey
};