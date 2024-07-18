package ethSign

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"portal-hq/Enclave-Signer-API-Examples/pkg"
)

const (
	ethPortalMpcClientUrl = "https://mpc-client.portalhq.io:443"
	ethRpcUrl             = "https://sepolia.infura.io/v3/<API_KEY>" // Replace with your ETH RPC URL
)

type TransactionParams struct {
	MaxFeePerGas         string `json:"maxFeePerGas"`
	Nonce                string `json:"nonce"`
	MaxPriorityFeePerGas string `json:"maxPriorityFeePerGas"`
	Value                string `json:"value"`
	From                 string `json:"from"`
	To                   string `json:"to"`
	Data                 string `json:"data"`
	GasLimit             string `json:"gasLimit"`
}

type SignRequest struct {
	Share   string `json:"share"`
	Method  string `json:"method"`
	Params  string `json:"params"`
	RpcUrl  string `json:"rpcUrl"`
	ChainId string `json:"chainId"`
}

type SignResponse struct {
	Data string `json:"data"`
}

func Sign() error {
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

	// Example of an Ethereum eip1559 transaction
	transactionParams := TransactionParams{
		MaxFeePerGas:         "0x2540BE400",
		Nonce:                "0x01",
		MaxPriorityFeePerGas: "0x3B9ACA00",
		Value:                "0x3B9ACA00",
		From:                 "0xabda788be4d93f40f38a8ba47c32a2f2874564be",
		To:                   "0xcae0d97d201ad54275b6e8a6b547c7611ad47963",
		Data:                 "",
		GasLimit:             "0x3B9ACA00",
	}
	paramsJson, err := json.Marshal(transactionParams)
	if err != nil {
		return fmt.Errorf("failed to marshal transaction params: %v", err)
	}

	signReq := SignRequest{
		Share:   shares["SECP256K1"].(map[string]interface{})["share"].(string),
		Method:  "eth_signTransaction",
		Params:  string(paramsJson),
		RpcUrl:  ethRpcUrl,
		ChainId: "eip155:11155111", // Sepolia chain ID
	}
	signReqBody, err := json.Marshal(signReq)
	if err != nil {
		return fmt.Errorf("failed to marshal sign request: %v", err)
	}

	signResponse, err := pkg.PostRequest(ethPortalMpcClientUrl+"/v1/sign", clientApiKey, signReqBody)
	if err != nil {
		return fmt.Errorf("failed to sign transaction: %v", err)
	}

	var signData SignResponse
	if err := json.Unmarshal(signResponse, &signData); err != nil {
		return fmt.Errorf("failed to unmarshal sign response: %v", err)
	}

	fmt.Printf("Successfully Eth signed transaction with signature %s!\n", signData.Data)

	return nil
}
