package ethSignTypedData

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"portal-hq/Enclave-Signer-API-Examples/config"
	"portal-hq/Enclave-Signer-API-Examples/pkg"
)

type SignTypedDataRequest struct {
	Share   string `json:"share"`
	Method  string `json:"method"`
	Params  string `json:"params"`
	RpcUrl  string `json:"rpcUrl"`
	ChainId string `json:"chainId"`
}

type SignTypedDataResponse struct {
	Data string `json:"data"`
}

func SignTypedData() error {
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

	// The typed data payload to sign
	// First element is the address, second element is the typed data JSON string
	typedDataJSON := `{
		"types": {
			"EIP712Domain": [
				{"name": "name", "type": "string"},
				{"name": "version", "type": "string"},
				{"name": "chainId", "type": "uint256"},
				{"name": "verifyingContract", "type": "address"}
			],
			"Person": [
				{"name": "name", "type": "string"},
				{"name": "wallet", "type": "address"}
			],
			"Mail": [
				{"name": "from", "type": "Person"},
				{"name": "to", "type": "Person"},
				{"name": "contents", "type": "string"}
			]
		},
		"primaryType": "Mail",
		"domain": {
			"name": "Ether Mail",
			"version": "1",
			"chainId": 1,
			"verifyingContract": "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC"
		},
		"message": {
			"from": {
				"name": "Cow",
				"wallet": "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826"
			},
			"to": {
				"name": "Bob",
				"wallet": "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"
			},
			"contents": "Hello, Bob!"
		}
	}`

	typedDataPayload := []interface{}{
		"0xaeabe5b13828f691fdb56007502ef9035c95e8b2",
		typedDataJSON,
	}

	paramsJson, err := json.Marshal(typedDataPayload)
	if err != nil {
		return fmt.Errorf("failed to marshal typed data params: %v", err)
	}

	signReq := SignTypedDataRequest{
		Share:   shares["SECP256K1"].(map[string]interface{})["share"].(string),
		Method:  "eth_signTypedData_v4",
		Params:  string(paramsJson),
		RpcUrl:  config.GetEthSepoliaRpcURL(),
		ChainId: "eip155:1", // Using mainnet chain ID as per the typed data
	}
	signReqBody, err := json.Marshal(signReq)
	if err != nil {
		return fmt.Errorf("failed to marshal sign typed data request: %v", err)
	}

	portalMPCClientURL := config.GetPortalMPCClientURL()
	signResponse, err := pkg.PostRequest(portalMPCClientURL+"/v1/sign", clientApiKey, signReqBody)
	if err != nil {
		return fmt.Errorf("failed to sign typed data: %v", err)
	}

	var signData SignTypedDataResponse
	if err := json.Unmarshal(signResponse, &signData); err != nil {
		return fmt.Errorf("failed to unmarshal sign typed data response: %v", err)
	}

	fmt.Printf("Successfully signed typed data with signature %s!\n", signData.Data)

	return nil
}
