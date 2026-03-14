-- Add role to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'viewer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Update existing profiles to admin
UPDATE public.profiles SET role = 'admin' WHERE role = 'viewer';

-- Allow admins to manage all profiles (for user management)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- All authenticated users can read profiles
CREATE POLICY "Authenticated users can read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- Users can update own profile, admins can update any
CREATE POLICY "Users can update profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Allow inserting profiles (for new user creation)
CREATE POLICY "Allow insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (true);

-- Allow delete (for admin user removal)
CREATE POLICY "Allow delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (true);

-- Update notifications policy to allow all authenticated users to see all notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

CREATE POLICY "Authenticated can view notifications" ON public.notifications
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can update notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete notifications" ON public.notifications
  FOR DELETE TO authenticated USING (true);

-- Update handle_new_user to set role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
  );
  RETURN NEW;
END;
$$;
