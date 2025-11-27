const axios = require('axios');
const fs = require('fs');
const {
  ALCHEMY_API_KEY,
  PORTAL_API_URL,
  PORTAL_MPC_CLIENT_URL,
  SEPOLIA_RPC_URL,
  getAlchemyRpcUrl,
} = require('./config');

// Configuration constants for LiFi integration
const LIFI_CONFIG = {
  fromChain: 'eip155:8453', // Base
  toChain: 'eip155:42161', // Arbitrum
  fromToken: 'ETH', // Native ETH
  toToken: 'USDC', // USDC token
  fromAmount: '1000000000000', // 0.000001 ETH in wei
};

// Polling configuration
const MAX_POLL_ATTEMPTS = 300;
const POLL_INTERVAL_MS = 2000;
const OPERATION_TIMEOUT_SECONDS = 600;

/**
 * Poll the LiFi status endpoint until bridge/swap completes or times out
 * @param {string} txHash - Transaction hash from the signed transaction
 * @param {string} fromChain - Source chain in CAIP-2 format
 * @param {string} clientApiKey - Client API key for authentication
 * @param {number} maxAttempts - Maximum number of polling attempts
 * @param {number} pollIntervalMs - Milliseconds between polls
 * @param {number} timeoutSeconds - Overall timeout in seconds
 * @returns {Promise<{success: boolean, status: string, details: object}>}
 */
async function pollLiFiStatus(
  txHash,
  fromChain,
  clientApiKey,
  maxAttempts = MAX_POLL_ATTEMPTS,
  pollIntervalMs = POLL_INTERVAL_MS,
  timeoutSeconds = OPERATION_TIMEOUT_SECONDS,
) {
  console.log('\nPolling LiFi status...');
  const startTime = Date.now();
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;

    // Check timeout
    if ((Date.now() - startTime) / 1000 > timeoutSeconds) {
      throw new Error(
        `Timeout after ${timeoutSeconds} seconds waiting for LiFi bridge/swap completion`,
      );
    }

    try {
      const statusResponse = await axios.get(
        `${PORTAL_API_URL}/api/v3/clients/me/integrations/lifi/status`,
        {
          params: {
            fromChain: fromChain,
            txHash: txHash,
          },
          headers: {
            Authorization: `Bearer ${clientApiKey}`,
          },
        },
      );

      if (statusResponse.status !== 200) {
        console.warn(
          `Warning: Status check returned ${statusResponse.status}. Continuing...`,
        );
        await new Promise((r) => setTimeout(r, pollIntervalMs));
        continue;
      }

      const statusData = statusResponse.data.data;
      const txId = statusData?.rawResponse?.transactionId;
      const lifiExplorerLink = statusData?.rawResponse?.lifiExplorerLink;

      console.log(`Polling LiFi status: ${txId} (${attempt}/${maxAttempts})`);

      return {
        success: true,
        txId: txId,
        lifiExplorerLink: lifiExplorerLink,
      };
    } catch (error) {
      console.warn(
        `Warning: Error during status poll (attempt ${attempt}):`,
        error.message,
      );
      // Continue polling on network errors
    }

    // Wait before next poll
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  // Max attempts reached
  throw new Error(
    `Max polling attempts (${maxAttempts}) reached without completion`,
  );
}

/**
 * Sign and submit a LiFi transaction using Portal's MPC API
 * @param {object} transactionRequest - Transaction request from LiFi quote
 * @param {string} walletAddress - User's wallet address
 * @param {string} clientApiKey - Client API key for authentication
 * @param {object} shares - MPC shares object
 * @param {string} fromChain - Source chain in CAIP-2 format
 * @returns {Promise<{success: boolean, txHash?: string, error?: string}>}
 */
async function signAndSubmitLiFiTransaction(
  transactionRequest,
  walletAddress,
  clientApiKey,
  shares,
  fromChain,
) {
  try {
    console.log('\nSigning transaction with Portal MPC...');

    // Extract transaction fields from transactionRequest
    const transactionParams = {
      from: transactionRequest.from || walletAddress,
      to: transactionRequest.to,
      value: transactionRequest.value || '0x0',
      data: transactionRequest.data || '0x',
    };

    // Add gas parameters if present
    if (transactionRequest.gasLimit) {
      transactionParams.gasLimit = transactionRequest.gasLimit;
    }
    if (transactionRequest.gasPrice) {
      transactionParams.gasPrice = transactionRequest.gasPrice;
    }
    if (transactionRequest.maxFeePerGas) {
      transactionParams.maxFeePerGas = transactionRequest.maxFeePerGas;
    }
    if (transactionRequest.maxPriorityFeePerGas) {
      transactionParams.maxPriorityFeePerGas =
        transactionRequest.maxPriorityFeePerGas;
    }

    console.log('Transaction parameters:', transactionParams);

    // Sign and send via MPC API
    const signResponse = await axios.post(
      `${PORTAL_MPC_CLIENT_URL}/v1/sign`,
      {
        share: shares.SECP256K1.share,
        method: 'eth_sendTransaction',
        params: transactionParams,
        rpcUrl: getAlchemyRpcUrl(fromChain),
        chainId: fromChain,
      },
      {
        headers: { Authorization: `Bearer ${clientApiKey}` },
      },
    );

    if (signResponse.status !== 200) {
      console.error('Failed to sign transaction:', signResponse.data);
      return {
        success: false,
        error: `Sign failed with status ${signResponse.status}`,
      };
    }

    const txHash = signResponse.data.data;
    console.log(`Transaction signed successfully!`);
    console.log(`Transaction hash: ${txHash}`);

    // Validate txHash is a hex string
    if (!txHash || !txHash.startsWith('0x')) {
      console.error('Invalid transaction hash received:', txHash);
      return {
        success: false,
        error: 'Invalid transaction hash format',
      };
    }

    return {
      success: true,
      txHash: txHash,
    };
  } catch (error) {
    console.error('Error signing/submitting transaction:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Main function demonstrating LiFi bridge/swap integration with Portal MPC
 */
async function LifiExample() {
  try {
    console.log('\n=== LiFi Bridge/Swap Integration Example ===\n');

    // Step 1: Initialization - Read credentials
    console.log('Reading credentials...');
    const clientApiKey = fs.readFileSync('clientApiKey.txt', 'utf8').trim();
    const shares = JSON.parse(fs.readFileSync('shares.txt', 'utf8'));

    // Validate credentials exist
    if (!shares || !clientApiKey) {
      console.error(
        'No shares or clientApiKey found. Make sure to run the generate script first!',
      );
      return;
    }

    console.log('LiFi integration initialized');

    // Step 2: Get wallet address from Portal API
    console.log('\nGetting wallet address from Portal API...');
    const meResponse = await axios.get(`${PORTAL_API_URL}/api/v3/clients/me`, {
      headers: { Authorization: `Bearer ${clientApiKey}` },
    });

    if (meResponse.status !== 200) {
      console.error('Failed to get wallet address:', meResponse.data);
      return;
    }

    const walletAddress = meResponse.data.metadata.namespaces.eip155.address;
    const isAccountAbstracted = meResponse.data.isAccountAbstracted;

    if (!walletAddress) {
      console.error('No wallet address found in response');
      return;
    }

    console.log(`Wallet address: ${walletAddress}`);
    console.log(`Is account abstracted: ${isAccountAbstracted}`);

    // Step 3: Request LiFi quote
    console.log('\n--- Step 1: Requesting LiFi quote ---');
    console.log(
      `Quote parameters: ${LIFI_CONFIG.fromChain} -> ${LIFI_CONFIG.toChain}`,
    );
    console.log(
      `Token swap: ${LIFI_CONFIG.fromToken} -> ${LIFI_CONFIG.toToken}`,
    );
    console.log(`Amount: ${LIFI_CONFIG.fromAmount} wei`);

    const quoteResponse = await axios.post(
      `${PORTAL_API_URL}/api/v3/clients/me/integrations/lifi/quote`,
      {
        fromChain: LIFI_CONFIG.fromChain,
        fromAmount: LIFI_CONFIG.fromAmount,
        fromToken: LIFI_CONFIG.fromToken,
        toChain: LIFI_CONFIG.toChain,
        toToken: LIFI_CONFIG.toToken,
        fromAddress: walletAddress,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clientApiKey}`,
        },
      },
    );

    if (quoteResponse.status !== 200) {
      console.error('Failed to get LiFi quote:', quoteResponse.data);
      return;
    }

    console.log('Quote received successfully!');

    // Extract transactionRequest from the quote response
    const rawResponse = quoteResponse.data.data.rawResponse;
    const transactionRequest = rawResponse.transactionRequest;

    if (!transactionRequest) {
      console.error('No transactionRequest found in quote response');
      return;
    }

    // Log quote details
    if (rawResponse.estimate) {
      const estimate = rawResponse.estimate;
      console.log('\nQuote details:');
      console.log(
        `  Estimated output: ${estimate.toAmount} (min: ${estimate.toAmountMin})`,
      );
      if (estimate.gasCosts && estimate.gasCosts.length > 0) {
        console.log(
          `  Estimated gas cost: ${estimate.gasCosts[0].amountUSD} USD`,
        );
      }
      if (estimate.feeCosts && estimate.feeCosts.length > 0) {
        console.log(`  Protocol fees: ${estimate.feeCosts.length} fee(s)`);
      }
    }

    // Step 4: Sign and submit transaction
    console.log('\n--- Step 2: Signing transaction with Portal MPC ---');
    const signResult = await signAndSubmitLiFiTransaction(
      transactionRequest,
      walletAddress,
      clientApiKey,
      shares,
      LIFI_CONFIG.fromChain,
    );

    if (!signResult.success) {
      console.error('Failed to sign transaction:', signResult.error);
      return;
    }

    const txHash = signResult.txHash;
    console.log(`\nTransaction sent! Hash: ${txHash}`);

    // Step 5: Poll for completion
    console.log('\n--- Step 3: Polling for bridge/swap completion ---');
    const statusResult = await pollLiFiStatus(
      txHash,
      LIFI_CONFIG.fromChain,
      clientApiKey,
    );

    if (!statusResult.success) {
      console.error('\nLiFi bridge/swap failed. Status:', statusResult.status);
      console.error('Details:', statusResult.details);
      return;
    }

    // Step 6: Report results
    console.log('\nCompleted transaction ID:', statusResult.txId);
    console.log(`LiFi Explorer link: ${statusResult.lifiExplorerLink}`);

    // Step 7: Fetch transaction details from Alchemy
    console.log("\nFetching Portal client's assets...");
    const assetsResponse = await axios.get(
      `${PORTAL_API_URL}/api/v3/clients/me/chains/${LIFI_CONFIG.toChain}/assets`,
      {
        headers: { Authorization: `Bearer ${clientApiKey}` },
      },
    );

    console.log(`Assets on ${LIFI_CONFIG.toChain}:`, assetsResponse.data);

    console.log('\n=== LiFi Integration Example Complete ===\n');
  } catch (error) {
    console.error('\nError in LiFi integration:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

module.exports = LifiExample;
