-- Up migration
-- Add your SQL for applying the migration here
-- Up migration
CREATE TABLE elevators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  current_floor INTEGER NOT NULL CHECK (current_floor >= 1),
  target_floor INTEGER CHECK (target_floor >= 1 OR target_floor IS NULL),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('UP', 'DOWN', 'IDLE')),
  state VARCHAR(20) NOT NULL CHECK (state IN ('IDLE', 'MOVING', 'DOORS_OPENING', 'DOORS_CLOSING')),
  is_busy BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_elevators_is_busy ON elevators (is_busy);
CREATE INDEX idx_elevators_current_floor ON elevators (current_floor);

CREATE TABLE elevator_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elevator_id UUID NOT NULL REFERENCES elevators(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  from_floor INTEGER CHECK (from_floor >= 1 OR from_floor IS NULL),
  to_floor INTEGER CHECK (to_floor >= 1 OR to_floor IS NULL),
  current_floor INTEGER CHECK (current_floor >= 1 OR current_floor IS NULL),
  direction VARCHAR(10) CHECK (direction IN ('UP', 'DOWN', 'IDLE') OR direction IS NULL),
  state VARCHAR(20) CHECK (state IN ('IDLE', 'MOVING', 'DOORS_OPENING', 'DOORS_CLOSING') OR state IS NULL),
  metadata JSONB,
  request_id VARCHAR(255),
  user_context JSONB,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_elevator_logs_elevator_id ON elevator_logs (elevator_id);
CREATE INDEX idx_elevator_logs_event_type ON elevator_logs (event_type);
CREATE INDEX idx_elevator_logs_timestamp ON elevator_logs (timestamp);

CREATE TABLE idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  response_body JSONB,
  response_status INTEGER,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_idempotency_keys_expires_at ON idempotency_keys (expires_at);

CREATE TABLE query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL,
  query_params JSONB,
  execution_time_ms INTEGER NOT NULL,
  user_id VARCHAR(255),
  endpoint VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_query_logs_timestamp ON query_logs (timestamp);
CREATE INDEX idx_query_logs_endpoint ON query_logs (endpoint);


-- Down migration
-- Add your SQL for reverting the migration here
DROP TABLE IF EXISTS query_logs;
DROP TABLE IF EXISTS idempotency_keys;
DROP TABLE IF EXISTS elevator_logs;
DROP TABLE IF EXISTS elevators;