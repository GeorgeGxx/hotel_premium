package security

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

var (
	ErrInvalidCiphertext = errors.New("invalid ciphertext format")
	ErrDecryptionFailed  = errors.New("decryption failed or authentication tag mismatch")
)

// TransitEncryptor provides field-level encryption for sensitive PII (GDPR/PCI-DSS compliance)
type TransitEncryptor interface {
	Encrypt(ctx context.Context, plaintext string) (string, error)
	Decrypt(ctx context.Context, ciphertext string) (string, error)
}

// VaultTransitClient integrates with HashiCorp Vault Transit Secrets Engine (/v1/transit)
// with an automatic fallback to local AES-256-GCM authenticated encryption
type VaultTransitClient struct {
	vaultAddr  string
	vaultToken string
	keyName    string
	httpClient *http.Client
	localKey   []byte
	mu         sync.RWMutex
}

// NewVaultTransitClient instantiates a TransitEncryptor configured for Vault or local fallback
func NewVaultTransitClient(vaultAddr, vaultToken, keyName string) *VaultTransitClient {
	if keyName == "" {
		keyName = "hotel-pii"
	}

	// Derive local 256-bit AES key from environment or generate ephemeral key for test/dev
	var localKey []byte
	if secretSeed := os.Getenv("PII_ENCRYPTION_KEY"); secretSeed != "" {
		h := sha256.Sum256([]byte(secretSeed))
		localKey = h[:]
	} else {
		localKey = make([]byte, 32)
		if _, err := io.ReadFull(rand.Reader, localKey); err != nil {
			h := sha256.Sum256([]byte("dev-ephemeral-seed"))
			localKey = h[:]
		}
	}

	return &VaultTransitClient{
		vaultAddr:  strings.TrimRight(vaultAddr, "/"),
		vaultToken: vaultToken,
		keyName:    keyName,
		httpClient: &http.Client{Timeout: 5 * time.Second},
		localKey:   localKey,
	}
}

// Encrypt encrypts plaintext using Vault Transit or AES-256-GCM fallback
func (c *VaultTransitClient) Encrypt(ctx context.Context, plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}

	// Try HashiCorp Vault Transit if configured
	if c.vaultAddr != "" && c.vaultToken != "" {
		ciphertext, err := c.encryptWithVault(ctx, plaintext)
		if err == nil {
			return ciphertext, nil
		}
		// Fallback smoothly to AES-256-GCM if Vault is temporarily unreachable
	}

	return c.encryptLocal(plaintext)
}

// Decrypt decrypts ciphertext (vault:v1:... or local:v1:...)
func (c *VaultTransitClient) Decrypt(ctx context.Context, ciphertext string) (string, error) {
	if ciphertext == "" {
		return "", nil
	}

	if strings.HasPrefix(ciphertext, "vault:") && c.vaultAddr != "" && c.vaultToken != "" {
		plain, err := c.decryptWithVault(ctx, ciphertext)
		if err == nil {
			return plain, nil
		}
	}

	return c.decryptLocal(ciphertext)
}

func (c *VaultTransitClient) encryptWithVault(ctx context.Context, plaintext string) (string, error) {
	endpoint := fmt.Sprintf("%s/v1/transit/encrypt/%s", c.vaultAddr, c.keyName)
	b64Plain := base64.StdEncoding.EncodeToString([]byte(plaintext))

	payload := map[string]string{"plaintext": b64Plain}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("X-Vault-Token", c.vaultToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("vault transit returned HTTP %d", resp.StatusCode)
	}

	var vaultResp struct {
		Data struct {
			Ciphertext string `json:"ciphertext"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&vaultResp); err != nil {
		return "", err
	}
	return vaultResp.Data.Ciphertext, nil
}

func (c *VaultTransitClient) decryptWithVault(ctx context.Context, ciphertext string) (string, error) {
	endpoint := fmt.Sprintf("%s/v1/transit/decrypt/%s", c.vaultAddr, c.keyName)

	payload := map[string]string{"ciphertext": ciphertext}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("X-Vault-Token", c.vaultToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("vault transit returned HTTP %d", resp.StatusCode)
	}

	var vaultResp struct {
		Data struct {
			Plaintext string `json:"plaintext"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&vaultResp); err != nil {
		return "", err
	}

	rawBytes, err := base64.StdEncoding.DecodeString(vaultResp.Data.Plaintext)
	if err != nil {
		return "", err
	}
	return string(rawBytes), nil
}

func (c *VaultTransitClient) encryptLocal(plaintext string) (string, error) {
	block, err := aes.NewCipher(c.localKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	sealed := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return "local:v1:" + base64.RawURLEncoding.EncodeToString(sealed), nil
}

func (c *VaultTransitClient) decryptLocal(ciphertext string) (string, error) {
	raw := strings.TrimPrefix(ciphertext, "local:v1:")
	raw = strings.TrimPrefix(raw, "vault:v1:") // handles simulated/vault prefix fallback
	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		// Try standard base64 if url encoding fails
		data, err = base64.StdEncoding.DecodeString(raw)
		if err != nil {
			return "", ErrInvalidCiphertext
		}
	}

	block, err := aes.NewCipher(c.localKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", ErrInvalidCiphertext
	}

	nonce, encrypted := data[:nonceSize], data[nonceSize:]
	decrypted, err := gcm.Open(nil, nonce, encrypted, nil)
	if err != nil {
		return "", ErrDecryptionFailed
	}

	return string(decrypted), nil
}
