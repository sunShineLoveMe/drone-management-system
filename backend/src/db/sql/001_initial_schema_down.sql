-- Drop indexes
DROP INDEX IF EXISTS idx_telemetry_drone_time;
DROP INDEX IF EXISTS idx_alerts_severity;
DROP INDEX IF EXISTS idx_alerts_type;
DROP INDEX IF EXISTS idx_spatial_zones_geom;
DROP INDEX IF EXISTS idx_missions_area;
DROP INDEX IF EXISTS idx_missions_status;
DROP INDEX IF EXISTS idx_drones_status;
DROP INDEX IF EXISTS idx_drones_location;

-- Drop tables
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS spatial_zones;
DROP TABLE IF EXISTS missions;
DROP TABLE IF EXISTS drone_telemetry;
DROP TABLE IF EXISTS drones;
DROP TABLE IF EXISTS users;