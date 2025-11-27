const axios = require('axios');
const fs = require('fs');
const {
  PORTAL_API_URL,
  PORTAL_MPC_CLIENT_URL,
  getAlchemyRpcUrl,
} = require('./config');

// Configuration constants for LiFi routes integration
const LIFI_ROUTE_CONFIG = {
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
 * @param {object} transactionRequest - Transaction request from LiFi route step
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
 * Get transaction details for a specific route step
 * @param {object} step - Route step object from LiFi routes response
 * @param {string} walletAddress - User's wallet address
 * @param {string} clientApiKey - Client API key for authentication
 * @returns {Promise<{transactionRequest: object}>}
 */
async function getStepTransactionDetails(step, walletAddress, clientApiKey) {
  console.log(
    `\nGetting transaction details for step: ${step.id} (${step.tool})`,
  );

  try {
    // Ensure the step has fromAddress and toAddress in the action
    const stepWithAddress = {
      ...step,
      action: {
        ...step.action,
        fromAddress: walletAddress,
        toAddress: walletAddress,
      },
    };

    const response = await axios.post(
      `${PORTAL_API_URL}/api/v3/clients/me/integrations/lifi/route-step-details`,
      stepWithAddress,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clientApiKey}`,
        },
      },
    );

    if (response.status !== 200) {
      throw new Error(`Failed to get step details: ${response.status}`);
    }

    const transactionRequest =
      response.data.data.rawResponse.transactionRequest;

    if (!transactionRequest) {
      throw new Error('No transactionRequest found in step details response');
    }

    console.log('Step transaction details received');

    return { transactionRequest };
  } catch (error) {
    console.error('Error getting step transaction details:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Process route steps sequentially, waiting for each to complete before starting the next
 * @param {array} steps - Array of route steps from LiFi routes response
 * @param {string} walletAddress - User's wallet address
 * @param {string} clientApiKey - Client API key for authentication
 * @param {object} shares - MPC shares object
 * @param {string} fromChain - Source chain in CAIP-2 format
 * @returns {Promise<boolean>} - True if all steps completed successfully
 */
async function processRouteStepsSequentially(
  steps,
  walletAddress,
  clientApiKey,
  shares,
  fromChain,
) {
  console.log(`\nProcessing ${steps.length} route step(s) sequentially...`);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n--- Step ${i + 1}/${steps.length}: ${step.tool} ---`);

    try {
      // 1. Get transaction details for this step
      const stepDetails = await getStepTransactionDetails(
        step,
        walletAddress,
        clientApiKey,
      );

      // 2. Sign and submit the transaction
      const signResult = await signAndSubmitLiFiTransaction(
        stepDetails.transactionRequest,
        walletAddress,
        clientApiKey,
        shares,
        fromChain,
      );

      if (!signResult.success) {
        throw new Error(
          `Failed to sign/submit step ${i + 1}: ${signResult.error}`,
        );
      }

      // 3. Poll for completion before moving to next step
      const statusResult = await pollLiFiStatus(
        signResult.txHash,
        fromChain,
        clientApiKey,
      );

      if (!statusResult.success) {
        throw new Error(`Step ${i + 1} failed to complete`);
      }

      console.log(`\nStep ${i + 1} completed successfully!`);
      if (statusResult.lifiExplorerLink) {
        console.log(`LiFi Explorer: ${statusResult.lifiExplorerLink}`);
      }
    } catch (error) {
      console.error(`\nError processing step ${i + 1}:`, error.message);
      return false;
    }
  }

  console.log('\nAll route steps processed successfully!');
  return true;
}

/**
 * Main function demonstrating LiFi routes integration with Portal MPC
 */
async function LifiRouteExample() {
  try {
    console.log('\n=== LiFi Routes Integration Example ===\n');

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

    console.log('LiFi routes integration initialized');

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

    // Step 3: Request LiFi routes
    console.log('\n--- Step 1: Requesting LiFi routes ---');
    console.log(
      `Route parameters: ${LIFI_ROUTE_CONFIG.fromChain} -> ${LIFI_ROUTE_CONFIG.toChain}`,
    );
    console.log(
      `Token swap: ${LIFI_ROUTE_CONFIG.fromToken} -> ${LIFI_ROUTE_CONFIG.toToken}`,
    );
    console.log(`Amount: ${LIFI_ROUTE_CONFIG.fromAmount} wei`);

    const routesResponse = await axios.post(
      `${PORTAL_API_URL}/api/v3/clients/me/integrations/lifi/routes`,
      {
        fromChainId: LIFI_ROUTE_CONFIG.fromChain,
        fromAmount: LIFI_ROUTE_CONFIG.fromAmount,
        fromTokenAddress: LIFI_ROUTE_CONFIG.fromToken,
        toChainId: LIFI_ROUTE_CONFIG.toChain,
        toTokenAddress: LIFI_ROUTE_CONFIG.toToken,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clientApiKey}`,
        },
      },
    );

    if (routesResponse.status !== 200) {
      console.error('Failed to get LiFi routes:', routesResponse.data);
      return;
    }

    console.log('Routes received successfully!');

    // Extract routes from the response
    const routes = routesResponse.data.data.rawResponse.routes;

    if (!routes || routes.length === 0) {
      console.error('No routes found in response');
      return;
    }

    // Use the first route
    const selectedRoute = routes[0];
    console.log(`\nSelected route: ${selectedRoute.id}`);
    console.log(
      `  From: ${selectedRoute.fromAmountUSD} USD (${selectedRoute.fromToken.symbol})`,
    );
    console.log(
      `  To: ${selectedRoute.toAmountUSD} USD (${selectedRoute.toToken.symbol})`,
    );
    console.log(`  Steps: ${selectedRoute.steps.length}`);
    console.log(`  Tags: ${selectedRoute.tags.join(', ')}`);

    // Validate route has steps
    if (!selectedRoute.steps || selectedRoute.steps.length === 0) {
      console.error('Selected route has no steps');
      return;
    }

    // Step 4: Process route steps sequentially
    console.log('\n--- Step 2: Processing route steps ---');
    const success = await processRouteStepsSequentially(
      selectedRoute.steps,
      walletAddress,
      clientApiKey,
      shares,
      LIFI_ROUTE_CONFIG.fromChain,
    );

    if (!success) {
      console.error('\nRoute execution failed');
      return;
    }

    // Step 5: Fetch final assets to verify completion
    console.log("\n--- Step 3: Fetching Portal client's assets ---");
    const assetsResponse = await axios.get(
      `${PORTAL_API_URL}/api/v3/clients/me/chains/${LIFI_ROUTE_CONFIG.toChain}/assets`,
      {
        headers: { Authorization: `Bearer ${clientApiKey}` },
      },
    );

    console.log(`Assets on ${LIFI_ROUTE_CONFIG.toChain}:`, assetsResponse.data);

    console.log('\n=== LiFi Routes Integration Example Complete ===\n');
  } catch (error) {
    console.error('\nError in LiFi routes integration:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

module.exports = LifiRouteExample;
