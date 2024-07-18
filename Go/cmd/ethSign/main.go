package main

import (
	"log"
	"portal-hq/Enclave-Signer-API-Examples/ethSign"
)

func main() {
	// Run backup
	err := ethSign.Sign()
	if err != nil {
		log.Fatalf("Recover failed: %v", err)
	}
}
