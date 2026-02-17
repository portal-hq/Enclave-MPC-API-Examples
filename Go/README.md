# Go Example: Interacting with Portal's MPC Signer API

This repository contains examples of interacting with Portal's MPC Signer API using Go. The examples demonstrate various functionalities such as generating, backing up, and recovering a wallet. Additionally, it includes examples of signing transactions on Ethereum and Solana.

## Overview

This file lays out examples for how to interact with Portal's MPC API Signer. It showcases how to generate, backup, and recover a wallet. Additionally, it provides examples of signing Ethereum and Solana transactions.

### Signup Functionality

The signup functionality is an example implementation of what a customer implementation would be like. Portal is auth agnostic, meaning that Portal's customer is responsible for signing up a user and generating a Portal client from their backend. In this example, we interact with the `PORTAL_EX` signup endpoint. On the server side, the example customer implementation creates a client with Portal using its organization API key and returns the newly created client's API key to our script. This client API key will be used to run generate, backup, recover, and sign operations.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed on your machine:

- [Go](https://golang.org/dl/) (version 1.21.1 or later)

### Clone the Repository

```
git clone git@github.com:portal-hq/Enclave-Signer-API-Examples.git
cd Enclave-Signer-API-Examples && cd Go
```

### Install Dependencies

Go modules will automatically manage dependencies. You can initialize the module and download dependencies using:

```
go mod tidy
```

### Environment Variables

A `.env.example` file is provided in the repository. Copy this file to create your own `.env` file:

```
cp .env.example .env
```

Then, edit the `.env` file to fill in your specific values:

```
# Environment (DEV, STAGING, or PROD)
ENV=DEV

# Portal API URLs for DEV environment
DEV_PORTAL_API_URL=https://api.dev.portalhq.io
DEV_PORTAL_MPC_CLIENT_URL=https://mpc-client.dev.portalhq.io:443
DEV_PORTAL_EX=https://portalex-mpc.dev.portalhq.io

# Portal API URLs for STAGING environment
STAGING_PORTAL_API_URL=https://api.staging.portalhq.io
STAGING_PORTAL_MPC_CLIENT_URL=https://mpc-client.staging.portalhq.io:443
STAGING_PORTAL_EX=https://portalex-mpc.staging.portalhq.io

# Portal API URLs for PROD environment
PROD_PORTAL_API_URL=https://api.portalhq.io
PROD_PORTAL_MPC_CLIENT_URL=https://mpc-client.portalhq.io:443
PROD_PORTAL_EX=https://portalex-mpc.portalhq.io

# Ethereum RPC URL
ETH_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
```

Make sure to set the `ENV` variable to the environment you want to use (DEV, STAGING, or PROD), and fill in the Ethereum RPC URL with your Alchemy or Infura endpoint.

## Running the Examples

To run all steps together, simply run:

```
make main
```

If you would like to run a step individually, simply run:

```
make <step>
```

Replace `<step>` with one of the following:

- signup
- generate
- backup
- recover
- signeth
- signethAssets
- signethTypedData
- signsol

Below is a breakdown of each individual step.

### Signup

To run the signup example, use the following command:

```
make signup
```

### Generate

To run the generate example, use the following command:

```
make generate
```

### Backup

To run the backup example, use the following command:

```
make backup
```

### Recover

To run the recover example, use the following command:

```
make recover
```

### Sign Ethereum Transaction

To run the Ethereum signing example, use the following command:

```
make signeth
```

### Send Ethereum Assets

To run the Ethereum asset sending example (using the `/v1/assets/send` endpoint), use the following command:

```
make signethAssets
```

This example demonstrates how to send native ETH or tokens using Portal's simplified assets API.

### Sign Ethereum Typed Data

To run the Ethereum typed data signing example (EIP-712), use the following command:

```
make signethTypedData
```

This example demonstrates how to sign structured typed data for EIP-712 compatible applications.

### Sign Solana Transaction

To run the Solana signing example, use the following command:

```
make signsol
```

You can also specify a fee payer address:

```
make signsol ADDRESS=your_solana_address
```

## Additional Information

### Format the Code

To format your code using `gofmt`, use the following command:

```
gofmt -s -w .
```

## File Structure

- `main.go`: The main script that sequentially calls all functions (signup, generate, backup, recover, signeth).
- `cmd/signup/main.go`: Script for running the signup function.
- `cmd/generate/main.go`: Script for running the generate function.
- `cmd/backup/main.go`: Script for running the backup function.
- `cmd/recover/main.go`: Script for running the recover function.
- `cmd/ethSign/main.go`: Script for running the Ethereum signing function.
- `cmd/ethSendAssets/main.go`: Script for running the Ethereum asset sending function.
- `cmd/ethSignTypedData/main.go`: Script for running the Ethereum typed data signing function.
- `cmd/solSign/main.go`: Script for running the Solana signing function.
- `signup/signup.go`: Contains the implementation of the signup function.
- `generate/generate.go`: Contains the implementation of the generate function.
- `backup/backup.go`: Contains the implementation of the backup function.
- `recover/recover.go`: Contains the implementation of the recover function.
- `ethSign/ethSign.go`: Contains the implementation of the Ethereum signing function.
- `ethSendAssets/ethSendAssets.go`: Contains the implementation of the Ethereum asset sending function.
- `ethSignTypedData/ethSignTypedData.go`: Contains the implementation of the Ethereum typed data signing function.
- `solSign/solSign.go`: Contains the implementation of the Solana signing function.
- `config/config.go`: Contains configuration management and environment variable handling.
- `pkg/httpHelpers.go`: Contains HTTP helper functions for API requests.
- `clientApiKey.txt`: File to store the client API key obtained during signup.
- `shares.txt`: File to store the generated MPC shares.
- `backupShares.txt`: File to store the backup MPC shares.
- `.env`: Environment configuration file (create from `.env.example`).
