package security

import (
	"context"
	"testing"
)

func TestVaultTransitClient_LocalRoundTrip(t *testing.T) {
	client := NewVaultTransitClient("", "", "hotel-pii")
	ctx := context.Background()

	testPII := "PASSPORT-AB-987654321"

	encrypted, err := client.Encrypt(ctx, testPII)
	if err != nil {
		t.Fatalf("unexpected encryption error: %v", err)
	}
	if encrypted == testPII {
		t.Errorf("ciphertext should not equal plaintext")
	}

	decrypted, err := client.Decrypt(ctx, encrypted)
	if err != nil {
		t.Fatalf("unexpected decryption error: %v", err)
	}

	if decrypted != testPII {
		t.Errorf("expected decrypted text '%s', got '%s'", testPII, decrypted)
	}
}

func TestVaultTransitClient_EmptyString(t *testing.T) {
	client := NewVaultTransitClient("", "", "hotel-pii")
	ctx := context.Background()

	enc, err := client.Encrypt(ctx, "")
	if err != nil || enc != "" {
		t.Errorf("empty string encryption failed: enc='%s', err=%v", enc, err)
	}

	dec, err := client.Decrypt(ctx, "")
	if err != nil || dec != "" {
		t.Errorf("empty string decryption failed: dec='%s', err=%v", dec, err)
	}
}

func TestVaultTransitClient_CorruptedCiphertext(t *testing.T) {
	client := NewVaultTransitClient("", "", "hotel-pii")
	ctx := context.Background()

	_, err := client.Decrypt(ctx, "local:v1:corrupted-bytes-12345")
	if err == nil {
		t.Errorf("expected decryption error for corrupted ciphertext, got nil")
	}
}
