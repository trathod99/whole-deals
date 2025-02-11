-- Add preference_type column
ALTER TABLE user_preferences
ADD COLUMN preference_type text NOT NULL DEFAULT 'include'
CHECK (preference_type IN ('include', 'exclude'));
