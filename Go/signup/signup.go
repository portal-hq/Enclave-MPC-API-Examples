package signup

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"portal-hq/Enclave-Signer-API-Examples/config"
	"time"

	"github.com/google/uuid"
)

type SignupRequest struct {
	Username            string `json:"username"`
	IsAccountAbstracted bool   `json:"isAccountAbstracted"`
}

type SignupResponse struct {
	ClientApiKey string `json:"clientApiKey"`
}

func Signup() error {
	now := time.Now().Format(time.RFC3339)
	myUUID := uuid.New().String()
	username := "go-example-" + now + myUUID

	requestBody, err := json.Marshal(SignupRequest{
		Username:            username,
		IsAccountAbstracted: false,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal request body: %v", err)
	}

	req, err := http.NewRequest("POST", config.PORTAL_EX+"/mobile/signup", bytes.NewBuffer(requestBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to perform request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := ioutil.ReadAll(resp.Body)
		return fmt.Errorf("failed to sign up: %s", body)
	}

	var signupResponse SignupResponse
	err = json.NewDecoder(resp.Body).Decode(&signupResponse)
	if err != nil {
		return fmt.Errorf("failed to decode response body: %v", err)
	}

	fmt.Printf("Successfully signed up user %s!\n", username)

	err = ioutil.WriteFile("clientApiKey.txt", []byte(signupResponse.ClientApiKey), 0644)
	if err != nil {
		return fmt.Errorf("failed to write clientApiKey to file: %v", err)
	}

	return nil
}
