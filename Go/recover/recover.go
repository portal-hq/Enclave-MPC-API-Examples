package recover

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"portal-hq/Enclave-Signer-API-Examples/generate"
	"portal-hq/Enclave-Signer-API-Examples/pkg"
)

const (
	recoverPortalApiUrl       = "https://api.portalhq.io"
	recoverPortalMpcClientUrl = "https://mpc-client.portalhq.io:443"
)

type RecoverResponse struct {
	SECP256K1 generate.Share `json:"SECP256K1"`
	ED25519   generate.Share `json:"ED25519"`
}

type RecoverRequest struct {
	BackupResponse string `json:"backupResponse"`
}

type RecoverPatchRequest struct {
	Status              string   `json:"status"`
	SigningSharePairIds []string `json:"signingSharePairIds"`
}

func Recover() error {
	// Read clientApiKey from file
	clientApiKey, err := ioutil.ReadFile("clientApiKey.txt")
	if err != nil {
		return fmt.Errorf("no clientApiKey found, make sure to run the signup script first: %v", err)
	}

	// Read shares from file
	sharesData, err := ioutil.ReadFile("backupShares.txt")
	if err != nil {
		return fmt.Errorf("no shares found, make sure to run the generate script first: %v", err)
	}

	var shares map[string]interface{}
	if err := json.Unmarshal(sharesData, &shares); err != nil {
		return fmt.Errorf("failed to unmarshal shares: %v", err)
	}

	// Recover MPC shares
	recoverReq := RecoverRequest{
		BackupResponse: string(sharesData),
	}
	recoverReqBody, err := json.Marshal(recoverReq)
	if err != nil {
		return fmt.Errorf("failed to marshal recover request: %v", err)
	}

	recoverResponse, err := pkg.PostRequest(recoverPortalMpcClientUrl+"/v1/recover", clientApiKey, recoverReqBody)
	if err != nil {
		return fmt.Errorf("failed to recover MPC shares: %v", err)
	}

	var recoverData RecoverResponse
	if err := json.Unmarshal(recoverResponse, &recoverData); err != nil {
		return fmt.Errorf("failed to unmarshal recover response: %v", err)
	}

	fmt.Printf("Successfully recovered signing shares with ID: %s and %s\n", recoverData.SECP256K1.ID, recoverData.ED25519.ID)

	// Update MPC shares status
	patchReq := RecoverPatchRequest{
		Status:              "STORED_CLIENT",
		SigningSharePairIds: []string{recoverData.SECP256K1.ID, recoverData.ED25519.ID},
	}
	patchReqBody, err := json.Marshal(patchReq)
	if err != nil {
		return fmt.Errorf("failed to marshal patch request: %v", err)
	}

	if _, err := pkg.SendPatchRequest(recoverPortalApiUrl+"/api/v3/clients/me/signing-share-pairs", clientApiKey, patchReqBody); err != nil {
		return fmt.Errorf("failed to update MPC shares status: %v", err)
	}

	fmt.Println("Successfully updated MPC shares status!")

	return nil
}
