package main

import (
	"log"
	"os"
	"portal-hq/Enclave-Signer-API-Examples/solSign"
)

func main() {
	// Check if an address was provided as a command-line argument
	feePayerAddress := ""
	if len(os.Args) > 1 {
		feePayerAddress = os.Args[1]
	}

	err := solSign.Sign(feePayerAddress)
	if err != nil {
		log.Fatalf("SignSol failed: %v", err)
	}

	err = solSign.SignMessage()
	if err != nil {
		log.Fatalf("SignSolMessage failed: %v", err)
	}
}
