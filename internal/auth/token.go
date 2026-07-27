package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
)

const tokenBytes = 32

type TokenManager struct {
	secret []byte
}

func NewTokenManager(secret []byte) (*TokenManager, error) {
	if len(secret) < 32 {
		return nil, fmt.Errorf("session secret must contain at least 32 bytes")
	}
	return &TokenManager{secret: append([]byte(nil), secret...)}, nil
}

func (m *TokenManager) NewSessionToken() (string, []byte, error) {
	return m.newToken("session")
}

func (m *TokenManager) NewCSRFToken() (string, []byte, error) {
	return m.newToken("csrf")
}

func (m *TokenManager) HashSessionToken(token string) []byte {
	return m.hash("session", token)
}

func (m *TokenManager) HashCSRFToken(token string) []byte {
	return m.hash("csrf", token)
}

func (m *TokenManager) Equal(left, right []byte) bool {
	return hmac.Equal(left, right)
}

func (m *TokenManager) newToken(purpose string) (string, []byte, error) {
	raw := make([]byte, tokenBytes)
	if _, err := rand.Read(raw); err != nil {
		return "", nil, fmt.Errorf("generate %s token: %w", purpose, err)
	}
	token := base64.RawURLEncoding.EncodeToString(raw)
	return token, m.hash(purpose, token), nil
}

func (m *TokenManager) hash(purpose, token string) []byte {
	digest := hmac.New(sha256.New, m.secret)
	digest.Write([]byte(purpose))
	digest.Write([]byte{0})
	digest.Write([]byte(token))
	return digest.Sum(nil)
}
