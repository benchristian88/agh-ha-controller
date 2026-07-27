package domain

import "testing"

func TestNewID(t *testing.T) {
	t.Parallel()
	id, err := NewID()
	if err != nil {
		t.Fatalf("NewID() error = %v", err)
	}
	if !ValidID(id) {
		t.Fatalf("NewID() = %q, want valid UUID", id)
	}
	if ValidID("1") {
		t.Fatal("ValidID accepted a non-UUID")
	}
}
