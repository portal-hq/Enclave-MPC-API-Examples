package main

import (
	"log"
	"portal-hq/Enclave-Signer-API-Examples/signup"
)

func main() {
	// Run backup
	err := signup.Signup()
	if err != nil {
		log.Fatalf("Signup failed: %v", err)
	}
}
