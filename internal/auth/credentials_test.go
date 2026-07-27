package auth

import (
	"bytes"
	"testing"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

func TestCredentialCipherRoundTripAndNodeBinding(t *testing.T) {
	t.Parallel()
	cipher, err := NewCredentialCipher(bytes.Repeat([]byte{7}, 32))
	if err != nil {
		t.Fatalf("NewCredentialCipher() error = %v", err)
	}
	credentials := domain.NodeCredentials{Username: "admin", Password: "not-in-logs"}
	envelope, err := cipher.Encrypt("node-a", credentials)
	if err != nil {
		t.Fatalf("Encrypt() error = %v", err)
	}
	if bytes.Contains(envelope.Ciphertext, []byte(credentials.Password)) {
		t.Fatal("encrypted envelope contains plaintext password")
	}
	decrypted, err := cipher.Decrypt("node-a", envelope)
	if err != nil {
		t.Fatalf("Decrypt() error = %v", err)
	}
	if decrypted != credentials {
		t.Fatalf("Decrypt() = %#v, want %#v", decrypted, credentials)
	}
	if _, err := cipher.Decrypt("node-b", envelope); err == nil {
		t.Fatal("Decrypt() accepted an envelope bound to another node")
	}
}
