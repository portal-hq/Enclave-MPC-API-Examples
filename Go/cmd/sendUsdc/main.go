package main

import (
	"log"
	"os"
	"portal-hq/Enclave-Signer-API-Examples/sendUsdc"
)

func main() {
	// Default to the non-AA flow (the wallet pays its own gas). Pass "sponsored"
	// to run the Account Abstraction flow where Portal sponsors the gas:
	//   make sendUsdcSponsored
	sponsorGas := len(os.Args) > 1 && os.Args[1] == "sponsored"

	if err := sendUsdc.Send(sponsorGas); err != nil {
		log.Fatalf("Send USDC failed: %v", err)
	}
}
