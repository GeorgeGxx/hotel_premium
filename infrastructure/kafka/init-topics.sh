#!/bin/sh
set -e

echo "[Kafka Init] Waiting for Kafka Broker at kafka:29092..."
cub kafka-ready 1 30 -b kafka:29092

echo "[Kafka Init] Creating Enterprise Domain Topics (Confluent 8.3.2 / Apache Kafka KRaft)..."

# 1. Stays lifecycle topic (Partitioned by stay_id/room_id for strict order)
kafka-topics --bootstrap-server kafka:29092 --create --if-not-exists \
  --topic hotel.stays.lifecycle.v1 \
  --partitions 3 \
  --replication-factor 1 \
  --config retention.ms=604800000 \
  --config cleanup.policy=delete \
  --config compression.type=lz4

# 1b. Dead Letter Queue (DLQ) for unrecoverable stay lifecycle events (14-day retention)
kafka-topics --bootstrap-server kafka:29092 --create --if-not-exists \
  --topic hotel.stays.lifecycle.v1.DLQ \
  --partitions 3 \
  --replication-factor 1 \
  --config retention.ms=1209600000 \
  --config cleanup.policy=delete \
  --config compression.type=lz4

# 2. Rooms state change topic (Partitioned by room_number)
kafka-topics --bootstrap-server kafka:29092 --create --if-not-exists \
  --topic hotel.rooms.status-changed.v1 \
  --partitions 3 \
  --replication-factor 1 \
  --config retention.ms=604800000 \
  --config cleanup.policy=delete \
  --config compression.type=lz4

# 3. Billing & POS transactions topic (Partitioned by stay_id)
kafka-topics --bootstrap-server kafka:29092 --create --if-not-exists \
  --topic hotel.billing.charge-applied.v1 \
  --partitions 3 \
  --replication-factor 1 \
  --config retention.ms=1209600000 \
  --config cleanup.policy=delete \
  --config compression.type=lz4

# 4. Asynchronous Notifications topic (Check-in reminders, housekeeping alerts)
kafka-topics --bootstrap-server kafka:29092 --create --if-not-exists \
  --topic hotel.notifications.events.v1 \
  --partitions 3 \
  --replication-factor 1 \
  --config retention.ms=259200000 \
  --config cleanup.policy=delete \
  --config compression.type=lz4

echo "[Kafka Init] All enterprise topics provisioned successfully:"
kafka-topics --bootstrap-server kafka:29092 --list
