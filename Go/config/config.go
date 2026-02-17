package config

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

// LoadEnv loads environment variables from a .env file if it exists
func LoadEnv() error {
	file, err := os.Open(".env")
	if err != nil {
		// .env file is optional, so we don't return an error if it doesn't exist
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("error opening .env file: %v", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		// Skip empty lines and comments
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Split on the first = sign
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		// Set the environment variable if it's not already set
		if os.Getenv(key) == "" {
			os.Setenv(key, value)
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("error reading .env file: %v", err)
	}

	return nil
}

// getEnv is a helper function to read an environment variable or return a default value
func getEnv(key, defaultValue string) string {
	value, exists := os.LookupEnv(key)
	if !exists || value == "" {
		return defaultValue
	}
	return value
}

// GetPortalAPIURL returns the Portal API URL based on the environment
func GetPortalAPIURL() string {
	env := getEnv("ENV", "PROD")
	return getEnv(env+"_PORTAL_API_URL", "https://api.portalhq.io")
}

// GetPortalMPCClientURL returns the Portal MPC Client URL based on the environment
func GetPortalMPCClientURL() string {
	env := getEnv("ENV", "PROD")
	return getEnv(env+"_PORTAL_MPC_CLIENT_URL", "https://mpc-client.portalhq.io:443")
}

// GetPortalEx returns the Portal Ex URL based on the environment
func GetPortalEx() string {
	env := getEnv("ENV", "PROD")
	return getEnv(env+"_PORTAL_EX", "https://portalex-mpc.portalhq.io")
}

// GetEthSepoliaRpcURL returns the Ethereum Sepolia RPC URL
func GetEthSepoliaRpcURL() string {
	return getEnv("ETH_SEPOLIA_RPC_URL", "https://eth-sepolia.g.alchemy.com/v2/<API_KEY>")
}

// GetBlockCypherAPIURL returns the BlockCypher API URL
func GetBlockCypherAPIURL() string {
	return getEnv("BLOCKCYPHER_API_URL", "https://api.blockcypher.com/v1/btc/test3")
}

// GetBlockCypherToken returns the BlockCypher token
func GetBlockCypherToken() string {
	return getEnv("BLOCKCYPHER_TOKEN", "")
}

// GetBitcoinFeeRate returns the Bitcoin fee rate
func GetBitcoinFeeRate() string {
	return getEnv("BITCOIN_FEE_RATE", "10")
}

// GetBitcoinDustLimit returns the Bitcoin dust limit
func GetBitcoinDustLimit() string {
	return getEnv("BITCOIN_DUST_LIMIT", "546")
}

// GetTatumAPIKey returns the Tatum API key
func GetTatumAPIKey() string {
	return getEnv("TATUM_API_KEY", "")
}

// GetTatumAPIURL returns the Tatum API URL
func GetTatumAPIURL() string {
	return getEnv("TATUM_API_URL", "https://api.tatum.io/v3")
}
