-- Storage bucket setup for profile photos
-- Run this in Supabase SQL Editor

-- Create the profile-photos bucket
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
    'profile-photos',
    'profile-photos',
    true,
    false,
    2097152, -- 2MB in bytes
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload their own photos
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-photos');

-- Policy to allow public access to view photos
CREATE POLICY "Allow public view"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-photos');

-- Policy to allow users to update their own photos
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-photos');

-- Policy to allow users to delete their own photos
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-photos');
