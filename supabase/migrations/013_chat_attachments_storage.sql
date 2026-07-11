
-- Storage bucket setup for chat attachments
-- Run this in Supabase SQL Editor

-- Create the chat-attachments bucket
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
    'chat-attachments',
    'chat-attachments',
    true,
    false,
    52428800, -- 50MB in bytes
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav', 'audio/webm', 'application/zip']
)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload attachments
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

-- Policy to allow public access to view attachments
CREATE POLICY "Allow public view"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-attachments');

-- Policy to allow users to update their own attachments
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'chat-attachments');

-- Policy to allow users to delete their own attachments
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-attachments');

