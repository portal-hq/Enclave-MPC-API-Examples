package main

import (
	"log"
	"portal-hq/Enclave-Signer-API-Examples/generate"
)

func main() {
	// Run backup
	err := generate.Generate()
	if err != nil {
		log.Fatalf("Generate failed: %v", err)
	}
}
