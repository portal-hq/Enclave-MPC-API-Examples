package config

import (
	"os"
)

// Constants for the URLs
const (
	PORTAL_API_URL        = "https://api.portalhq.io"
	PORTAL_MPC_CLIENT_URL = "https://mpc-client.portalhq.io:443"
	PORTAL_EX             = "https://portalex-mpc.portalhq.io"
)

// ethRpc reads the ETH_RPC_URL environment variable, or uses a default value if not set
var ethRpc = getEnv("ETH_RPC_URL", "https://sepolia.infura.io/v3/<API_KEY>")

// getEnv is a helper function to read an environment variable or return a default value
func getEnv(key, defaultValue string) string {
	value, exists := os.LookupEnv(key)
	if !exists {
		return defaultValue
	}
	return value
}
