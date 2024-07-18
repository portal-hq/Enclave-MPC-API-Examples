package main

import (
	"log"
	"portal-hq/Enclave-Signer-API-Examples/backup"
)

func main() {
	// Run backup
	err := backup.Backup()
	if err != nil {
		log.Fatalf("Backup failed: %v", err)
	}
}
