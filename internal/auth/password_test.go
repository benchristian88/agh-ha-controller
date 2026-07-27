package auth

import "testing"

func TestPasswordRoundTrip(t *testing.T) {
	hash, err := HashPassword("correct horse battery staple")
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}
	valid, err := VerifyPassword(hash, "correct horse battery staple")
	if err != nil || !valid {
		t.Fatalf("VerifyPassword(correct) = %v, %v", valid, err)
	}
	valid, err = VerifyPassword(hash, "incorrect password")
	if err != nil {
		t.Fatalf("VerifyPassword(incorrect) error = %v", err)
	}
	if valid {
		t.Fatal("VerifyPassword accepted an incorrect password")
	}
}

func TestValidatePassword(t *testing.T) {
	t.Parallel()
	if err := ValidatePassword("too-short"); err == nil {
		t.Fatal("ValidatePassword accepted a short password")
	}
}
