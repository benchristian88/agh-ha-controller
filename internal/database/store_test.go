package database

import (
	"context"
	"strings"
	"testing"
)

func TestOpenDoesNotExposeMalformedDatabaseURL(t *testing.T) {
	const secret = "database-password-must-not-be-logged"
	_, err := Open(context.Background(), "postgres://user:"+secret+"@[invalid")
	if err == nil {
		t.Fatal("Open accepted a malformed database URL")
	}
	if strings.Contains(err.Error(), secret) {
		t.Fatalf("Open error exposed database password: %v", err)
	}
}
