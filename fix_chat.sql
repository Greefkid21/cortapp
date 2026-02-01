-- Enable Realtime and Fix Chat Permissions

-- 1. Ensure Realtime is enabled for the messages table
-- Note: 'supabase_realtime' is the default publication name in Supabase
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END
$$;

-- 2. Ensure RLS policies are correct
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read messages" ON messages;
CREATE POLICY "Auth read messages" ON messages FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth insert messages" ON messages;
CREATE POLICY "Auth insert messages" ON messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 3. Grant permissions to authenticated users (just in case)
GRANT ALL ON messages TO authenticated;
