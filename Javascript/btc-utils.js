/**
 * Bitcoin Utility Functions
 * 
 * Helper utilities for working with Bitcoin transactions and the blockchain
 */

const axios = require('axios');
const { BLOCKCYPHER_API_URL, BLOCKCYPHER_TOKEN, TATUM_API_KEY, TATUM_API_URL } = require('./config');

/**
 * Gets fee rate estimate from BlockCypher API
 * @returns {Object} Fee rates (high, medium, low)
 */
async function getFeeEstimate() {
    try {
      console.log('Fetching current recommended fee rate...');
      const apiUrl = BLOCKCYPHER_API_URL;
      
      if (!apiUrl) {
        throw new Error('BLOCKCYPHER_API_URL environment variable is not set');
      }
      
      const response = await axios.get(
        apiUrl,
        { params: { token: BLOCKCYPHER_TOKEN } }
      );
  
      if (!response.data || !response.data.high_fee_per_kb) {
        throw new Error('Invalid response from fee estimation API');
      }
  
      // Convert from satoshis/KB to satoshis/byte and return all fee levels
      return {
        high: Math.ceil(response.data.high_fee_per_kb / 1024),
        medium: Math.ceil(response.data.medium_fee_per_kb / 1024),
        low: Math.ceil(response.data.low_fee_per_kb / 1024)
      };
    } catch (error) {
      console.error('Error fetching fee estimate:', error.message);
      // Return default values if API fails
      return {
        high: 20,   // 20 sat/byte
        medium: 10, // 10 sat/byte
        low: 5      // 5 sat/byte
      };
    }
  }

/**
 * Fetches unspent transaction outputs (UTXOs) for a given address
 * @param {string} address - Bitcoin address
 * @returns {Array} Array of UTXOs
 */
async function fetchUTXOs(address) {
    try {
        const response = await axios.get(`https://api.tatum.io/v4/data/utxos?chain=bitcoin-testnet&address=${address}&totalValue=600`, {
            headers: {
                'accept': 'application/json',
                'x-api-key': TATUM_API_KEY,
            },
        });

        return response.data;
    } catch (error) {
        console.error('Error fetching UTXOs:', error.response ? error.response.data : error.message);
        return [];
    }
}

/**
 * Fetches detailed information about a specific UTXO
 * @param {string} txid - Transaction ID
 * @param {number} vout - Output index
 * @returns {Object} UTXO details
 */
async function fetchUTXODetails(txid, index) {
    try {
        const response = await axios.get(`${TATUM_API_URL}/bitcoin/utxo/${txid}/${index}`, {
            headers: {
                'accept': 'application/json',
                'x-api-key': TATUM_API_KEY,
            },
        });

        return response.data;
    } catch (error) {
        console.error('Error fetching UTXOs:', error.response ? error.response.data : error.message);
        return [];
    }
}

/**
 * Broadcasts a signed transaction to the Bitcoin network
 * @param {string} txHex - Signed transaction in hex format
 * @returns {Object} Broadcast result
 */
async function broadcastTransaction(txData) {
    try {
        const response = await axios.post(`${TATUM_API_URL}/bitcoin/broadcast`, { txData }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'x-api-key': TATUM_API_KEY,
            },
        });

        console.log('Transaction broadcast response:', response.data);
        return { success: true, txid: response.data };
    } catch (error) {
        console.error('Error broadcasting transaction:', error.response ? error.response.data : error.message);
    }
}

/**
 * Fetches the current balance of a Bitcoin address
 * @param {string} address - Bitcoin address
 * @returns {Object} Balance information
 */
async function getAddressBalance(address) {
  try {
    console.log(`Fetching balance for address: ${address}`);
    const utxos = await fetchUTXOs(address);
    
    if (!utxos || utxos.length === 0) {
      return { confirmed: 0, unconfirmed: 0, total: 0 };
    }
    
    // Calculate confirmed and unconfirmed balances
    let confirmed = 0;
    let unconfirmed = 0;
    
    utxos.forEach(utxo => {
      if (utxo.status && utxo.status.confirmed) {
        confirmed += utxo.value;
      } else {
        unconfirmed += utxo.value;
      }
    });
    
    return {
      confirmed,
      unconfirmed,
      total: confirmed + unconfirmed
    };
  } catch (error) {
    console.error('Error fetching address balance:', error.message);
    throw new Error(`Failed to fetch address balance: ${error.message}`);
  }
}

module.exports = {
  fetchUTXOs,
  fetchUTXODetails,
  broadcastTransaction,
  getAddressBalance,
  getFeeEstimate
};