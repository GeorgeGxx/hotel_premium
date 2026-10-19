package postgres

import (
	"log/slog"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/plugin/dbresolver"
)

// ConfigureDBResolver enables automatic Read/Write splitting with GORM v1.31.2
// Sending read queries (SELECT) to read replicas and writes (INSERT/UPDATE/DELETE) to primary
func ConfigureDBResolver(db *gorm.DB, replicaDSNs []string) error {
	if db == nil || len(replicaDSNs) == 0 {
		return nil
	}

	var replicas []gorm.Dialector
	for _, dsn := range replicaDSNs {
		if dsn != "" {
			replicas = append(replicas, postgres.Open(dsn))
		}
	}

	if len(replicas) == 0 {
		return nil
	}

	err := db.Use(dbresolver.Register(dbresolver.Config{
		Replicas: replicas,
		Policy:   dbresolver.RandomPolicy{},
	}).
		SetMaxOpenConns(50).
		SetMaxIdleConns(10).
		SetConnMaxLifetime(30 * time.Minute))

	if err != nil {
		slog.Warn("Failed to configure GORM DBResolver read/write split", "error", err)
		return err
	}

	slog.Info("Successfully registered GORM DBResolver Read/Write Splitting", "replica_count", len(replicas))
	return nil
}
