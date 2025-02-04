const axios = require('axios');
const { BLOCKCYPHER_API_URL, BLOCKCYPHER_TOKEN } = require('./config');

class BitcoinAPI {
    constructor() {
        this.apiUrl = BLOCKCYPHER_API_URL;
        this.token = BLOCKCYPHER_TOKEN;
        this.axios = axios.create({
            timeout: 10000,
            maxRedirects: 5
        });

        // Add retry interceptor
        this.axios.interceptors.response.use(null, async (error) => {
            if (error.config && error.config.__retryCount < 3) {
                error.config.__retryCount = error.config.__retryCount || 0;
                error.config.__retryCount++;

                console.log(`Retrying BlockCypher request (${error.config.__retryCount}/3)...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * error.config.__retryCount));
                return this.axios(error.config);
            }
            return Promise.reject(error);
        });
    }

    async getAddressInfo(address) {
        try {
            console.log(`Fetching address info for ${address}...`);
            const response = await this.axios.get(
                `${this.apiUrl}/addrs/${address}`,
                { params: { token: this.token } }
            );

            if (!response.data) {
                throw new Error('Empty response from BlockCypher API');
            }

            return response.data;
        } catch (error) {
            if (error.response) {
                console.error('BlockCypher API Error:', {
                    status: error.response.status,
                    data: error.response.data
                });
                if (error.response.status === 429) {
                    throw new Error('BlockCypher API rate limit exceeded. Please wait a few minutes and try again.');
                }
            }
            throw new Error(`Error fetching address info: ${error.message}`);
        }
    }

    async getUnspentOutputs(address) {
        try {
            console.log(`Fetching UTXOs for ${address}...`);
            const response = await this.axios.get(
                `${this.apiUrl}/addrs/${address}`,
                { 
                    params: { 
                        unspentOnly: true,
                        token: this.token,
                        confirmations: 1 // Require at least 1 confirmation
                    } 
                }
            );

            if (!response.data) {
                throw new Error('Empty response from BlockCypher API');
            }

            const utxos = response.data.txrefs || [];

            // Validate and transform UTXOs
            return utxos.map(utxo => {
                if (!utxo.tx_hash || typeof utxo.tx_output_n !== 'number' || !utxo.value) {
                    console.warn('Invalid UTXO data:', utxo);
                    return null;
                }
                return {
                    tx_hash: utxo.tx_hash,
                    tx_output_n: utxo.tx_output_n,
                    value: utxo.value,
                    confirmations: utxo.confirmations || 0
                };
            }).filter(Boolean); // Remove any invalid UTXOs

        } catch (error) {
            if (error.response) {
                console.error('BlockCypher API Error:', {
                    status: error.response.status,
                    data: error.response.data
                });
                if (error.response.status === 429) {
                    throw new Error('BlockCypher API rate limit exceeded. Please wait a few minutes and try again.');
                }
            }
            throw new Error(`Error fetching UTXOs: ${error.message}`);
        }
    }

    async getFeeEstimate() {
        try {
            console.log('Fetching current recommended fee rate...');
            const response = await this.axios.get(
                this.apiUrl,
                { params: { token: this.token } }
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
            console.error('Error fetching fee estimate:', error);
            // Return default values if API fails
            return {
                high: 20,   // 20 sat/byte
                medium: 10, // 10 sat/byte
                low: 5     // 5 sat/byte
            };
        }
    }

    async broadcastTransaction(txHex) {
        try {
            console.log('Broadcasting transaction to BlockCypher...');
            const response = await this.axios.post(
                `${this.apiUrl}/txs/push`,
                { tx: txHex },
                { params: { token: this.token } }
            );

            if (!response.data || !response.data.tx) {
                throw new Error('Invalid response from broadcast API');
            }

            console.log('Transaction broadcast successful');
            return response.data;
        } catch (error) {
            if (error.response) {
                console.error('BlockCypher API Error:', {
                    status: error.response.status,
                    data: error.response.data
                });

                // Handle specific error cases
                if (error.response.status === 429) {
                    throw new Error('BlockCypher API rate limit exceeded. Please wait a few minutes and try again.');
                }
                if (error.response.data?.error?.includes('already exists')) {
                    throw new Error('Transaction has already been broadcast to the network');
                }
            }
            throw new Error(`Error broadcasting transaction: ${error.message}`);
        }
    }
}

module.exports = new BitcoinAPI();