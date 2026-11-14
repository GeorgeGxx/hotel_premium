package postgres

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

// RunMigrations executes deterministic, version-tracked SQL migrations from migrationsDir.
// It explicitly skips 000000_create_keycloak_db.sql (which is a cluster-level database creation script)
// and tracks each applied migration in the schema_migrations table.
func RunMigrations(ctx context.Context, db *gorm.DB, migrationsDir string) error {
	if db == nil {
		return fmt.Errorf("cannot run migrations: gorm.DB is nil")
	}
	if migrationsDir == "" {
		migrationsDir = "migrations"
	}

	// Ensure schema_migrations tracking table exists
	createTableSQL := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
	`
	if err := db.WithContext(ctx).Exec(createTableSQL).Error; err != nil {
		return fmt.Errorf("failed to create schema_migrations table: %w", err)
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("failed to read migrations directory %q: %w", migrationsDir, err)
	}

	var files []string
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		if strings.HasPrefix(entry.Name(), "000000_") {
			continue
		}
		files = append(files, entry.Name())
	}
	sort.Strings(files)

	for _, filename := range files {
		var count int64
		if err := db.WithContext(ctx).Raw("SELECT COUNT(*) FROM schema_migrations WHERE version = ?", filename).Scan(&count).Error; err != nil {
			return fmt.Errorf("failed to check migration status for %s: %w", filename, err)
		}
		if count > 0 {
			continue
		}

		fullPath := filepath.Join(migrationsDir, filename)
		sqlBytes, err := os.ReadFile(filepath.Clean(fullPath))
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", filename, err)
		}

		err = db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			if err := tx.Exec(string(sqlBytes)).Error; err != nil {
				return err
			}
			return tx.Exec("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", filename, time.Now().UTC()).Error
		})
		if err != nil {
			return fmt.Errorf("failed to apply migration %s: %w", filename, err)
		}

		slog.Info("Applied database migration successfully", "version", filename)
	}

	return nil
}
