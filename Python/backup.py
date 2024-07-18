import aiohttp
import asyncio
import os
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import constants from config.py
from config import PORTAL_API_URL, PORTAL_MPC_CLIENT_URL


async def backup():
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

    async with aiohttp.ClientSession() as session:
        # Backup MPC shares
        async with session.post(
            f"{PORTAL_MPC_CLIENT_URL}/v1/backup",
            json={"generateResponse": json.dumps(shares)},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {client_api_key}",
            },
        ) as response:
            if response.status != 200:
                print(f"Failed to backup MPC shares: {await response.json()}")
                return
            backup_data = await response.json()
            SECP256K1 = backup_data["SECP256K1"]
            ED25519 = backup_data["ED25519"]
            print(
                f'Successfully backed up MPC shares {SECP256K1["id"]} and {ED25519["id"]}!'
            )

        # Update MPC shares status
        async with session.patch(
            f"{PORTAL_API_URL}/api/v3/clients/me/backup-share-pairs",
            json={
                "status": "STORED_CLIENT_BACKUP_SHARE",
                "backupSharePairIds": [SECP256K1["id"], ED25519["id"]],
            },
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {client_api_key}",
            },
        ) as response:
            if response.status != 204:
                print(f"Failed to update MPC shares status: {await response.json()}")
                return

        # Write backup shares to file
        with open("backupShares.txt", "w") as file:
            file.write(json.dumps(backup_data))
        print("Successfully updated MPC shares status!")


if __name__ == "__main__":
    asyncio.run(backup())
