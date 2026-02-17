package solSign

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"portal-hq/Enclave-Signer-API-Examples/config"

	"github.com/mr-tron/base58"

	"github.com/blocto/solana-go-sdk/client"
	"github.com/blocto/solana-go-sdk/common"
	"github.com/blocto/solana-go-sdk/program/system"
	"github.com/blocto/solana-go-sdk/types"
)

// Constants for Solana
const (
	solRpcUrl       = "https://api.devnet.solana.com"
	cosignerKeyFile = "cosigner_key.txt"
)

// SignRequest represents the request to sign a Solana transaction or message
type SignRequest struct {
	Share   string `json:"share"`
	Method  string `json:"method"`
	Params  string `json:"params"`
	RpcUrl  string `json:"rpcUrl"`
	ChainId string `json:"chainId"`
}

// SignResponse represents the response from the signing request
type SignResponse struct {
	Data string `json:"data"`
}

// CosignerKeyPair represents a Solana keypair for cosigning
type CosignerKeyPair struct {
	PrivateKey []byte `json:"privateKey"`
	PublicKey  string `json:"publicKey"`
}

// ClientInfoResponse represents the response from the client info request
type ClientInfoResponse struct {
	Metadata struct {
		Namespaces struct {
			Solana struct {
				Address string `json:"address"`
			} `json:"solana"`
		} `json:"namespaces"`
	} `json:"metadata"`
}

// PostRequest sends a POST request to the specified URL with the given body and authorization
func PostRequest(url string, clientApiKey []byte, body []byte) ([]byte, error) {
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", clientApiKey))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to perform request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := ioutil.ReadAll(resp.Body)
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, body)
	}

	responseBody, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %v", err)
	}

	return responseBody, nil
}

// GetRequest sends a GET request to the specified URL with the given authorization
func GetRequest(url string, clientApiKey []byte) ([]byte, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", clientApiKey))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to perform request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := ioutil.ReadAll(resp.Body)
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, body)
	}

	responseBody, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %v", err)
	}

	return responseBody, nil
}

// MakeSolanaCosigner generates a Solana cosigner keypair, saves the private key to a file,
// and prints the public key to get funded
func MakeSolanaCosigner() error {
	// Generate a new keypair
	account := types.NewAccount()
	publicKey := account.PublicKey.ToBase58()
	privateKey := account.PrivateKey

	// Create a keypair structure
	keyPair := CosignerKeyPair{
		PrivateKey: privateKey,
		PublicKey:  publicKey,
	}

	// Marshal the keypair to JSON
	keyPairJSON, err := json.Marshal(keyPair)
	if err != nil {
		return fmt.Errorf("failed to marshal keypair: %v", err)
	}

	// Save the private key to a file
	if err := ioutil.WriteFile(cosignerKeyFile, keyPairJSON, 0600); err != nil {
		return fmt.Errorf("failed to write cosigner key to file: %v", err)
	}

	fmt.Printf("Solana cosigner created successfully!\n")
	fmt.Printf("Public Key: %s\n", publicKey)
	fmt.Printf("Private key saved to %s\n", cosignerKeyFile)
	fmt.Printf("Please fund this address to use it as a cosigner.\n")

	return nil
}

// CoSign reads the cosigner private key from file and signs a transaction as a cosigner
func CoSign(cosignerAddress string) error {
	// Check if cosigner address is provided
	if cosignerAddress == "" {
		return fmt.Errorf("cosigner address is required")
	}

	// Read the cosigner key from file
	keyPairData, err := ioutil.ReadFile(cosignerKeyFile)
	if err != nil {
		return fmt.Errorf("failed to read cosigner key file: %v", err)
	}

	var keyPair CosignerKeyPair
	if err := json.Unmarshal(keyPairData, &keyPair); err != nil {
		return fmt.Errorf("failed to unmarshal cosigner key: %v", err)
	}

	// Verify the provided address matches the cosigner public key
	if keyPair.PublicKey != cosignerAddress {
		return fmt.Errorf("provided cosigner address does not match the key in file")
	}

	// Sign the transaction with the MPC wallet first
	fmt.Printf("Signing transaction with MPC wallet...\n")
	signature, err := Sign(cosignerAddress)
	if err != nil {
		return fmt.Errorf("failed to sign with MPC wallet: %v", err)
	}

	fmt.Printf("Transaction signed with MPC wallet, signature: %s\n", signature)
	fmt.Printf("Transaction is now ready to be cosigned by: %s\n", cosignerAddress)

	// Create a Solana account from the private key
	cosignerAccount, err := types.AccountFromBytes(keyPair.PrivateKey)
	if err != nil {
		return fmt.Errorf("failed to create account from private key: %v", err)
	}
	fmt.Printf("Created cosigner account from private key\n")

	// Decode the signature variable from base58 to bytes
	signedTransactionBytes, err := base58.Decode(signature)
	if err != nil {
		return fmt.Errorf("failed to decode signature: %v", err)
	}

	// Deserialize into a Transaction struct
	partialySignedTransaction, err := types.TransactionDeserialize(signedTransactionBytes)
	if err != nil {
		return fmt.Errorf("deserialize tx: %w", err)
	}

	msgBytes, err := partialySignedTransaction.Message.Serialize()
	if err != nil {
		return fmt.Errorf("failed to serialize message: %v", err)
	}
	sig := cosignerAccount.Sign(msgBytes)

	if err := partialySignedTransaction.AddSignature(sig); err != nil {
		return fmt.Errorf("add fee-payer signature: %w", err)
	}

	// 6) Re-serialize and re-base64-encode
	signedRaw, err := partialySignedTransaction.Serialize()
	if err != nil {
		return fmt.Errorf("serialize signed tx: %w", err)
	}

	fmt.Println("Cosigned transaction in base64:", base64.StdEncoding.EncodeToString(signedRaw))

	c := client.NewClient(solRpcUrl) // :contentReference[oaicite:0]{index=0}
	ctx := context.Background()
	submittedSig, err := c.SendTransaction(ctx, partialySignedTransaction)
	if err != nil {
		return fmt.Errorf("failed to send transaction: %v", err)
	}

	fmt.Println("Transaction submitted. Signature:", submittedSig)

	return nil
}

// Sign signs a Solana transaction
// If feePayerAddress is provided, it will be used as the fee payer for the transaction
// Returns the transaction signature if successful
func Sign(feePayerAddress string) (string, error) {
	// Load environment variables
	if err := config.LoadEnv(); err != nil {
		return "", fmt.Errorf("failed to load environment variables: %v", err)
	}

	// Read clientApiKey from file
	clientApiKey, err := ioutil.ReadFile("clientApiKey.txt")
	if err != nil {
		return "", fmt.Errorf("no clientApiKey found, make sure to run the signup script first: %v", err)
	}

	// Read shares from file
	sharesData, err := ioutil.ReadFile("shares.txt")
	if err != nil {
		return "", fmt.Errorf("no shares found, make sure to run the generate script first: %v", err)
	}

	var shares map[string]interface{}
	if err := json.Unmarshal(sharesData, &shares); err != nil {
		return "", fmt.Errorf("failed to unmarshal shares: %v", err)
	}

	// Get client info to retrieve Solana address
	clientInfoResponse, err := GetRequest(fmt.Sprintf("%s/api/v3/clients/me", config.GetPortalAPIURL()), clientApiKey)
	if err != nil {
		return "", fmt.Errorf("failed to get client info: %v", err)
	}

	var clientInfo ClientInfoResponse
	if err := json.Unmarshal(clientInfoResponse, &clientInfo); err != nil {
		return "", fmt.Errorf("failed to unmarshal client info: %v", err)
	}

	solanaAddress := clientInfo.Metadata.Namespaces.Solana.Address
	fmt.Printf("Solana address: %s\n", solanaAddress)

	// -- Start of transaction creation --
	c := client.NewClient(solRpcUrl)
	ctx := context.Background()

	// 1. Get a recent blockhash
	resp, err := c.GetLatestBlockhash(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get latest blockhash: %v", err)
	}

	// 2. Build transfer instruction (0.00001 SOL → lamports)
	from := common.PublicKeyFromString(solanaAddress)
	lamportsPerSol := 1000000000 // 1 SOL = 1,000,000,000 lamports
	to := common.PublicKeyFromString("GPsPXxoQA51aTJJkNHtFDFYui5hN5UxcFPnheJEHa5Du")

	transferIx := system.Transfer(system.TransferParam{
		From:   from,
		To:     to,
		Amount: uint64(0.00001 * float64(lamportsPerSol)),
	})

	// 3. Compose Message
	feePayer := from
	if feePayerAddress != "" {
		feePayer = common.PublicKeyFromString(feePayerAddress)
	}
	msg := types.NewMessage(types.NewMessageParam{
		FeePayer:        feePayer,
		RecentBlockhash: resp.Blockhash,
		Instructions:    []types.Instruction{transferIx},
	})

	// 4. Build unsigned transaction
	tx, err := types.NewTransaction(types.NewTransactionParam{
		Message: msg,
		Signers: nil,
	})
	if err != nil {
		return "", fmt.Errorf("failed to create new transaction: %v", err)
	}

	// 5. Serialize & Base64
	raw, err := tx.Serialize()
	if err != nil {
		return "", fmt.Errorf("failed to serialize transaction: %v", err)
	}
	fmt.Println("Base64 tx:", base64.StdEncoding.EncodeToString(raw))
	// -- End of transaction creation --

	// If feePayerAddress is provided, log it
	if feePayerAddress != "" {
		fmt.Printf("Using fee payer address: %s\n", feePayerAddress)
	}

	// Sign the transaction
	signReq := SignRequest{
		Share:   shares["ED25519"].(map[string]interface{})["share"].(string),
		Method:  "sol_signTransaction",
		Params:  base64.StdEncoding.EncodeToString(raw),
		RpcUrl:  solRpcUrl,
		ChainId: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", // Solana devnet chain ID
	}
	signReqBody, err := json.Marshal(signReq)
	if err != nil {
		return "", fmt.Errorf("failed to marshal sign request: %v", err)
	}

	signResponse, err := PostRequest(fmt.Sprintf("%s/v1/sign", config.GetPortalMPCClientURL()), clientApiKey, signReqBody)
	if err != nil {
		return "", fmt.Errorf("failed to sign transaction: %v", err)
	}

	var signData SignResponse
	if err := json.Unmarshal(signResponse, &signData); err != nil {
		return "", fmt.Errorf("failed to unmarshal sign response: %v", err)
	}

	fmt.Printf("Successfully signed Solana transaction with signature %s!\n", signData.Data)

	return signData.Data, nil
}

// SignMessage signs a Solana message
func SignMessage() error {
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

	// Get client info to retrieve Solana address
	clientInfoResponse, err := GetRequest(fmt.Sprintf("%s/api/v3/clients/me", config.GetPortalAPIURL()), clientApiKey)
	if err != nil {
		return fmt.Errorf("failed to get client info: %v", err)
	}

	var clientInfo ClientInfoResponse
	if err := json.Unmarshal(clientInfoResponse, &clientInfo); err != nil {
		return fmt.Errorf("failed to unmarshal client info: %v", err)
	}

	solanaAddress := clientInfo.Metadata.Namespaces.Solana.Address
	fmt.Printf("Solana address: %s\n", solanaAddress)

	// Example message to sign
	message := "Hello, Solana!"
	messageParams, err := json.Marshal([]string{message})
	if err != nil {
		return fmt.Errorf("failed to marshal message params: %v", err)
	}

	// Sign the message
	signReq := SignRequest{
		Share:   shares["ED25519"].(map[string]interface{})["share"].(string),
		Method:  "sol_signMessage",
		Params:  string(messageParams),
		RpcUrl:  solRpcUrl,
		ChainId: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", // Solana devnet chain ID
	}
	signReqBody, err := json.Marshal(signReq)
	if err != nil {
		return fmt.Errorf("failed to marshal sign request: %v", err)
	}

	signResponse, err := PostRequest(fmt.Sprintf("%s/v1/sign", config.GetPortalMPCClientURL()), clientApiKey, signReqBody)
	if err != nil {
		return fmt.Errorf("failed to sign message: %v", err)
	}

	var signData SignResponse
	if err := json.Unmarshal(signResponse, &signData); err != nil {
		return fmt.Errorf("failed to unmarshal sign response: %v", err)
	}

	fmt.Printf("Successfully signed Solana message with signature %s!\n", signData.Data)

	return nil
}
