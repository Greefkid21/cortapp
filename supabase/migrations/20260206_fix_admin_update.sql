-- Fix RLS policy to allow Admins to update other users' profiles

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- 1. Create a policy that allows admins to update ANY row in the profiles table
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

CREATE POLICY "Admins can update any profile" ON profiles 
FOR UPDATE 
USING (public.is_admin_user());

-- 2. Verify the policy for SELECT (Viewing) as well, just in case
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

CREATE POLICY "Admins can view all profiles" ON profiles 
FOR SELECT 
USING (public.is_admin_user());
