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

Create a `.env` file in the root of your project to store your environment variables:

```
ETH_RPC_URL=https://your-custom-eth-rpc-url
```

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
- `sol-sign.js`: Script for signing Solana transactions.
- `clientApiKey.txt`: File to store the client API key obtained during signup.
- `shares.txt`: File to store the generated MPC shares.
