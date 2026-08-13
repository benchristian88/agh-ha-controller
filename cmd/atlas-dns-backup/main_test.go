package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSecretFileRequiresBoundedProtectedRegularFile(t *testing.T) {
	directory := t.TempDir()
	protected := filepath.Join(directory, "protected")
	if err := os.WriteFile(protected, []byte("a strong backup passphrase\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	value, err := protectedFile(protected, "passphrase")
	if err != nil || value != "a strong backup passphrase" {
		t.Fatalf("value=%q err=%v", value, err)
	}
	open := filepath.Join(directory, "open")
	if err := os.WriteFile(open, []byte("secret"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := protectedFile(open, "passphrase"); err == nil {
		t.Fatal("expected open-permission rejection")
	}
	link := filepath.Join(directory, "link")
	if err := os.Symlink(protected, link); err != nil {
		t.Fatal(err)
	}
	if _, err := protectedFile(link, "passphrase"); err == nil {
		t.Fatal("expected symlink rejection")
	}
	oversized := filepath.Join(directory, "oversized")
	if err := os.WriteFile(oversized, []byte(strings.Repeat("x", 1025)), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := protectedFile(oversized, "passphrase"); err == nil {
		t.Fatal("expected bounded-file rejection")
	}
}
