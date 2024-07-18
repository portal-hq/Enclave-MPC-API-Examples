# Python Example: Interacting with Portal's MPC Signer API

This repository contains examples of interacting with Portal's MPC Signer API using Python. The examples demonstrate various functionalities such as generating, backing up, and recovering a wallet. Additionally, it includes an example of signing a transaction on Ethereum.

## Overview

This file lays out examples for how to interact with Portal's MPC API Signer. It showcases how to generate, backup, and recover a wallet. Additionally, it provides an example of signing an Ethereum transaction.

### Signup Functionality

The signup functionality is an example implementation of what a customer implementation would be like. Portal is auth agnostic, meaning that Portal's customer is responsible for signing up a user and generating a Portal client from their backend. In this example, we interact with the `PORTAL_EX` signup endpoint. On the server side, the example customer implementation creates a client with Portal using its organization API key and returns the newly created client's API key to our script. This client API k...

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed on your machine:

- [Python](https://www.python.org/downloads/) (version 3.8 or later)
- [pip](https://pip.pypa.io/en/stable/installation/) (version 20.0 or later)

### Clone the Repository

```
git clone git@github.com:portal-hq/Enclave-Signer-API-Examples.git
cd Enclave-Signer-API-Examples && cd Python
```

### Create a Virtual Environment

It is recommended to use a virtual environment to manage dependencies:

```
python3 -m venv myenv
source myenv/bin/activate  # On Windows use \`myenv\Scripts\activate\`
```

### Install Dependencies

Install the required dependencies using pip:

```
pip install -r requirements.txt
```

### Environment Variables

Create a `.env` file in the root of your project to store your environment variables:

```
ETH_RPC_URL=https://your-custom-eth-rpc-url
```

## Running the Examples

To run all steps together, simply run:

```
python main.py
```

If you would like to run a step individually, simply run:

```
python <NAME OF SCRIPT>.py
```

Below is a breakdown of each individual step.

### Signup

To run the signup example, use the following command:

```
python signup.py
```

### Generate

To run the generate example, use the following command:

```
python generate.py
```

### Backup

To run the backup example, use the following command:

```
python backup.py
```

### Recover

To run the recover example, use the following command:

```
python recover.py
```

### Sign Ethereum Transaction

To run the Ethereum signing example, use the following command:

```
python eth_sign.py
```

## Additional Scripts

### Lint the Code

To lint your code using pylint, use the following command:

```
pylint *.py
```

### Format the Code

To format your code using Black, use the following command:

```
black *.py
```

## File Structure

- \`main.py\`: The main script that sequentially calls all functions (signup, generate, backup, recover, eth_sign).
- \`signup.py\`: Script for signing up and obtaining the client API key.
- \`generate.py\`: Script for generating MPC shares.
- \`backup.py\`: Script for backing up MPC shares.
- \`recover.py\`: Script for recovering MPC shares.
- \`eth_sign.py\`: Script for signing Ethereum transactions.
- \`clientApiKey.txt\`: File to store the client API key obtained during signup.
- \`shares.txt\`: File to store the generated MPC shares.
- \`backupShares.txt\`: File to store the backup MPC shares.

