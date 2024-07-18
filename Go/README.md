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

Create a `.env` file in the root of your project to store your environment variables:

```
ETH_RPC_URL=https://your-custom-eth-rpc-url
```

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

## Additional Information

### Format the Code

To format your code using `gofmt`, use the following command:

```
gofmt -s -w .
```

## File Structure

- `cmd/main.go`: The main script that sequentially calls all functions (signup, generate, backup, recover, signeth).
- `cmd/signup/main.go`: Script for running the signup function.
- `cmd/generate/main.go`: Script for running the generate function.
- `cmd/backup/main.go`: Script for running the backup function.
- `cmd/recover/main.go`: Script for running the recover function.
- `cmd/eth_sign/main.go`: Script for running the Ethereum signing function.
- `signup/signup.go`: Contains the implementation of the signup function.
- `generate/generate.go`: Contains the implementation of the generate function.
- `backup/backup.go`: Contains the implementation of the backup function.
- `recover/recover.go`: Contains the implementation of the recover function.
- `eth_sign/eth_sign.go`: Contains the implementation of the Ethereum signing function.
- `clientApiKey.txt`: File to store the client API key obtained during signup.
- `shares.txt`: File to store the generated MPC shares.
- `backupShares.txt`: File to store the backup MPC shares.
"""