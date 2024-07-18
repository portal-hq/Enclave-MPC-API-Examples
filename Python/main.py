import asyncio
from signup import signup
from generate import generate
from backup import backup
from recover import recover
from eth_sign import sign_eth


async def main():
    # Call Signup function
    await signup()

    # Call generate function
    await generate()

    # Call backup function
    await backup()

    # Call recover function
    await recover()

    # Sign an Ethereum transaction
    await sign_eth()


if __name__ == "__main__":
    asyncio.run(main())
