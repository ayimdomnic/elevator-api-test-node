-- Up migration
CREATE INDEX idx_elevator_logs_elevator_id_timestamp
ON elevator_logs (elevator_id, timestamp);

-- Down migration
DROP INDEX IF EXISTS idx_elevator_logs_elevator_id_timestamp;