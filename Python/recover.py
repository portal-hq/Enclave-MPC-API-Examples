import aiohttp
import asyncio
import os
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import constants from config.py
from config import PORTAL_API_URL, PORTAL_MPC_CLIENT_URL


async def recover():
    # Read clientApiKey from file
    try:
        with open("clientApiKey.txt", "r") as file:
            client_api_key = file.read().strip()
    except FileNotFoundError:
        print("No clientApiKey found, make sure to run the signup script first!")
        return

    # Read shares from file
    try:
        with open("backupShares.txt", "r") as file:
            shares = json.load(file)
    except FileNotFoundError:
        print("No shares found, make sure to run the generate script first!")
        return

    async with aiohttp.ClientSession() as session:
        # Recover MPC shares
        async with session.post(
            f"{PORTAL_MPC_CLIENT_URL}/v1/recover",
            json={"backupResponse": json.dumps(shares)},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {client_api_key}",
            },
        ) as response:
            if response.status != 200:
                print(f"Failed to recover MPC shares: {await response.json()}")
                return
            recover_data = await response.json()
            SECP256K1 = recover_data["SECP256K1"]
            ED25519 = recover_data["ED25519"]
            print(
                f'Successfully recovered signing shares with ID: {SECP256K1["id"]}, {ED25519["id"]}'
            )

        # Update MPC shares status
        async with session.patch(
            f"{PORTAL_API_URL}/api/v3/clients/me/signing-share-pairs",
            json={
                "status": "STORED_CLIENT",
                "signingSharePairIds": [SECP256K1["id"], ED25519["id"]],
            },
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {client_api_key}",
            },
        ) as response:
            if response.status != 204:
                print(f"Failed to update MPC shares status: {await response.json()}")
                return

        print("Successfully updated MPC shares status!")


if __name__ == "__main__":
    asyncio.run(recover())
