-- Emergency Response System Schema

-- Emergency types and severity levels
CREATE TYPE emergency_type AS ENUM (
  'LOW_BATTERY',
  'SIGNAL_LOSS',
  'OBSTACLE_DETECTED',
  'WEATHER_ALERT',
  'TECHNICAL_FAILURE',
  'GEOFENCE_BREACH',
  'COLLISION_AVOIDANCE',
  'MANUAL_TRIGGER'
);

CREATE TYPE emergency_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE emergency_status AS ENUM ('PENDING', 'ACTIVE', 'RESOLVED', 'CANCELLED');

-- Emergencies table
CREATE TABLE IF NOT EXISTS emergencies (
  id SERIAL PRIMARY KEY,
  drone_id INTEGER NOT NULL,
  emergency_type emergency_type NOT NULL,
  severity emergency_severity NOT NULL,
  status emergency_status DEFAULT 'PENDING',
  location GEOMETRY(POINT, 4326),
  description TEXT,
  response_actions JSONB DEFAULT '[]',
  assigned_team VARCHAR(100),
  notes TEXT,
  resolution TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reported_by INTEGER NOT NULL,
  updated_by INTEGER,
  FOREIGN KEY (drone_id) REFERENCES drones(id) ON DELETE CASCADE,
  FOREIGN KEY (reported_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Emergency protocol execution tracking
CREATE TABLE IF NOT EXISTS emergency_protocol_executions (
  id SERIAL PRIMARY KEY,
  emergency_id INTEGER NOT NULL,
  protocol_type VARCHAR(50) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  steps JSONB NOT NULL,
  auto_execute BOOLEAN DEFAULT false,
  max_execution_time INTEGER, -- milliseconds
  triggered_by INTEGER NOT NULL,
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (emergency_id) REFERENCES emergencies(id) ON DELETE CASCADE,
  FOREIGN KEY (triggered_by) REFERENCES users(id)
);

-- Emergency response teams
CREATE TABLE IF NOT EXISTS emergency_teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  team_type VARCHAR(50) NOT NULL,
  members JSONB DEFAULT '[]',
  contact_info JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Emergency contact integrations
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  contact_type VARCHAR(50) NOT NULL, -- 'FIRE', 'POLICE', 'MEDICAL', 'CUSTOM'
  phone VARCHAR(20),
  email VARCHAR(100),
  api_endpoint VARCHAR(255),
  api_key VARCHAR(255),
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Emergency notifications log
CREATE TABLE IF NOT EXISTS emergency_notifications (
  id SERIAL PRIMARY KEY,
  emergency_id INTEGER NOT NULL,
  notification_type VARCHAR(50) NOT NULL, -- 'SMS', 'EMAIL', 'PUSH', 'API', 'WEBHOOK'
  recipient VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'SENT', 'FAILED', 'DELIVERED'
  response_data JSONB,
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  failed_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (emergency_id) REFERENCES emergencies(id) ON DELETE CASCADE
);

-- Emergency response history
CREATE TABLE IF NOT EXISTS emergency_response_history (
  id SERIAL PRIMARY KEY,
  emergency_id INTEGER NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  description TEXT,
  performed_by INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (emergency_id) REFERENCES emergencies(id) ON DELETE CASCADE,
  FOREIGN KEY (performed_by) REFERENCES users(id)
);

-- Emergency escalation rules
CREATE TABLE IF NOT EXISTS emergency_escalation_rules (
  id SERIAL PRIMARY KEY,
  emergency_type emergency_type NOT NULL,
  severity emergency_severity NOT NULL,
  escalation_delay INTEGER NOT NULL, -- seconds
  escalation_team VARCHAR(100),
  escalation_contacts JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for emergency system
CREATE INDEX IF NOT EXISTS idx_emergencies_drone_id ON emergencies (drone_id);
CREATE INDEX IF NOT EXISTS idx_emergencies_status ON emergencies (status);
CREATE INDEX IF NOT EXISTS idx_emergencies_severity ON emergencies (severity);
CREATE INDEX IF NOT EXISTS idx_emergencies_type ON emergencies (emergency_type);
CREATE INDEX IF NOT EXISTS idx_emergencies_created_at ON emergencies (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergencies_location ON emergencies USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_emergency_protocols_emergency_id ON emergency_protocol_executions (emergency_id);
CREATE INDEX IF NOT EXISTS idx_emergency_notifications_emergency_id ON emergency_notifications (emergency_id);
CREATE INDEX IF NOT EXISTS idx_emergency_notifications_status ON emergency_notifications (status);
CREATE INDEX IF NOT EXISTS idx_emergency_history_emergency_id ON emergency_response_history (emergency_id);
CREATE INDEX IF NOT EXISTS idx_emergency_escalation_type_severity ON emergency_escalation_rules (emergency_type, severity);

-- Insert default emergency teams
INSERT INTO emergency_teams (name, description, team_type, members, contact_info) VALUES
('Technical Response Team', 'Handles technical failures and system issues', 'TECHNICAL', 
 '[{"name": "John Smith", "role": "Lead Engineer", "phone": "+1-555-0101", "email": "john@company.com"}]',
 '{"emergency": "+1-555-0911", "dispatch": "+1-555-0912"}'),
('Field Operations Team', 'Manages on-site emergency response', 'FIELD',
 '[{"name": "Sarah Johnson", "role": "Field Manager", "phone": "+1-555-0201", "email": "sarah@company.com"}]',
 '{"emergency": "+1-555-0921", "dispatch": "+1-555-0922"}'),
('Emergency Services', 'External emergency service coordination', 'EXTERNAL',
 '[{"name": "Emergency Dispatch", "role": "Coordinator", "phone": "911"}]',
 '{"fire": "911", "police": "911", "medical": "911"}')
ON CONFLICT DO NOTHING;

-- Insert default escalation rules
INSERT INTO emergency_escalation_rules (emergency_type, severity, escalation_delay, escalation_team, escalation_contacts) VALUES
('LOW_BATTERY', 'HIGH', 30, 'Technical Response Team', '["field-team@company.com"]'),
('SIGNAL_LOSS', 'CRITICAL', 15, 'Field Operations Team', '["emergency@company.com", "+1-555-0911"]'),
('TECHNICAL_FAILURE', 'CRITICAL', 0, 'Technical Response Team', '["+1-555-0911", "+1-555-0921"]'),
('COLLISION_AVOIDANCE', 'HIGH', 60, 'Field Operations Team', '["field-team@company.com"]'),
('GEOFENCE_BREACH', 'MEDIUM', 120, 'Field Operations Team', '["field-team@company.com"]')
ON CONFLICT DO NOTHING;

-- Insert default emergency contacts
INSERT INTO emergency_contacts (name, contact_type, phone, email, api_endpoint, enabled) VALUES
('Local Fire Department', 'FIRE', '911', NULL, NULL, true),
('Local Police Department', 'POLICE', '911', NULL, NULL, true),
('Medical Emergency', 'MEDICAL', '911', NULL, NULL, true),
('FAA Emergency Line', 'CUSTOM', '+1-866-TELL-FAA', 'emergency@faa.gov', NULL, true)
ON CONFLICT DO NOTHING;