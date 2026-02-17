package main

import (
	"fmt"
	"log"
	"portal-hq/Enclave-Signer-API-Examples/ethSignTypedData"
)

func main() {
	fmt.Println("Signing Ethereum typed data...")
	if err := ethSignTypedData.SignTypedData(); err != nil {
		log.Fatalf("Error signing typed data: %v", err)
	}
}
