const axios = require('axios');
const fs = require('fs');
const {
  PORTAL_API_URL,
  PORTAL_MPC_CLIENT_URL,
  SEPOLIA_RPC_URL,
} = require('./config');

async function waitForTransactionConfirmation(
  txHash,
  chainId,
  isAccountAbstracted,
  desiredConfirmations = 2,
  pollIntervalMs = 2000,
  timeoutSeconds = 600,
) {
  console.log(
    `Waiting for ${desiredConfirmations} confirmations on ${txHash}...`,
  );

  const startTime = Date.now();
  let minedBlock = null; // will be set once mined
  let confirmations = 0;

  while (true) {
    if (timeoutSeconds && (Date.now() - startTime) / 1000 > timeoutSeconds) {
      throw new Error(
        `Timeout waiting for ${desiredConfirmations} confirmations`,
      );
    }

    try {
      // Phase 1: still waiting to be mined → only need receipt
      if (!minedBlock) {
        const receiptRes = await axios.post(SEPOLIA_RPC_URL, {
          jsonrpc: '2.0',
          id: 1,
          method: isAccountAbstracted
            ? 'eth_getUserOperationReceipt'
            : 'eth_getTransactionReceipt',
          params: [txHash],
        });

        const receipt = isAccountAbstracted
          ? receiptRes?.data?.result?.receipt
          : receiptRes.data.result;

        if (!receipt) {
          console.log('Still pending...');
          await new Promise((r) => setTimeout(r, pollIntervalMs));
          continue;
        }

        if (receipt.status === '0x0') {
          throw new Error(`Transaction ${txHash} reverted`);
        }

        minedBlock = parseInt(receipt.blockNumber, 16);
        console.log(
          `Mined in block ${minedBlock}! Waiting for confirmations...`,
        );
        // fall through to Phase 2 on the same loop iteration if possible
      }

      // Phase 2: already mined → now we only need latest block number
      const latestBlockRes = await axios.post(SEPOLIA_RPC_URL, {
        jsonrpc: '2.0',
        id: 2,
        method: 'eth_blockNumber',
        params: [],
      });

      const latestBlock = parseInt(latestBlockRes.data.result, 16);
      confirmations = latestBlock - minedBlock + 1;

      console.log(`${confirmations}/${desiredConfirmations} confirmations`);

      if (confirmations >= desiredConfirmations) {
        console.log(
          `✅ Reached ${desiredConfirmations} confirmations (${confirmations} total)`,
        );
        return true;
      }
    } catch (err) {
      console.error('Polling error:', err.message);
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
}

/**
 * Helper function to sign and submit a single transaction sequentially
 * @param {object} transaction - The transaction object from Yield.xyz API
 * @param {string} clientApiKey - The client API key for authentication
 * @param {object} shares - The MPC shares object
 * @param {string} chainId - The chain ID in CAIP-2 format
 * @param {boolean} isAccountAbstracted - Whether the account is abstracted
 * @returns {Promise<boolean>} - True if transaction was signed, submitted, and confirmed successfully
 */
async function signAndSubmitTransactionSequential(
  transaction,
  clientApiKey,
  shares,
  chainId,
  isAccountAbstracted,
) {
  try {
    console.log(
      `\nProcessing transaction ${transaction.id} (Step ${transaction.stepIndex})...`,
    );

    // Parse the unsignedTransaction field (it's a JSON string)
    const unsignedTx = JSON.parse(transaction.unsignedTransaction);
    console.log('Parsed unsigned transaction:', unsignedTx);

    // Create transaction params for MPC signing
    const transactionParams = {
      from: unsignedTx.from,
      to: unsignedTx.to,
      value: unsignedTx.value || '0x0',
      data: unsignedTx.data || '0x',
    };

    // Sign and send the transaction using MPC API
    console.log('Signing and sending transaction via MPC API...');
    const signResponse = await axios.post(
      `${PORTAL_MPC_CLIENT_URL}/v1/sign`,
      {
        share: shares.SECP256K1.share,
        method: 'eth_sendTransaction',
        params: JSON.stringify(transactionParams),
        rpcUrl: SEPOLIA_RPC_URL,
        chainId: chainId,
      },
      {
        headers: { Authorization: `Bearer ${clientApiKey}` },
      },
    );

    if (signResponse.status !== 200) {
      console.error('Failed to sign transaction:', signResponse.data);
      return false;
    }

    const txHash = signResponse.data.data;
    console.log(`Transaction sent! Hash: ${txHash}`);

    // Track the transaction with Yield.xyz
    try {
      console.log(`Tracking transaction ${transaction.id} with Yield.xyz...`);
      await axios.put(
        `${PORTAL_API_URL}/api/v3/clients/me/integrations/yield-xyz/transactions/${transaction.id}/submit-hash`,
        { hash: txHash },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${clientApiKey}`,
          },
        },
      );
      console.log('Transaction tracked successfully with Yield.xyz');
    } catch (trackError) {
      // Tracking failure is not critical, continue with confirmation
      console.warn(
        'Warning: Failed to track transaction with Yield.xyz:',
        trackError.message,
      );
    }

    // Wait for transaction confirmation on-chain
    const confirmed = await waitForTransactionConfirmation(
      txHash,
      chainId,
      isAccountAbstracted,
    );

    if (!confirmed) {
      console.error(`Transaction ${transaction.id} failed to confirm`);
      return false;
    }

    console.log(`Transaction ${transaction.id} completed successfully!`);
    return true;
  } catch (error) {
    console.error(
      `Error processing transaction ${transaction.id}:`,
      error.message,
    );
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

/**
 * Helper function to process multiple transactions sequentially
 * @param {array} transactions - Array of transaction objects from Yield.xyz API
 * @param {string} clientApiKey - The client API key for authentication
 * @param {object} shares - The MPC shares object
 * @param {string} chainId - The chain ID in CAIP-2 format
 * @param {boolean} isAccountAbstracted - Whether the account is abstracted
 * @returns {Promise<boolean>} - True if all transactions were processed successfully
 */
async function processTransactionsSequentially(
  transactions,
  clientApiKey,
  shares,
  chainId,
  isAccountAbstracted,
) {
  // Sort transactions by stepIndex to ensure correct order
  const sortedTransactions = transactions.sort(
    (a, b) => a.stepIndex - b.stepIndex,
  );

  console.log(
    `\nProcessing ${sortedTransactions.length} transaction(s) sequentially...`,
  );

  for (const transaction of sortedTransactions) {
    // Only process transactions that have unsignedTransaction and status is CREATED
    if (transaction.unsignedTransaction && transaction.status === 'CREATED') {
      const success = await signAndSubmitTransactionSequential(
        transaction,
        clientApiKey,
        shares,
        chainId,
        isAccountAbstracted,
      );

      if (!success) {
        console.error('Transaction processing failed. Stopping execution.');
        return false;
      }
    } else {
      console.log(
        `Skipping transaction ${transaction.id} (status: ${transaction.status})`,
      );
    }
  }

  console.log('\nAll transactions processed successfully!');
  return true;
}

/**
 * Main function demonstrating Yield.xyz integration with Portal's Enclave MPC API
 * This example shows how to:
 * 1. Discover available yield opportunities
 * 2. Enter a yield position (stake tokens)
 * 3. Check yield balances
 */
async function YieldXyzExample() {
  try {
    console.log('=== Yield.xyz Integration Example ===\n');

    // Read clientApiKey from file
    const clientApiKey = fs.readFileSync('clientApiKey.txt', 'utf8').trim();

    // Read shares from file
    const shares = JSON.parse(fs.readFileSync('shares.txt', 'utf8'));

    // Check if shares and clientApiKey exist
    if (!shares || !clientApiKey) {
      console.error(
        'No shares or clientApiKey found, make sure to run the generate script first!',
      );
      return;
    }

    // Get wallet address from Portal API
    console.log('Getting wallet address...');
    const meResponse = await axios.get(`${PORTAL_API_URL}/api/v3/clients/me`, {
      headers: { Authorization: `Bearer ${clientApiKey}` },
    });

    if (meResponse.status !== 200) {
      console.error('Failed to get wallet address:', meResponse.data);
      return;
    }

    const walletAddress = meResponse.data.metadata.namespaces.eip155.address;
    if (!walletAddress) {
      console.error('No EVM wallet address found');
      return;
    }

    const isAccountAbstracted = meResponse.data.isAccountAbstracted;
    console.log(`Is account abstracted: ${isAccountAbstracted}`);

    console.log(`Wallet address: ${walletAddress}\n`);

    // Step 1: Discover yields
    console.log('Step 1: Discovering available yields...');
    const chainId = 'eip155:11155111'; // Sepolia testnet
    const yieldId = 'ethereum-sepolia-link-aave-v3-lending'; // LINK on Aave V3

    const discoverResponse = await axios.get(
      `${PORTAL_API_URL}/api/v3/clients/me/integrations/yield-xyz/yields`,
      {
        params: {
          yieldId: yieldId,
          network: chainId,
        },
        headers: { Authorization: `Bearer ${clientApiKey}` },
      },
    );

    if (discoverResponse.status !== 200) {
      console.error('Failed to discover yields:', discoverResponse.data);
      return;
    }

    const yields = discoverResponse.data.data.rawResponse.items;
    if (!yields || yields.length === 0) {
      console.error('No yields found for the specified criteria');
      return;
    }

    const selectedYield = yields[0];
    console.log(`Found yield: ${selectedYield.metadata.name}`);
    console.log(`Description: ${selectedYield.metadata.description}`);
    console.log(`APY: ${(selectedYield.rewardRate.total * 100).toFixed(2)}%`);
    console.log(`Can enter: ${selectedYield.status.enter}`);
    console.log(`Can exit: ${selectedYield.status.exit}\n`);

    if (!selectedYield.status.enter) {
      console.error('Cannot enter this yield position at this time');
      return;
    }

    // Step 2: Enter yield position
    console.log('Step 2: Entering yield position...');
    const enterAmount = '0.001'; // 0.001 LINK

    const enterResponse = await axios.post(
      `${PORTAL_API_URL}/api/v3/clients/me/integrations/yield-xyz/actions/enter`,
      {
        yieldId: yieldId,
        address: walletAddress,
        arguments: {
          amount: enterAmount,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clientApiKey}`,
        },
      },
    );

    if (enterResponse.status !== 200) {
      console.error('Failed to create enter action:', enterResponse.data);
      return;
    }

    const transactions = enterResponse.data.data.rawResponse.transactions;
    console.log(
      `Received ${transactions.length} transaction(s) to process\n`,
      transactions,
    );

    // Step 3: Process transactions sequentially
    console.log('Step 3: Processing transactions...');
    const success = await processTransactionsSequentially(
      transactions,
      clientApiKey,
      shares,
      chainId,
      isAccountAbstracted,
    );

    if (!success) {
      console.error('Failed to process transactions');
      return;
    }

    // Step 4: Check yield balances
    console.log('\nStep 4: Checking yield balances...');
    const balancesResponse = await axios.post(
      `${PORTAL_API_URL}/api/v3/clients/me/integrations/yield-xyz/yields/balances`,
      {
        queries: [
          {
            address: walletAddress,
            network: chainId,
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clientApiKey}`,
        },
      },
    );

    if (balancesResponse.status !== 200) {
      console.error('Failed to get yield balances:', balancesResponse.data);
      return;
    }

    const yieldBalances = balancesResponse.data.data.rawResponse.items;
    console.log('\nYield Balances:');
    console.log(JSON.stringify(yieldBalances, null, 2));

    console.log('\n=== Yield.xyz Integration Example Complete ===');
  } catch (error) {
    console.error('Error in YieldXyzExample:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

module.exports = YieldXyzExample;
