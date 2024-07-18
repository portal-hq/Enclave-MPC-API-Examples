import uuid
import aiohttp
import asyncio
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import constants from config.py
from config import PORTAL_EX


async def signup():
    now = datetime.utcnow().isoformat()
    my_uuid = uuid.uuid4()
    username = f"python-example-{now}{my_uuid}"

    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{PORTAL_EX}/mobile/signup",
            json={"username": username, "isAccountAbstracted": False},
            headers={"Content-Type": "application/json"},
        ) as response:
            if response.status != 200:
                print(f"Failed to sign up: {await response.json()}")
                return
            data = await response.json()
            print(f"Successfully signed up user {username}!")
            client_api_key = data["clientApiKey"]

            # Write clientApiKey to a file
            with open("clientApiKey.txt", "w") as file:
                file.write(client_api_key)


if __name__ == "__main__":
    asyncio.run(signup())
