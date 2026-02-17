package ethSendAssets

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"portal-hq/Enclave-Signer-API-Examples/config"
	"portal-hq/Enclave-Signer-API-Examples/pkg"
)

type SendAssetsRequest struct {
	Share  string `json:"share"`
	Chain  string `json:"chain"`
	To     string `json:"to"`
	Token  string `json:"token"`
	Amount string `json:"amount"`
	RpcUrl string `json:"rpcUrl"`
}

type SendAssetsResponse struct {
	Data string `json:"data"`
}

type ClientMeResponse struct {
	Metadata struct {
		Namespaces struct {
			Eip155 struct {
				Address string `json:"address"`
			} `json:"eip155"`
		} `json:"namespaces"`
	} `json:"metadata"`
}

func SendAssets() error {
	// Load environment variables
	if err := config.LoadEnv(); err != nil {
		return fmt.Errorf("failed to load environment variables: %v", err)
	}

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

	// Get client info to retrieve the Ethereum address
	portalAPIURL := config.GetPortalAPIURL()
	meResponse, err := pkg.GetRequest(portalAPIURL+"/api/v3/clients/me", clientApiKey)
	if err != nil {
		return fmt.Errorf("failed to get client info: %v", err)
	}

	var meData ClientMeResponse
	if err := json.Unmarshal(meResponse, &meData); err != nil {
		return fmt.Errorf("failed to unmarshal client info: %v", err)
	}

	ethAddress := meData.Metadata.Namespaces.Eip155.Address
	fmt.Printf("Eth Address: %s\n", ethAddress)

	// Prepare send assets request
	sendReq := SendAssetsRequest{
		Share:  shares["SECP256K1"].(map[string]interface{})["share"].(string),
		Chain:  "eip155:11155111", // Sepolia testnet
		To:     "0xdFd8302f44727A6348F702fF7B594f127dE3A902",
		Token:  "NATIVE", // Can be NATIVE, USDT, etc.
		Amount: "1",      // Amount in base units
		RpcUrl: config.GetEthSepoliaRpcURL(),
	}

	sendReqBody, err := json.Marshal(sendReq)
	if err != nil {
		return fmt.Errorf("failed to marshal send assets request: %v", err)
	}

	// Send the transaction
	portalMPCClientURL := config.GetPortalMPCClientURL()
	sendResponse, err := pkg.PostRequest(portalMPCClientURL+"/v1/assets/send", clientApiKey, sendReqBody)
	if err != nil {
		return fmt.Errorf("failed to send assets: %v", err)
	}

	var sendData SendAssetsResponse
	if err := json.Unmarshal(sendResponse, &sendData); err != nil {
		return fmt.Errorf("failed to unmarshal send assets response: %v", err)
	}

	fmt.Printf("Successfully sent ETH transaction with signature: %s\n", sendData.Data)

	return nil
}
