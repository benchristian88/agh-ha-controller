package auth

import (
	"bytes"
	"testing"
)

func TestTokenManagerUsesPurposeSeparatedHashes(t *testing.T) {
	t.Parallel()
	manager, err := NewTokenManager(bytes.Repeat([]byte{1}, 32))
	if err != nil {
		t.Fatalf("NewTokenManager() error = %v", err)
	}
	token, hash, err := manager.NewSessionToken()
	if err != nil {
		t.Fatalf("NewSessionToken() error = %v", err)
	}
	if !manager.Equal(hash, manager.HashSessionToken(token)) {
		t.Fatal("session token hash did not verify")
	}
	if manager.Equal(hash, manager.HashCSRFToken(token)) {
		t.Fatal("session token hash matched the CSRF purpose")
	}
}
