import aiohttp
import asyncio
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import constants from config.py
from config import PORTAL_API_URL, PORTAL_MPC_CLIENT_URL


async def generate():
    # Read clientApiKey from file
    try:
        with open("clientApiKey.txt", "r") as file:
            client_api_key = file.read().strip()
    except FileNotFoundError:
        print("No clientApiKey found, make sure to run the signup script first!")
        return

    async with aiohttp.ClientSession() as session:
        # Generate MPC shares
        async with session.post(
            f"{PORTAL_MPC_CLIENT_URL}/v1/generate",
            json={},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {client_api_key}",
            },
        ) as response:
            if response.status != 200:
                print(f"Failed to generate MPC shares: {await response.json()}")
                return
            data = await response.json()
            SECP256K1 = data["SECP256K1"]
            ED25519 = data["ED25519"]
            print(
                f'Successfully generated MPC shares {SECP256K1["id"]} and {ED25519["id"]}!'
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

        # Write shares to file
        with open("shares.txt", "w") as file:
            file.write(json.dumps(data))

        # Get wallet addresses
        async with session.get(
            f"{PORTAL_API_URL}/api/v3/clients/me",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {client_api_key}",
            },
        ) as response:
            if response.status != 200:
                print(f"Failed to get client info: {await response.json()}")
                return
            me_data = await response.json()
            solana_address = me_data["metadata"]["namespaces"]["solana"]["address"]
            eip155_address = me_data["metadata"]["namespaces"]["eip155"]["address"]
            print(
                f"Successfully generated wallets with Solana address {solana_address} and Eth address {eip155_address}!"
            )


if __name__ == "__main__":
    asyncio.run(generate())
