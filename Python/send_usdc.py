import aiohttp
import asyncio
import sys
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import constants from config.py
from config import PORTAL_API_URL, PORTAL_MPC_CLIENT_URL, SEPOLIA_RPC_URL

# The chain to send USDC on. Accepts a CAIP-2 chain ID (e.g. eip155:11155111
# for Ethereum Sepolia) or a friendly name like "sepolia" or "base".
CHAIN = "eip155:11155111"

# The token to send. "USDC" is a shorthand the enclave resolves to the correct
# ERC-20 contract for the selected chain. You can also pass a raw ERC-20
# contract address directly if the shorthand isn't supported on your chain.
TOKEN = "USDC"

# Recipient address and amount. The amount is in human units, so "1" sends
# 1 USDC (the enclave handles the token's decimals for you).
TO_ADDRESS = "0xcae0d97d201ad54275b6e8a6b547c7611ad47963"
AMOUNT = "1"


async def send_usdc(sponsor_gas):
    """Send USDC from the client's wallet via Portal's enclave `assets/send`
    endpoint, which builds, signs, and broadcasts the ERC-20 transfer for you.

    The sponsor_gas flag selects between the two supported flows:

      - AA flow (sponsor_gas=True): requires an Account Abstraction client,
        created at signup with isAccountAbstracted: True. Portal sponsors the
        gas, so the wallet does NOT need to hold any native token. Omitting
        sponsorGas produces the same behavior for AA clients.

      - Non-AA flow (sponsor_gas=False): a standard EOA wallet pays its own gas
        and MUST hold the chain's native token (e.g. Sepolia ETH) to cover the
        transfer. Without it, the request fails with an insufficient-balance
        error even when the wallet holds plenty of USDC.
    """
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

    async with aiohttp.ClientSession() as session:
        # Look up the wallet's EVM address so we can log who is sending.
        async with session.get(
            f"{PORTAL_API_URL}/api/v3/clients/me",
            headers={"Authorization": f"Bearer {client_api_key}"},
        ) as me_response:
            if me_response.status != 200:
                print(f"Failed to get client info: {await me_response.json()}")
                return
            me_data = await me_response.json()
            eth_address = me_data["metadata"]["namespaces"]["eip155"]["address"]
            print(
                f"Sending {AMOUNT} {TOKEN} from {eth_address} (sponsorGas={sponsor_gas})"
            )

        # Send the USDC. The enclave builds the ERC-20 transfer, signs it with
        # the MPC share, and broadcasts it through the provided RPC URL.
        async with session.post(
            f"{PORTAL_MPC_CLIENT_URL}/v1/assets/send",
            json={
                "share": shares["SECP256K1"]["share"],
                "chain": CHAIN,
                "to": TO_ADDRESS,
                "token": TOKEN,
                "amount": AMOUNT,
                "rpcUrl": SEPOLIA_RPC_URL,
                # sponsorGas only affects Account Abstraction clients. It is
                # ignored for standard clients (which always pay their own gas).
                "sponsorGas": sponsor_gas,
            },
            headers={"Authorization": f"Bearer {client_api_key}"},
        ) as response:
            if response.status != 200:
                print(f"Failed to send USDC: {await response.json()}")
                return
            send_data = await response.json()
            print(f"Successfully sent USDC: {send_data}")


if __name__ == "__main__":
    # Default to the non-AA flow (the wallet pays its own gas). Pass "sponsored"
    # to run the Account Abstraction flow where Portal sponsors the gas:
    #   python send_usdc.py sponsored
    sponsor = len(sys.argv) > 1 and sys.argv[1] == "sponsored"
    asyncio.run(send_usdc(sponsor))
