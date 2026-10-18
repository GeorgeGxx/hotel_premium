package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	AppEnv                string
	AppPort               string
	DBHost                string
	DBPort                string
	DBUser                string
	DBPassword            string
	DBName                string
	DBSSLMode             string
	DBMaxOpenConns        int
	DBMaxIdleConns        int
	RedisAddr             string
	RedisPassword         string
	OTelCollectorURL      string
	KeycloakURL           string
	KeycloakRealm         string
	KeycloakClientID      string
	KeycloakClientSecret  string
	JWTSecret             string
	KafkaBootstrapServers string
	KafkaStayTopic        string
	VaultAddr             string
	VaultToken            string
}

func Load() *Config {
	return &Config{
		AppEnv:                getEnv("APP_ENV", "development"),
		AppPort:               getEnv("APP_PORT", "8080"),
		DBHost:                getEnv("DB_HOST", "postgres"),
		DBPort:                getEnv("DB_PORT", "5432"),
		DBUser:                getEnv("DB_USER", "hotel_admin"),
		DBPassword:            getEnv("DB_PASSWORD", "hotel_secure_password_2026"),
		DBName:                getEnv("DB_NAME", "hotel_premium_db"),
		DBSSLMode:             getEnv("DB_SSLMODE", "disable"),
		DBMaxOpenConns:        getEnvAsInt("DB_MAX_OPEN_CONNS", 25),
		DBMaxIdleConns:        getEnvAsInt("DB_MAX_IDLE_CONNS", 10),
		RedisAddr:             getEnv("REDIS_ADDR", "redis:6379"),
		RedisPassword:         getEnv("REDIS_PASSWORD", ""),
		OTelCollectorURL:      getEnv("OTEL_COLLECTOR_URL", "otel-collector:4317"),
		KeycloakURL:           getEnv("KEYCLOAK_URL", "http://keycloak:8080"),
		KeycloakRealm:         getEnv("KEYCLOAK_REALM", "hotel-realm"),
		KeycloakClientID:      getEnv("KEYCLOAK_CLIENT_ID", "hotel-backend"),
		KeycloakClientSecret:  getEnv("KEYCLOAK_CLIENT_SECRET", "hotel_backend_secret_key_2026"),
		JWTSecret:             getEnv("JWT_SECRET", "super_secret_hotel_jwt_key_at_least_32_characters_long_2026"),
		KafkaBootstrapServers: getEnv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092"),
		KafkaStayTopic:        getEnv("KAFKA_STAY_TOPIC", "hotel.stays.lifecycle.v1"),
		VaultAddr:             getEnv("VAULT_ADDR", "http://vault:8200"),
		VaultToken:            getEnv("VAULT_TOKEN", "hotel_vault_dev_root_token_2026"),
	}
}

func (c *Config) DSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName, c.DBSSLMode)
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvAsInt(key string, defaultVal int) int {
	valStr := getEnv(key, "")
	if val, err := strconv.Atoi(valStr); err == nil {
		return val
	}
	return defaultVal
}
