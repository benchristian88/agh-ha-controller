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

func TestCredentialCipherEncryptsOperationalPayloadWithResourceBinding(t *testing.T) {
	cipher, err := NewCredentialCipher([]byte("01234567890123456789012345678901"))
	if err != nil {
		t.Fatal(err)
	}
	payload := []byte(`{"upstreamDns":["https://user:secret@dns.example/dns-query"]}`)
	envelope, err := cipher.EncryptPayload("operation-a", payload)
	if err != nil {
		t.Fatal(err)
	}
	if string(envelope.Ciphertext) == string(payload) {
		t.Fatal("operational payload was stored as plaintext")
	}
	decoded, err := cipher.DecryptPayload("operation-a", envelope)
	if err != nil || string(decoded) != string(payload) {
		t.Fatalf("decoded=%q err=%v", decoded, err)
	}
	if _, err := cipher.DecryptPayload("operation-b", envelope); err == nil {
		t.Fatal("operational payload decrypted under another resource scope")
	}
}
