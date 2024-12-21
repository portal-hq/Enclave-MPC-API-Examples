const axios = require('axios');
const tnw = require('tronweb');
const fs = require('fs');
const protobuf = require('protobufjs');

const { PORTAL_API_URL, PORTAL_MPC_CLIENT_URL } = require('./config');

// Track last seen timestamps for both transaction types
let lastSeenTrc20Timestamp = 0;
let lastSeenTrxTimestamp = 0;

// Set constants
const apiKey = '' // Trongrid API KEY
const contractAddress = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf' // USDT on Nile
const host = 'https://nile.trongrid.io' // Trongrid host

async function getTrc20Transactions(walletAddress, contractAddress, host, apiKey) {
    try {
        const response = await axios.get(
            `${host}/v1/accounts/${walletAddress}/transactions/trc20`,
            {
                headers: {
                    'TRON-PRO-API-KEY': apiKey,
                },
                params: {
                    contract_address: contractAddress,
                    limit: 50,
                    order_by: 'block_timestamp,desc',  // Get newest first
                    only_confirmed: 'true'
                }
            }
        );

        if (response.status === 200 && response.data.data) {
            return response.data.data;
        }
        return null;
    } catch (error) {
        console.error('Error fetching Tron transactions:', error.response?.data || error.message);
        return null;
    }
}

async function getAllRawTransactions(walletAddress, host, apiKey) {
    try {
        const response = await axios.get(
            `${host}/v1/accounts/${walletAddress}/transactions`,
            {
                headers: {
                    'TRON-PRO-API-KEY': apiKey,
                },
                params: {
                    limit: 50,
                    order_by: 'block_timestamp,desc',  // Get newest first
                    only_confirmed: 'true'
                }
            }
        );

        if (response.status === 200 && response.data.data) {
            return response.data.data;
        }
        return null;
    } catch (error) {
        console.error('Error fetching Tron transactions:', error.response?.data || error.message);
        return null;
    }
}

async function TronPoll() {
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

    const tronAddress = meResponse.data.metadata.namespaces.tron.address;
    console.log(`Monitoring Tron address ${tronAddress} for client ${meResponse.data.id}`);

    // Start continuous polling
    while (true) {
        try {
            const trc20Transactions = await getTrc20Transactions(tronAddress, contractAddress, host, apiKey);
            const trxTransactions = await getAllRawTransactions(tronAddress, host, apiKey);

            if (trc20Transactions) {
                // Filter only new transactions
                const newTrc20Transactions = trc20Transactions.filter(tx => tx.block_timestamp > lastSeenTrc20Timestamp);

                if (newTrc20Transactions.length > 0) {
                    console.log(`Found ${newTrc20Transactions.length} new TRC20 transactions at ${new Date().toISOString()}`);
                    
                    // Update last seen timestamp with the newest transaction's timestamp
                    lastSeenTrc20Timestamp = newTrc20Transactions[0].block_timestamp;

                    // Process only new transactions
                    newTrc20Transactions.forEach(tx => {
                        console.log(" ----------------------- ")
                        console.log("TRC 20 Transaction Hash: ", tx.transaction_id);
                        console.log("TRC 20 Transaction Hash: ", tx.block_timestamp)
                        console.log("TRC 20 From: ", tx.from)
                        console.log("TRC 20 To: ", tx.to)
                        console.log("TRC 20 Value: ", tx.value)
                        console.log(" ----------------------- ")
                    });
                }
            }

            if (trxTransactions) {
                // Filter only new transactions
                const newTrxTransactions = trxTransactions.filter(tx => tx.block_timestamp > lastSeenTrxTimestamp);

                if (newTrxTransactions.length > 0) {
                    console.log(`Found ${newTrxTransactions.length} new TRX transactions at ${new Date().toISOString()}`);
                    
                    // Update last seen timestamp with the newest transaction's timestamp
                    lastSeenTrxTimestamp = newTrxTransactions[0].block_timestamp;

                    // Process only new transactions
                    newTrxTransactions.forEach(tx => {
                        console.log(" ----------------------- ")
                        console.log("Transaction Hash: ", tx.txID);
                        console.log("Transaction timestamp: ", tx.block_timestamp)
                        console.log(" ----------------------- ")
                    });
                }
            }

            // Wait for 3 seconds before next poll
            await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error) {
            console.error('Error in polling loop:', error);
            // Wait before retrying after error
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

module.exports = {
    TronPoll
};