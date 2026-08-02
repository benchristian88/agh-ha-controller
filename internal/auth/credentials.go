package auth

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

const (
	CredentialAlgorithm  = "AES-256-GCM"
	CredentialKeyVersion = 1
)

type CredentialCipher struct {
	aead cipher.AEAD
}

func NewCredentialCipher(key []byte) (*CredentialCipher, error) {
	if len(key) != 32 {
		return nil, fmt.Errorf("credential encryption key must be exactly 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("create credential cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create credential envelope: %w", err)
	}
	return &CredentialCipher{aead: aead}, nil
}

func (c *CredentialCipher) Encrypt(nodeID string, credentials domain.NodeCredentials) (domain.EncryptedCredentials, error) {
	payload, err := json.Marshal(credentials)
	if err != nil {
		return domain.EncryptedCredentials{}, fmt.Errorf("encode node credentials: %w", err)
	}
	nonce := make([]byte, c.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return domain.EncryptedCredentials{}, fmt.Errorf("create credential nonce: %w", err)
	}
	ciphertext := c.aead.Seal(nil, nonce, payload, []byte(nodeID))
	return domain.EncryptedCredentials{
		Ciphertext: ciphertext,
		Nonce:      nonce,
		KeyVersion: CredentialKeyVersion,
		Algorithm:  CredentialAlgorithm,
	}, nil
}

func (c *CredentialCipher) Decrypt(nodeID string, envelope domain.EncryptedCredentials) (domain.NodeCredentials, error) {
	if envelope.Algorithm != CredentialAlgorithm || envelope.KeyVersion != CredentialKeyVersion {
		return domain.NodeCredentials{}, fmt.Errorf("unsupported credential envelope")
	}
	payload, err := c.aead.Open(nil, envelope.Nonce, envelope.Ciphertext, []byte(nodeID))
	if err != nil {
		return domain.NodeCredentials{}, fmt.Errorf("decrypt node credentials: %w", err)
	}
	var credentials domain.NodeCredentials
	if err := json.Unmarshal(payload, &credentials); err != nil {
		return domain.NodeCredentials{}, fmt.Errorf("decode node credentials: %w", err)
	}
	return credentials, nil
}

func (c *CredentialCipher) EncryptPayload(scope string, payload []byte) (domain.EncryptedPayload, error) {
	nonce := make([]byte, c.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return domain.EncryptedPayload{}, fmt.Errorf("create operational payload nonce: %w", err)
	}
	return domain.EncryptedPayload{
		Ciphertext: c.aead.Seal(nil, nonce, payload, []byte(scope)),
		Nonce:      nonce, KeyVersion: CredentialKeyVersion, Algorithm: CredentialAlgorithm,
	}, nil
}

func (c *CredentialCipher) DecryptPayload(scope string, envelope domain.EncryptedPayload) ([]byte, error) {
	if envelope.Algorithm != CredentialAlgorithm || envelope.KeyVersion != CredentialKeyVersion {
		return nil, fmt.Errorf("unsupported operational payload envelope")
	}
	payload, err := c.aead.Open(nil, envelope.Nonce, envelope.Ciphertext, []byte(scope))
	if err != nil {
		return nil, fmt.Errorf("decrypt operational payload: %w", err)
	}
	return payload, nil
}
