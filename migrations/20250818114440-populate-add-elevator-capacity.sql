-- Up migration
ALTER TABLE elevators
ADD COLUMN capacity INTEGER CHECK (capacity >= 1 OR capacity IS NULL);

UPDATE elevators
SET capacity = 10
WHERE capacity IS NULL;

ALTER TABLE elevators
ALTER COLUMN capacity SET NOT NULL;

CREATE INDEX idx_elevators_capacity ON elevators (capacity);

-- Down migration
DROP INDEX IF EXISTS idx_elevators_capacity;
ALTER TABLE elevators
DROP COLUMN capacity;