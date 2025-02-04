const bitcoin = require("bitcoinjs-lib");
const ecc = require("tiny-secp256k1");
const { BIP32Factory } = require("bip32");
const BigInteger = require("bigi"); // For handling big integers

const axios = require("axios");

const {
    PORTAL_API_URL,
    PORTAL_MPC_CLIENT_URL,
    BITCOIN_FEE_RATE,
    BITCOIN_DUST_LIMIT
} = require("./config");
const btcApi = require("./btcApi");

const bip32 = BIP32Factory(ecc);

// Read PORTAL_CLIENT_API_KEY from file
const PORTAL_CLIENT_API_KEY = fs.readFileSync('clientApiKey.txt', 'utf8');

// Read shares from file
const shares = JSON.parse(fs.readFileSync('shares.txt', 'utf8'));

// Create axios instance with retries and better configuration
const portalAxios = axios.create({
    timeout: 10000,
    maxRedirects: 5,
    validateStatus: null,
});

// Add retry interceptor
portalAxios.interceptors.response.use(null, async (error) => {
    if (error.config && error.config.__retryCount < 3) {
        error.config.__retryCount = error.config.__retryCount || 0;
        error.config.__retryCount++;

        console.log(`Retrying request (${error.config.__retryCount}/3)...`);
        await new Promise((resolve) =>
            setTimeout(resolve, 1000 * error.config.__retryCount),
        );
        return portalAxios(error.config);
    }
    return Promise.reject(error);
});

async function portalSign(hexData) {
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
                    Authorization: `Bearer ${PORTAL_CLIENT_API_KEY}`,
                    "Content-Type": "application/json",
                },
            },
        );

        if (signResponse.status !== 200) {
            console.error("Sign response error:", signResponse.data);
            throw new Error(
                `Failed to sign message: ${JSON.stringify(signResponse.data)}`,
            );
        }

        if (!signResponse.data || !signResponse.data.data) {
            throw new Error("Invalid signature response format from Portal");
        }

        const signature = signResponse.data.data;
        console.log(
            `Successfully signed transaction with Signature: ${signature}`,
        );
        return signature;
    } catch (error) {
        if (error.response) {
            console.error("Portal API Error Response:", {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers,
            });
        } else if (error.request) {
            console.error(
                "No response received from Portal API:",
                error.request,
            );
        } else {
            console.error(
                "Error setting up Portal API request:",
                error.message,
            );
        }
        throw error;
    }
}

async function portalWallet() {
    try {
        console.log("Fetching wallet information from Portal...");
        const meResponse = await portalAxios.get(
            `${PORTAL_API_URL}/api/v3/clients/me`,
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${PORTAL_CLIENT_API_KEY}`,
                },
            },
        );

        if (meResponse.status !== 200) {
            console.error("Get wallet response error:", meResponse.data);
            throw new Error(
                `Failed to get client info: ${JSON.stringify(meResponse.data)}`,
            );
        }

        if (!meResponse.data || !meResponse.data.wallets) {
            throw new Error("Invalid wallet response format from Portal");
        }

        const secp256k1Key = meResponse.data.wallets.find(
            (item) => item.curve === "SECP256K1",
        )?.publicKey;
        if (!secp256k1Key) {
            throw new Error("No SECP256K1 wallet found in Portal account");
        }

        console.log("Successfully retrieved SECP256K1 public key from Portal");
        return JSON.parse(secp256k1Key);
    } catch (error) {
        if (error.response) {
            console.error("Portal API Error Response:", {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers,
            });
        } else if (error.request) {
            console.error(
                "No response received from Portal API:",
                error.request,
            );
        } else {
            console.error(
                "Error setting up Portal API request:",
                error.message,
            );
        }
        throw error;
    }
}

// Helper function to calculate transaction virtual size
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


async function PortalBitcoin() {
    try {
        console.log("Starting Bitcoin transaction process...");

        // 1. Get public key coordinates from portal wallet
        const { x, y } = await portalWallet();
        console.log("Retrieved public key coordinates from Portal");

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

        // Set testnet network
        const network = bitcoin.networks.testnet;
        console.log("Hex Public Key:", publicKeyBuffer.toString("hex"));
        // Generate addresses
        const p2wpkh = bitcoin.payments.p2wpkh({
            pubkey: publicKeyBuffer,
            network,
        });

        console.log(
            "\nBitcoin Testnet Address (Native SegWit):",
            p2wpkh.address,
        );

        // Get UTXOs for the address
        console.log("Fetching UTXOs for address:", p2wpkh.address);

        const utxos = await btcApi.getUnspentOutputs(p2wpkh.address);

        if (!utxos.length) {
            const message =
                `No UTXOs found for the address: ${p2wpkh.address}\n\n` +
                "To proceed, please fund this testnet address using one of these faucets:\n" +
                "1. https://bitcoinfaucet.uo1.net/\n" +
                "2. https://testnet-faucet.mempool.co/\n" +
                "3. https://coinfaucet.eu/en/btc-testnet/\n\n" +
                "After funding, wait for 1 confirmation and run this script again.";
            throw new Error(message);
        }

        console.log("Found UTXOs:", utxos);

        // Before adding inputs, verify each UTXO
        for (const utxo of utxos) {            
            // Get the script we're planning to use
            const witnessScript = p2wpkh.output;
            
            if (!isP2WPKH(witnessScript)) {
                throw new Error(`UTXO ${utxo.tx_hash}:${utxo.tx_output_n} is not P2WPKH`);
            }
        }

        // Get current recommended fee rates
        const feeRates = await btcApi.getFeeEstimate();
        console.log("\nCurrent fee rates (satoshis/byte):");
        console.log("- High:", feeRates.high);
        console.log("- Medium:", feeRates.medium);
        console.log("- Low:", feeRates.low);

        // Use medium fee rate for balance between cost and confirmation speed
        const selectedFeeRate = feeRates.low;
        // const selectedFeeRate = 160;
        console.log(`\nUsing medium fee rate: ${selectedFeeRate} sat/byte`);

        // Create a new PSBT
        const psbt = new bitcoin.Psbt({ network });

        // Calculate total input amount and add inputs
        let totalInput = 0;
        utxos.forEach((utxo) => {
            totalInput += utxo.value;
            console.log(
                `Adding input: ${utxo.tx_hash}:${utxo.tx_output_n} (${utxo.value} satoshis)`,
            );

            // Add input with proper witness UTXO information
            const witnessUtxo = {
                script: p2wpkh.output,
                value: utxo.value,
            };

            psbt.addInput({
                hash: utxo.tx_hash,
                index: utxo.tx_output_n,
                witnessUtxo,
            });
        });

        // Calculate fee based on virtual size
        const numInputs = utxos.length;
        const numOutputs = 2; // Target output + change output
        const virtualSize = calculateVirtualSize(numInputs, numOutputs);
        const fee = virtualSize * selectedFeeRate;

        // Target amount (546 satoshis = 0.00000546 BTC)
        const targetAmount = 546;
        const destinationAddress = "tb1qlj64u6fqutr0xue85kl55fx0gt4m4urun25p7q";

        // Calculate change amount
        const changeAmount = totalInput - targetAmount - fee;

        // Validate amounts
        if (totalInput < targetAmount + fee) {
            throw new Error(
                `Insufficient funds. Have ${totalInput} satoshis, need ${targetAmount + fee} satoshis (including ${fee} satoshi fee)`,
            );
        }

        if (targetAmount < BITCOIN_DUST_LIMIT) {
            throw new Error(
                `Target amount (${targetAmount} satoshis) is below the dust limit (${BITCOIN_DUST_LIMIT} satoshis)`,
            );
        }

        console.log("\nTransaction details:");
        console.log(`- Total input: ${totalInput} satoshis`);
        console.log(`- Target amount: ${targetAmount} satoshis`);
        console.log(
            `- Network fee: ${fee} satoshis (${selectedFeeRate} sat/vB, size: ${virtualSize} vB)`,
        );
        console.log(`- Change amount: ${changeAmount} satoshis`);

        // Add outputs
        console.log("\nAdding outputs:");
        console.log(
            `1. Payment: ${targetAmount} satoshis -> ${destinationAddress}`,
        );
        psbt.addOutput({
            address: destinationAddress,
            value: targetAmount,
        });

        if (changeAmount >= BITCOIN_DUST_LIMIT) {
            console.log(
                `2. Change: ${changeAmount} satoshis -> ${p2wpkh.address}`,
            );
            psbt.addOutput({
                address: p2wpkh.address,
                value: changeAmount,
            });
        } else if (changeAmount > 0) {
            console.log(
                `Warning: Change amount (${changeAmount} satoshis) is below dust limit, adding to fee`,
            );
        }
       
        // Sign each input
        console.log("\nSigning inputs:");
        for (let i = 0; i < psbt.data.inputs.length; i++) {
            // Get the hash that needs to be signed
            const hashData = bitcoin.Transaction.fromBuffer(psbt.data.globalMap.unsignedTx.toBuffer())
            .hashForWitnessV0(
                i,
                p2wpkh.output,
                utxos[i].value,
                bitcoin.Transaction.SIGHASH_ALL
            );

            // Get signature from Portal
            const portalSig = await portalSign(hashData.toString("hex"));


            // Split into r and s components (32 bytes each)
            const r = Buffer.from(portalSig.slice(0, 64), 'hex');
            const s = Buffer.from(portalSig.slice(64, 128), 'hex');
            const rawSig = Buffer.concat([r, s]);

            // Verify the signature before adding it
            // Verify using the raw signature before converting to DER
            const hashUint8 = new Uint8Array(hashData);
            const pubkeyUint8 = new Uint8Array(publicKeyBuffer);
            // const sigUint8 = new Uint8Array(Buffer.from(portalSig, 'hex')); // Use raw signature for verification
            const sigUint8 = new Uint8Array(rawSig);


            const verified = ecc.verify(
                hashUint8,      // message hash
                pubkeyUint8,    // public key
                sigUint8,       // signature (without sighash byte)
                true            // strict mode
            );

            if (!verified) {
                console.log("Signature verification failed for input", i);
                throw new Error("Invalid signature generated");
            }

            const sigBuffer = convertToDER(portalSig)

            // Create the partial signature object
            const partialSig = {
                pubkey: publicKeyBuffer,
                signature: sigBuffer
            };

            const inputUpdate = {
                partialSig: [partialSig]
            };

            // Try updating with a direct object literal
            psbt.updateInput(i,  inputUpdate );
        }
        
        console.log("\nFinalizing transaction...");
        // psbt.finalizeAllInputs();
        // Custom finalizer for P2WPKH
        const finalizeInput = (inputIndex) => {
            const input = psbt.data.inputs[inputIndex];
            
            // Ensure we have proper Buffers
            const witnessStack = [
                Buffer.from(input.partialSig[0].signature),  // Convert to proper Buffer
                Buffer.from(input.partialSig[0].pubkey)      // Convert to proper Buffer
            ];
            
            return {
                finalScriptSig: Buffer.alloc(0),
                finalScriptWitness: Buffer.concat([
                    Buffer.from([witnessStack.length]),  // Number of witness elements
                    ...witnessStack.map(item => {
                        const len = Buffer.from([item.length]); // Length of each item
                        return Buffer.concat([len, item]);      // Length + item
                    })
                ])
            };
        };
        
        for (let i = 0; i < psbt.data.inputs.length; i++) {
            console.log(`Finalizing input ${i}`);
            psbt.finalizeInput(i, finalizeInput);
        }


        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();

        console.log("\nBroadcasting transaction...");
        console.log("Transaction hex:", txHex);

        try {
            const result = await btcApi.broadcastTransaction(txHex);
            console.log("Transaction broadcast success:", result.tx.hash);
            console.log(
                `Transaction details: https://mempool.space/testnet/tx/${result.tx.hash}`,
            );
            return result;
        } catch (error) {
            if (error.response?.data?.error?.includes("already exists")) {
                throw new Error(
                    "Transaction already broadcasted to the network",
                );
            }
            throw error;
        }
    } catch (error) {
        console.error("Error in PortalBitcoin:", error);
        throw error;
    }
}

function convertToDER(signature) {
    // Convert hex strings to byte arrays
    const r = Buffer.from(signature.slice(0, 64), 'hex');
    const s = Buffer.from(signature.slice(64, 128), 'hex');
    
    // Create DER sequence
    const der = [];
    der.push(0x30); // sequence tag
    
    // Handle leading zeros and negative numbers for r
    let rPadded = Buffer.from(r);
    if (rPadded[0] & 0x80) {
        rPadded = Buffer.concat([Buffer.from([0x00]), rPadded]);
    }
    while (rPadded.length > 1 && rPadded[0] === 0x00 && !(rPadded[1] & 0x80)) {
        rPadded = rPadded.slice(1);
    }
    
    // Handle leading zeros and negative numbers for s
    let sPadded = Buffer.from(s);
    if (sPadded[0] & 0x80) {
        sPadded = Buffer.concat([Buffer.from([0x00]), sPadded]);
    }
    while (sPadded.length > 1 && sPadded[0] === 0x00 && !(sPadded[1] & 0x80)) {
        sPadded = sPadded.slice(1);
    }
    
    // Calculate total length for the sequence
    const seqLength = 2 + rPadded.length + 2 + sPadded.length;
    der.push(seqLength); // sequence length
    
    // Add r value
    der.push(0x02); // integer tag
    der.push(rPadded.length); // r length
    der.push(...rPadded); // r value
    
    // Add s value
    der.push(0x02); // integer tag
    der.push(sPadded.length); // s length
    der.push(...sPadded); // s value
    
    // Add SIGHASH_ALL
    der.push(bitcoin.Transaction.SIGHASH_ALL);
    
    const result = Buffer.from(der);
    Object.defineProperty(result, 'signature', {
        value: true,
        configurable: false,
        enumerable: false,
        writable: false
    });
    
    return result;
}

// Function to check if input is P2WPKH
function isP2WPKH(script) {
    // P2WPKH output script should be exactly 22 bytes:
    // OP_0 (0x00) + 0x14 (20 bytes push) + 20-byte pubkey hash
    return (
        Buffer.isBuffer(script) &&
        script.length === 22 &&
        script[0] === 0x00 && // OP_0
        script[1] === 0x14    // 20 bytes push
    );
}

module.exports = {
    PortalBitcoin,
};
