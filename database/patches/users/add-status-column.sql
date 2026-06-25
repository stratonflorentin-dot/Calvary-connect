-- Add status column to user_profiles table
-- Run this in your Supabase SQL Editor

-- Add status column if it doesn't exist
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Update existing users to have status
UPDATE user_profiles 
SET status = 'active' 
WHERE status IS NULL;
