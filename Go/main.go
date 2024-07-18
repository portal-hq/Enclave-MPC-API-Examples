package main

import (
	"log"

	"portal-hq/Enclave-Signer-API-Examples/backup"
	"portal-hq/Enclave-Signer-API-Examples/ethSign"
	"portal-hq/Enclave-Signer-API-Examples/generate"
	"portal-hq/Enclave-Signer-API-Examples/recover"
	"portal-hq/Enclave-Signer-API-Examples/signup"
)

func main() {
	err := signup.Signup()
	if err != nil {
		log.Fatalf("Signup failed: %v", err)
	}

	err = generate.Generate()
	if err != nil {
		log.Fatalf("Generate failed: %v", err)
	}

	err = backup.Backup()
	if err != nil {
		log.Fatalf("Backup failed: %v", err)
	}

	err = recover.Recover()
	if err != nil {
		log.Fatalf("Recover failed: %v", err)
	}

	err = ethSign.Sign()
	if err != nil {
		log.Fatalf("SignEth failed: %v", err)
	}
}
