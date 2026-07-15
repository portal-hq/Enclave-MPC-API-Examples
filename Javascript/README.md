# JS Example: Interacting with Portal's MPC Signer API

This repository contains examples of interacting with Portal's MPC Signer API using JavaScript. The examples demonstrate various functionalities such as generating, backing up, and recovering a wallet. Additionally, it includes examples of signing transactions on Ethereum and Solana.

## Overview

This file lays out examples for how to interact with Portal's MPC API Signer. It showcases how to generate, backup, and recover a wallet. Additionally, it provides examples of signing Ethereum and Solana transactions.

### Signup Functionality

The signup functionality is an example implementation of what a customer implementation would be like. Portal is auth agnostic, meaning that Portal's customer is responsible for signing up a user and generating a Portal client from their backend. In this example, we interact with the `PORTAL_EX` signup endpoint. On the server side, the example customer implementation creates a client with Portal using its organization API key and returns the newly created client's API key to our script. This client API key will be used to run generate, backup, recover, and sign operations.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed on your machine:

- [Node.js](https://nodejs.org/) (version 18.18.0)
- [Yarn](https://yarnpkg.com/) (version 1.22.18)

### Clone the Repository

```bash
git clone git@github.com:portal-hq/Enclave-Signer-API-Examples.git
cd Enclave-Signer-API-Examples && cd Javascript
```

### Install Dependencies

Using npm:

```bash
npm install
```

Or using yarn:

```bash
yarn install
```

### Environment Variables

A `.env.example` file is provided in the repository. Copy this file to create your own `.env` file:

```bash
cp .env.example .env
```

Then, edit the `.env` file to fill in your specific values:

```
# Environment
NODE_ENV=DEV

# Portal API URLs for your selected environment
PROD_PORTAL_API_URL=https://api.portalhq.io
PROD_PORTAL_MPC_CLIENT_URL=https://mpc-client.portalhq.io:443
PROD_PORTAL_EX=https://portalex-mpc.portalhq.io

# Ethereum RPC URL
ETH_SEPOLIA_RPC_URL=https://your-custom-eth-rpc-url

# Other configuration values
BLOCKCYPHER_TOKEN=your-blockcypher-token
TATUM_API_KEY=your-tatum-api-key
```

Make sure to fill in all the required values in the `.env` file before running the examples.

## Running the Examples

To run all steps together, simply run:

```bash
yarn start
```

If you would like to run a step individually, simply run:

```bash
yarn <NAME OF STEP>
```

Below is a breakdown of each individual step.

### Signup

To run the signup example, use the following command:

```bash
yarn signup
```

### Generate

To run the generate example, use the following command:

```bash
yarn generate
```

### Backup

To run the backup example, use the following command:

```bash
yarn backup
```

### Recover

To run the recover example, use the following command:

```bash
yarn recover
```

### Sign Ethereum Transaction

To run the Ethereum signing example, use the following command:

```bash
yarn signeth
```

### Sign Solana Transaction

To run the Solana signing example, use the following command:

```bash
yarn signsol
```

### Co-Sign Solana Transaction With Fee Payer

To run the co-signing example where you have a separate fee payer for the Solana transaction, use the following command:

```bash
yarn coSignsol
```

### Send USDC (ERC-20)

These examples (in `eth-send-assets.js`) send USDC using Portal's enclave `assets/send` endpoint, which builds, signs, and broadcasts the ERC-20 transfer for you — no need to hand-build the transaction. The same endpoint and helper send any asset by changing the `token` argument (`NATIVE`, a shorthand like `USDC`/`USDT`, or a contract address) — see the `sendAsset` function.

Two flows are demonstrated:

- **Account Abstraction (gas sponsored).** Portal sponsors the gas, so the wallet does not need to hold any native token. This requires an AA client, so sign up with the `isAA` flag first:

  ```bash
  yarn signup isAA
  yarn generate
  yarn sendUsdcSponsored
  ```

- **Non-AA (wallet pays its own gas).** A standard wallet pays its own gas and **must hold the chain's native token** (e.g. Sepolia ETH). Without it, the request fails with an insufficient-balance error even when the wallet holds plenty of USDC.

  ```bash
  yarn signup
  yarn generate
  yarn sendUsdc
  ```

> **Note:** Make sure the wallet holds testnet USDC before sending (and, for the non-AA flow, some native gas). You can get testnet USDC from the [Circle faucet](https://faucet.circle.com/). If the `USDC` shorthand isn't supported on your target chain, pass the USDC contract address as the `token` instead.

### Yield.xyz Integration

To run the Yield.xyz integration example, which demonstrates how to discover yields, enter a yield position, and check balances, use the following command:

```bash
yarn yieldxyz
```

**Note:** This example uses Alchemy RPC for transaction receipt polling. Make sure your `ETH_SEPOLIA_RPC_URL` in the `.env` file is set to a valid Alchemy endpoint (e.g., `https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY`). The example targets the Sepolia testnet and uses LINK token on Aave V3.

## Additional Scripts

### Lint the Code

To lint your code using ESLint and automatically fix issues, use the following command:

```bash
yarn lint
```

### Format the Code

To format your code using Prettier, use the following command:

```bash
yarn format
```

## File Structure

- `main.js`: The main script that sequentially calls all functions (signup, generate, backup, recover, signeth, signsol).
- `signup.js`: Script for signing up and obtaining the client API key.
- `generate.js`: Script for generating MPC shares.
- `backup.js`: Script for backing up MPC shares.
- `recover.js`: Script for recovering MPC shares.
- `eth-sign.js`: Script for signing Ethereum transactions.
- `eth-send-assets.js`: Script for sending assets via the enclave `assets/send` endpoint — native tokens plus USDC, covering both the AA (gas sponsored) and non-AA (wallet pays gas) flows.
- `sol-sign.js`: Script for signing Solana transactions.
- `yieldxyz.js`: Script demonstrating Yield.xyz integration for discovering yields, entering positions, and checking balances.
- `clientApiKey.txt`: File to store the client API key obtained during signup.
- `shares.txt`: File to store the generated MPC shares.
