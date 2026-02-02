-- Enable RLS on messages if not already enabled
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean slate for update/delete
DROP POLICY IF EXISTS "Users can update own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON messages;
DROP POLICY IF EXISTS "Admins can update any message" ON messages;
DROP POLICY IF EXISTS "Admins can delete any message" ON messages;

-- Policy: Users can update their own messages
CREATE POLICY "Users can update own messages" 
ON messages FOR UPDATE 
TO authenticated 
USING (auth.uid() = sender_user_id);

-- Policy: Users can delete their own messages
CREATE POLICY "Users can delete own messages" 
ON messages FOR DELETE 
TO authenticated 
USING (auth.uid() = sender_user_id);

-- Policy: Admins can update any message
CREATE POLICY "Admins can update any message" 
ON messages FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Policy: Admins can delete any message
CREATE POLICY "Admins can delete any message" 
ON messages FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);
