package backup

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"portal-hq/Enclave-Signer-API-Examples/config"
	"portal-hq/Enclave-Signer-API-Examples/generate"
	"portal-hq/Enclave-Signer-API-Examples/pkg"
)

type BackupResponse struct {
	SECP256K1 generate.Share `json:"SECP256K1"`
	ED25519   generate.Share `json:"ED25519"`
}

type BackupRequest struct {
	GenerateResponse string `json:"generateResponse"`
}

type BackupPatchRequest struct {
	Status             string   `json:"status"`
	BackupSharePairIds []string `json:"backupSharePairIds"`
}

func Backup() error {
	// Read clientApiKey from file
	clientApiKey, err := ioutil.ReadFile("clientApiKey.txt")
	if err != nil {
		return fmt.Errorf("no clientApiKey found, make sure to run the signup script first: %v", err)
	}

	// Read shares from file
	sharesData, err := ioutil.ReadFile("shares.txt")
	if err != nil {
		return fmt.Errorf("no shares found, make sure to run the generate script first: %v", err)
	}

	var shares map[string]interface{}
	if err := json.Unmarshal(sharesData, &shares); err != nil {
		return fmt.Errorf("failed to unmarshal shares: %v", err)
	}

	// Backup MPC shares
	backupReq := BackupRequest{
		GenerateResponse: string(sharesData),
	}
	backupReqBody, err := json.Marshal(backupReq)
	if err != nil {
		return fmt.Errorf("failed to marshal backup request: %v", err)
	}

	backupResponse, err := pkg.PostRequest(config.PORTAL_MPC_CLIENT_URL+"/v1/backup", clientApiKey, backupReqBody)
	if err != nil {
		return fmt.Errorf("failed to backup MPC shares: %v", err)
	}

	var backupData BackupResponse
	if err := json.Unmarshal(backupResponse, &backupData); err != nil {
		return fmt.Errorf("failed to unmarshal backup response: %v", err)
	}

	fmt.Printf("Successfully backed up MPC shares %s and %s!\n", backupData.SECP256K1.ID, backupData.ED25519.ID)

	// Update MPC shares status
	patchReq := BackupPatchRequest{
		Status:             "STORED_CLIENT_BACKUP_SHARE",
		BackupSharePairIds: []string{backupData.SECP256K1.ID, backupData.ED25519.ID},
	}
	patchReqBody, err := json.Marshal(patchReq)
	if err != nil {
		return fmt.Errorf("failed to marshal patch request: %v", err)
	}

	if _, err := pkg.SendPatchRequest(config.PORTAL_API_URL+"/api/v3/clients/me/backup-share-pairs", clientApiKey, patchReqBody); err != nil {
		return fmt.Errorf("failed to update MPC shares status: %v", err)
	}

	// Write backup shares to file
	if err := ioutil.WriteFile("backupShares.txt", backupResponse, 0644); err != nil {
		return fmt.Errorf("failed to write backup shares to file: %v", err)
	}

	fmt.Println("Successfully updated MPC shares status!")

	return nil
}

// func postRequest(url string, apiKey []byte, body []byte) ([]byte, error) {
// 	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to create request: %v", err)
// 	}
// 	req.Header.Set("Content-Type", "application/json")
// 	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))

// 	client := &http.Client{}
// 	resp, err := client.Do(req)
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to perform request: %v", err)
// 	}
// 	defer resp.Body.Close()

// 	if resp.StatusCode != http.StatusOK {
// 		body, _ := ioutil.ReadAll(resp.Body)
// 		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, body)
// 	}

// 	return ioutil.ReadAll(resp.Body)
// }

// func sendPatchRequest(url string, apiKey []byte, body []byte) ([]byte, error) {
// 	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(body))
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to create request: %v", err)
// 	}
// 	req.Header.Set("Content-Type", "application/json")
// 	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))

// 	client := &http.Client{}
// 	resp, err := client.Do(req)
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to perform request: %v", err)
// 	}
// 	defer resp.Body.Close()

// 	if resp.StatusCode != http.StatusNoContent {
// 		body, _ := ioutil.ReadAll(resp.Body)
// 		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, body)
// 	}

// 	return ioutil.ReadAll(resp.Body)
// }
