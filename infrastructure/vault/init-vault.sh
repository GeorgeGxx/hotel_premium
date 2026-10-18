#!/bin/sh
set -e

echo "[Vault Init] Waiting for Vault server to be ready at ${VAULT_ADDR}..."
until vault status > /dev/null 2>&1; do
  sleep 1
done

echo "[Vault Init] Vault is reachable. Initializing KV v2 Secret Engine..."

# 1. Enable KV v2 secret engine if not already enabled
vault secrets enable -version=2 -path=secret kv 2>/dev/null || true

# 2. Write Application Secrets (Database, Keycloak, Kafka, JWT)
echo "[Vault Init] Seeding secrets into secret/hotel-premium/..."

vault kv put secret/hotel-premium/database \
  db_host="${DB_HOST:-postgres}" \
  db_port="${DB_PORT:-5432}" \
  db_user="${DB_USER:-hotel_admin}" \
  db_password="${DB_PASSWORD:-hotel_secure_password_2026}" \
  db_name="${DB_NAME:-hotel_premium_db}"

vault kv put secret/hotel-premium/keycloak \
  admin_user="${KEYCLOAK_ADMIN:-admin}" \
  admin_password="${KEYCLOAK_ADMIN_PASSWORD:-admin}" \
  client_id="${KEYCLOAK_CLIENT_ID:-hotel-backend}" \
  client_secret="${KEYCLOAK_CLIENT_SECRET:-hotel_backend_secret_key_2026}" \
  realm="${KEYCLOAK_REALM:-hotel-realm}"

vault kv put secret/hotel-premium/jwt \
  secret="${JWT_SECRET:-super_secret_hotel_jwt_key_at_least_32_characters_long_2026}" \
  expiration_hours="${JWT_EXPIRATION_HOURS:-24}"

vault kv put secret/hotel-premium/kafka \
  bootstrap_servers="${KAFKA_BOOTSTRAP_SERVERS:-kafka:29092}" \
  security_protocol="PLAINTEXT"

# 3. Apply Policy and AppRole for Microservices & ESO
echo "[Vault Init] Applying policy and AppRole auth..."
vault policy write hotel-backend-policy /vault/config/vault-policy.hcl || true
vault auth enable approle 2>/dev/null || true
vault write auth/approle/role/hotel-backend-role \
  token_policies="hotel-backend-policy" \
  token_ttl=1h \
  token_max_ttl=4h

echo "[Vault Init] Vault initialization and secret provisioning completed successfully!"
