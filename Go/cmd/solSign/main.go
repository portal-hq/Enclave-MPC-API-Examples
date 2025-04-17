package main

import (
	"fmt"
	"log"
	"os"
	"portal-hq/Enclave-Signer-API-Examples/solSign"
)

func printUsage() {
	fmt.Println("Usage:")
	fmt.Println("  solsign                     - Sign a transaction with your MPC wallet")
	fmt.Println("  solsign cosigner            - Generate a Solana cosigner keypair")
	fmt.Println("  solsign cosign ADDRESS      - Cosign a transaction with the specified address")
	fmt.Println("  solsign message             - Sign a message with your MPC wallet")
}

func main() {
	// Check command-line arguments
	if len(os.Args) < 2 {
		// Default behavior: sign a transaction with MPC wallet
		signature, err := solSign.Sign("")
		if err != nil {
			log.Fatalf("SignSol failed: %v", err)
		}
		fmt.Printf("Transaction signed with signature: %s\n", signature)
		return
	}

	command := os.Args[1]

	switch command {
	case "cosigner":
		// Generate a Solana cosigner keypair
		err := solSign.MakeSolanaCosigner()
		if err != nil {
			log.Fatalf("MakeSolanaCosigner failed: %v", err)
		}

	case "cosign":
		// Check if an address was provided
		if len(os.Args) < 3 {
			fmt.Println("Error: cosign command requires an address")
			printUsage()
			os.Exit(1)
		}

		cosignerAddress := os.Args[2]
		err := solSign.CoSign(cosignerAddress)
		if err != nil {
			log.Fatalf("CoSign failed: %v", err)
		}

	case "message":
		// Sign a message with MPC wallet
		err := solSign.SignMessage()
		if err != nil {
			log.Fatalf("SignSolMessage failed: %v", err)
		}

	default:
		// Treat as fee payer address for backward compatibility
		feePayerAddress := command
		signature, err := solSign.Sign(feePayerAddress)
		if err != nil {
			log.Fatalf("SignSol failed: %v", err)
		}
		fmt.Printf("Transaction signed with signature: %s\n", signature)
	}
}
