-- Up migration
-- Add your SQL for applying the migration here
INSERT INTO elevators (name, current_floor, direction, state, is_busy)
VALUES
  ('Elevator A', 1, 'IDLE', 'IDLE', FALSE),
  ('Elevator B', 1, 'IDLE', 'IDLE', FALSE),
  ('Elevator C', 1, 'IDLE', 'IDLE', FALSE);



-- Down migration
-- Add your SQL for reverting the migration here
DELETE FROM elevators WHERE name IN ('Elevator A', 'Elevator B', 'Elevator C');
