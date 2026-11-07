-- ==============================================================================
-- HOTEL PREMIUM - MIGRATION 000002: OUTBOX PATTERN & RESERVATION EXTENSIONS
-- Enables reliable asynchronous messaging to Kafka 8.3.2 and event consistency
-- ==============================================================================

CREATE TABLE IF NOT EXISTS stay_outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    trace_id VARCHAR(64),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED')),
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMPTZ
);

-- Index for high-performance outbox polling with SKIP LOCKED
CREATE INDEX IF NOT EXISTS idx_outbox_events_pending 
    ON stay_outbox_events (created_at ASC) 
    WHERE (status = 'PENDING');

CREATE INDEX IF NOT EXISTS idx_stays_status 
    ON stays (status);

CREATE INDEX IF NOT EXISTS idx_stays_room_status 
    ON stays (room_id, status);

CREATE INDEX IF NOT EXISTS idx_stays_guest 
    ON stays (primary_guest_id);
