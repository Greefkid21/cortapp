-- Fix permissions and ensure admin access

-- 1. Create profiles for any users that are missing them (e.g. if trigger failed)
-- This will make ALL current users admins. 
INSERT INTO public.profiles (id, email, role, status)
SELECT id, email, 'admin', 'active'
FROM auth.users
ON CONFLICT (id) DO UPDATE 
SET role = 'admin', status = 'active';

-- 2. Add policy to allow users to insert their own profile (fixes "Grant Access" button for future)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. Ensure update policy exists
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
