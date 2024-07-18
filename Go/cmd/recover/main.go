package main

import (
	"log"
	"portal-hq/Enclave-Signer-API-Examples/recover"
)

func main() {
	// Run backup
	err := recover.Recover()
	if err != nil {
		log.Fatalf("Recover failed: %v", err)
	}
}
