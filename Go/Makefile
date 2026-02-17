.PHONY: all signup generate backup recover signeth signethAssets signethTypedData signsol solcosigner solcosign solmessage

all: main

signup:
	go run cmd/signup/main.go

generate:
	go run cmd/generate/main.go

backup:
	go run cmd/backup/main.go

recover:
	go run cmd/recover/main.go

signeth:
	go run cmd/ethSign/main.go

signethAssets:
	go run cmd/ethSendAssets/main.go

signethTypedData:
	go run cmd/ethSignTypedData/main.go

signsol:
	go run cmd/solSign/main.go $(ADDRESS)

solcosigner:
	go run cmd/solSign/main.go cosigner

solcosign:
	@if [ -z "$(ADDRESS)" ]; then \
		echo "Error: ADDRESS is required. Use 'make solcosign ADDRESS=your_address'"; \
		exit 1; \
	fi
	go run cmd/solSign/main.go cosign $(ADDRESS)

solmessage:
	go run cmd/solSign/main.go message

main:
	go run .
