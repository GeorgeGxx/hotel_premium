# ==============================================================================
# HOTEL PREMIUM - HASHICORP VAULT ACCESS POLICY
# Least-privilege read access for microservices & External Secrets Operator (ESO)
# ==============================================================================

path "secret/data/hotel-premium/*" {
  capabilities = ["read", "list"]
}

path "secret/metadata/hotel-premium/*" {
  capabilities = ["read", "list"]
}

# Allow services to renew their own token
path "auth/token/renew-self" {
  capabilities = ["update"]
}
