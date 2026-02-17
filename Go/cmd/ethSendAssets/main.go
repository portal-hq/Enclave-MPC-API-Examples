package main

import (
	"fmt"
	"log"
	"portal-hq/Enclave-Signer-API-Examples/ethSendAssets"
)

func main() {
	fmt.Println("Sending ETH assets...")
	if err := ethSendAssets.SendAssets(); err != nil {
		log.Fatalf("Error sending ETH assets: %v", err)
	}
}
