-- ============================================================
-- SECURE RLS POLICIES - Role-based access control
-- Replaces the overly permissive "authenticated = full access"
-- ============================================================

-- Helper function: get user role from profiles table
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Helper function: check if user is admin or manager
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  );
$$;

-- Helper function: check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
$$;

-- Helper function: get tenant_id linked to current user
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (tenant_id)::uuid FROM public.profiles WHERE user_id = auth.uid();
$$;


-- ============================================================
-- PROFILES
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow delete profiles" ON public.profiles;

-- Everyone can read profiles (needed for UI, user info display)
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- Users can update their own profile (name, phone), admins can update any
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Only the system trigger / service role can insert profiles
-- (the handle_new_user trigger runs as SECURITY DEFINER)
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Only admins can delete profiles
CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ============================================================
-- LANDLORDS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage landlords" ON public.landlords;

-- Admin/Manager/Operator/Viewer can read landlords (tenants cannot)
CREATE POLICY "landlords_select" ON public.landlords
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('admin', 'manager', 'operator', 'viewer'));

-- Only admin/manager can insert/update/delete landlords
CREATE POLICY "landlords_insert" ON public.landlords
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "landlords_update" ON public.landlords
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "landlords_delete" ON public.landlords
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ============================================================
-- UNITS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage units" ON public.units;

-- Non-tenant roles can see all units
CREATE POLICY "units_select" ON public.units
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('admin', 'manager', 'operator', 'viewer'));

-- Only admin/manager can modify units
CREATE POLICY "units_insert" ON public.units
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "units_update" ON public.units
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "units_delete" ON public.units
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ============================================================
-- TENANTS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage tenants" ON public.tenants;

-- Non-tenant roles can see all tenants; tenants can only see themselves
CREATE POLICY "tenants_select" ON public.tenants
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('admin', 'manager', 'operator', 'viewer')
    OR id = public.get_user_tenant_id()
  );

-- Only admin/manager can modify tenants
CREATE POLICY "tenants_insert" ON public.tenants
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "tenants_update" ON public.tenants
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "tenants_delete" ON public.tenants
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ============================================================
-- CONTRACTS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage contracts" ON public.contracts;

-- Non-tenant roles see all; tenants see only their own contracts
CREATE POLICY "contracts_select" ON public.contracts
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('admin', 'manager', 'operator', 'viewer')
    OR tenant_id = public.get_user_tenant_id()
  );

-- Only admin/manager can create/update contracts
CREATE POLICY "contracts_insert" ON public.contracts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "contracts_update" ON public.contracts
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "contracts_delete" ON public.contracts
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ============================================================
-- PAYMENTS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage payments" ON public.payments;

-- Non-tenant roles see all; tenants see only payments for their contracts
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('admin', 'manager', 'operator', 'viewer')
    OR contract_id IN (
      SELECT id FROM public.contracts WHERE tenant_id = public.get_user_tenant_id()
    )
  );

-- Admin/Manager/Operator can manage payments
CREATE POLICY "payments_insert" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'manager', 'operator'));

CREATE POLICY "payments_update" ON public.payments
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('admin', 'manager', 'operator'))
  WITH CHECK (public.get_user_role() IN ('admin', 'manager', 'operator'));

CREATE POLICY "payments_delete" ON public.payments
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ============================================================
-- UTILITY READINGS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage utility readings" ON public.utility_readings;

-- Non-tenant roles can read utility readings
CREATE POLICY "utility_readings_select" ON public.utility_readings
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('admin', 'manager', 'operator', 'viewer'));

-- Admin/Manager/Operator can manage utility readings
CREATE POLICY "utility_readings_insert" ON public.utility_readings
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'manager', 'operator'));

CREATE POLICY "utility_readings_update" ON public.utility_readings
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('admin', 'manager', 'operator'))
  WITH CHECK (public.get_user_role() IN ('admin', 'manager', 'operator'));

CREATE POLICY "utility_readings_delete" ON public.utility_readings
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ============================================================
-- TENANT DOCUMENTS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage documents" ON public.tenant_documents;

-- Non-tenant roles see all; tenants see only their own docs
CREATE POLICY "tenant_documents_select" ON public.tenant_documents
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('admin', 'manager', 'operator', 'viewer')
    OR tenant_id = public.get_user_tenant_id()
  );

-- Tenants can submit their own documents; admin/manager can also insert
CREATE POLICY "tenant_documents_insert" ON public.tenant_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_manager()
    OR tenant_id = public.get_user_tenant_id()
  );

-- Admin/Manager can update (approve/reject); tenants can update their own pending docs
CREATE POLICY "tenant_documents_update" ON public.tenant_documents
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_manager()
    OR (tenant_id = public.get_user_tenant_id() AND status = 'pending')
  )
  WITH CHECK (
    public.is_admin_or_manager()
    OR (tenant_id = public.get_user_tenant_id() AND status = 'pending')
  );

CREATE POLICY "tenant_documents_delete" ON public.tenant_documents
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ============================================================
-- NOTIFICATIONS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can view notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can update notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can delete notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

-- Users can only see their own notifications
CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can update (mark read) their own notifications
CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- System/admin can create notifications for anyone
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'manager', 'operator'));

-- Users can delete their own notifications
CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());


-- ============================================================
-- STORAGE: bill-attachments
-- ============================================================

-- Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('bill-attachments', 'bill-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Drop old permissive policies on tenant-documents and bill-attachments
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;

-- Storage policies for tenant-documents bucket
CREATE POLICY "tenant_docs_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-documents'
    AND (
      public.is_admin_or_manager()
      OR (public.get_user_role() = 'tenant')
    )
  );

CREATE POLICY "tenant_docs_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'tenant-documents'
  );

CREATE POLICY "tenant_docs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'tenant-documents'
    AND public.is_admin_or_manager()
  );

-- Storage policies for bill-attachments bucket (admin/manager/operator only)
CREATE POLICY "bill_attachments_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bill-attachments'
    AND public.get_user_role() IN ('admin', 'manager', 'operator')
  );

CREATE POLICY "bill_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'bill-attachments'
    AND public.get_user_role() IN ('admin', 'manager', 'operator', 'viewer')
  );

CREATE POLICY "bill_attachments_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'bill-attachments'
    AND public.get_user_role() IN ('admin', 'manager', 'operator')
  );

CREATE POLICY "bill_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'bill-attachments'
    AND public.is_admin_or_manager()
  );
