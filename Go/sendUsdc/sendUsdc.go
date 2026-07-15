package sendUsdc

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"portal-hq/Enclave-Signer-API-Examples/config"
	"portal-hq/Enclave-Signer-API-Examples/pkg"
)

const (
	// usdcChain is the chain to send USDC on. It accepts a CAIP-2 chain ID
	// (e.g. eip155:11155111 for Ethereum Sepolia) or a friendly name like
	// "sepolia" or "base".
	usdcChain = "eip155:11155111"

	// usdcToken is the token to send. "USDC" is a shorthand the enclave resolves
	// to the correct ERC-20 contract for the selected chain. You can also pass a
	// raw ERC-20 contract address directly if the shorthand isn't supported on
	// your chain.
	usdcToken = "USDC"

	// usdcRpcUrl is the RPC node the transaction is broadcast through.
	usdcRpcUrl = "https://sepolia.infura.io/v3/<API_KEY>" // Replace with your ETH RPC URL

	// usdcToAddress is the recipient. usdcAmount is in human units, so "1" sends
	// 1 USDC (the enclave handles the token's decimals for you).
	usdcToAddress = "0xcae0d97d201ad54275b6e8a6b547c7611ad47963"
	usdcAmount    = "1"
)

type SendAssetsRequest struct {
	Share      string `json:"share"`
	Chain      string `json:"chain"`
	To         string `json:"to"`
	Token      string `json:"token"`
	Amount     string `json:"amount"`
	RpcUrl     string `json:"rpcUrl"`
	SponsorGas bool   `json:"sponsorGas"`
}

type MeResponse struct {
	Metadata struct {
		Namespaces struct {
			Eip155 struct {
				Address string `json:"address"`
			} `json:"eip155"`
		} `json:"namespaces"`
	} `json:"metadata"`
}

// Send transfers USDC from the client's wallet using Portal's enclave
// `assets/send` endpoint. The endpoint builds, signs, and broadcasts the ERC-20
// transfer for you, so you never have to hand-build the transaction.
//
// The sponsorGas flag selects between the two supported flows:
//
//   - AA flow (sponsorGas: true): requires an Account Abstraction client,
//     created at signup with isAccountAbstracted: true. Portal sponsors the gas,
//     so the wallet does NOT need to hold any native token. Omitting sponsorGas
//     produces the same behavior for AA clients.
//
//   - Non-AA flow (sponsorGas: false): a standard EOA wallet pays its own gas
//     and MUST hold the chain's native token (e.g. Sepolia ETH) to cover the
//     transfer. Without it, the request fails with an insufficient-balance error
//     even when the wallet holds plenty of USDC.
func Send(sponsorGas bool) error {
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

	// Look up the wallet's EVM address so we can log who is sending.
	meResponse, err := pkg.GetRequest(config.PORTAL_API_URL+"/api/v3/clients/me", clientApiKey)
	if err != nil {
		return fmt.Errorf("failed to get client info: %v", err)
	}
	var meData MeResponse
	if err := json.Unmarshal(meResponse, &meData); err != nil {
		return fmt.Errorf("failed to unmarshal me response: %v", err)
	}
	fmt.Printf("Sending %s %s from %s (sponsorGas=%t)\n", usdcAmount, usdcToken, meData.Metadata.Namespaces.Eip155.Address, sponsorGas)

	// Send the USDC. The enclave builds the ERC-20 transfer, signs it with the
	// MPC share, and broadcasts it through the provided RPC URL.
	sendReq := SendAssetsRequest{
		Share:  shares["SECP256K1"].(map[string]interface{})["share"].(string),
		Chain:  usdcChain,
		To:     usdcToAddress,
		Token:  usdcToken,
		Amount: usdcAmount,
		RpcUrl: usdcRpcUrl,
		// sponsorGas only affects Account Abstraction clients. It is ignored for
		// standard clients (which always pay their own gas).
		SponsorGas: sponsorGas,
	}
	sendReqBody, err := json.Marshal(sendReq)
	if err != nil {
		return fmt.Errorf("failed to marshal send request: %v", err)
	}

	sendResponse, err := pkg.PostRequest(config.PORTAL_MPC_CLIENT_URL+"/v1/assets/send", clientApiKey, sendReqBody)
	if err != nil {
		return fmt.Errorf("failed to send USDC: %v", err)
	}

	fmt.Printf("Successfully sent USDC: %s\n", sendResponse)

	return nil
}
