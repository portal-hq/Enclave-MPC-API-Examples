import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Define constants
PORTAL_API_URL = "https://api.portalhq.io"
PORTAL_MPC_CLIENT_URL = "https://mpc-client.portalhq.io:443"
PORTAL_EX = "https://portalex-mpc.portalhq.io"
SEPOLIA_RPC_URL = os.getenv("ETH_SEPOLIA_RPC_URL", "https://sepolia.infura.io/v3/<API_KEY>")

# Export constants
__all__ = ["PORTAL_API_URL", "PORTAL_MPC_CLIENT_URL", "PORTAL_EX", "SEPOLIA_RPC_URL"]
