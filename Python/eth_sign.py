import aiohttp
import asyncio
import os
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import constants from config.py
from config import PORTAL_MPC_CLIENT_URL, ethRpc


async def sign_eth():
    # Read clientApiKey from file
    try:
        with open("clientApiKey.txt", "r") as file:
            client_api_key = file.read().strip()
    except FileNotFoundError:
        print("No clientApiKey found, make sure to run the signup script first!")
        return

    # Read shares from file
    try:
        with open("shares.txt", "r") as file:
            shares = json.load(file)
    except FileNotFoundError:
        print("No shares found, make sure to run the generate script first!")
        return

    # Check if shares and clientApiKey exist
    if not shares or not client_api_key:
        print(
            "No shares or clientApiKey found, make sure to run the generate script first!"
        )
        return

    # Below is an example of an Ethereum eip1559 transaction
    transaction_params = {
        "maxFeePerGas": "0x2540BE400",
        "nonce": "0x01",
        "maxPriorityFeePerGas": "0x3B9ACA00",
        "value": "0x3B9ACA00",
        "from": "0xabda788be4d93f40f38a8ba47c32a2f2874564be",
        "to": "0xcae0d97d201ad54275b6e8a6b547c7611ad47963",
        "data": "",
        "gasLimit": "0x3B9ACA00",
    }

    # Sign the transaction
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{PORTAL_MPC_CLIENT_URL}/v1/sign",
            json={
                "share": shares["SECP256K1"]["share"],
                "method": "eth_signTransaction",
                "params": json.dumps(transaction_params),
                "rpcUrl": ethRpc,
                "chainId": "eip155:11155111",  # Sepolia chain ID
            },
            headers={"Authorization": f"Bearer {client_api_key}"},
        ) as response:
            if response.status != 200:
                print(f"Failed to sign transaction: {await response.json()}")
                return
            sign_data = await response.json()
            print(
                f'Successfully Eth signed transaction with signature {sign_data["data"]}!'
            )


if __name__ == "__main__":
    asyncio.run(sign_eth())
