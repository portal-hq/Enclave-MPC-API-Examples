package generate

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"portal-hq/Enclave-Signer-API-Examples/config"
	"portal-hq/Enclave-Signer-API-Examples/pkg"
)

type GenerateResponse struct {
	SECP256K1 Share `json:"SECP256K1"`
	ED25519   Share `json:"ED25519"`
}

type Share struct {
	ID    string `json:"id"`
	Share string `json:"share"`
}

type PatchRequest struct {
	Status              string   `json:"status"`
	SigningSharePairIds []string `json:"signingSharePairIds"`
}

type MeResponse struct {
	Metadata Metadata `json:"metadata"`
}

type Metadata struct {
	Namespaces Namespaces `json:"namespaces"`
}

type Namespaces struct {
	Solana Namespace `json:"solana"`
	Eip155 Namespace `json:"eip155"`
}

type Namespace struct {
	Address string `json:"address"`
}

func Generate() error {
	// Read clientApiKey from file
	clientApiKey, err := ioutil.ReadFile("clientApiKey.txt")
	if err != nil {
		return fmt.Errorf("no clientApiKey found, make sure to run the signup script first: %v", err)
	}

	// Generate MPC shares
	generateResponse, err := pkg.PostRequest(config.PORTAL_MPC_CLIENT_URL+"/v1/generate", clientApiKey, []byte("{}")) // Pass in empty body
	if err != nil {
		return fmt.Errorf("failed to generate MPC shares: %v", err)
	}

	var generateData GenerateResponse
	if err := json.Unmarshal(generateResponse, &generateData); err != nil {
		return fmt.Errorf("failed to unmarshal generate response: %v", err)
	}

	fmt.Printf("Successfully generated MPC shares %s and %s!\n", generateData.SECP256K1.ID, generateData.ED25519.ID)

	// Update MPC shares status
	patchReq := PatchRequest{
		Status:              "STORED_CLIENT",
		SigningSharePairIds: []string{generateData.SECP256K1.ID, generateData.ED25519.ID},
	}
	patchRequestBody, err := json.Marshal(patchReq)
	if err != nil {
		return fmt.Errorf("failed to marshal patch request: %v", err)
	}

	if _, err := pkg.SendPatchRequest(config.PORTAL_API_URL+"/api/v3/clients/me/signing-share-pairs", clientApiKey, patchRequestBody); err != nil {
		return fmt.Errorf("failed to update MPC shares status: %v", err)
	}

	// Write shares to file
	if err := ioutil.WriteFile("shares.txt", generateResponse, 0644); err != nil {
		return fmt.Errorf("failed to write shares to file: %v", err)
	}

	// Get wallet addresses
	meResponse, err := pkg.GetRequest(config.PORTAL_API_URL+"/api/v3/clients/me", clientApiKey)
	if err != nil {
		return fmt.Errorf("failed to get client info: %v", err)
	}

	var meData MeResponse
	if err := json.Unmarshal(meResponse, &meData); err != nil {
		return fmt.Errorf("failed to unmarshal me response: %v", err)
	}

	solanaAddress := meData.Metadata.Namespaces.Solana.Address
	eip155Address := meData.Metadata.Namespaces.Eip155.Address

	fmt.Printf("Successfully generated wallets with Solana address %s and Eth address %s!\n", solanaAddress, eip155Address)

	return nil
}
