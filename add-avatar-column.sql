-- Add avatar_url column to user_profiles for profile photos
-- Run this in your Supabase SQL Editor

-- Add avatar_url column
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create storage bucket for profile photos (run this in Supabase Dashboard > Storage)
-- Bucket name: profile-photos
-- Public bucket: true
-- Allowed mime types: image/jpeg, image/png, image/webp
-- Max file size: 2MB
