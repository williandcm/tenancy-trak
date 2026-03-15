-- MIGRATION: RLS segura baseada em roles para tenancy-trak
-- Apague todas as policies permissivas existentes

-- Exemplo para tabela profiles
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow delete profiles" ON public.profiles;

-- Permitir que cada usuário veja e edite apenas seu perfil
CREATE POLICY "User can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Permitir que admin veja e edite todos
CREATE POLICY "Admin can view all profiles" ON public.profiles
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "Admin can update all profiles" ON public.profiles
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "Admin can insert profiles" ON public.profiles
  FOR INSERT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "Admin can delete profiles" ON public.profiles
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

-- Exemplo para tabela tenants
DROP POLICY IF EXISTS "Authenticated users can manage tenants" ON public.tenants;
CREATE POLICY "Admin/manager/operator can manage tenants" ON public.tenants
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('admin','manager','operator')));
CREATE POLICY "Tenant can view own tenant" ON public.tenants
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'tenant' AND p.tenant_id = id));

-- Exemplo para tabela contracts
DROP POLICY IF EXISTS "Authenticated users can manage contracts" ON public.contracts;
CREATE POLICY "Admin/manager/operator can manage contracts" ON public.contracts
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('admin','manager','operator')));
CREATE POLICY "Tenant can view own contract" ON public.contracts
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'tenant' AND p.tenant_id = tenant_id));

-- Exemplo para tabela payments
DROP POLICY IF EXISTS "Authenticated users can manage payments" ON public.payments;
CREATE POLICY "Admin/manager/operator can manage payments" ON public.payments
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('admin','manager','operator')));
CREATE POLICY "Tenant can view own payments" ON public.payments
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'tenant' AND p.tenant_id = (SELECT tenant_id FROM public.contracts c WHERE c.id = contract_id)));

-- Repita lógica similar para landlords, units, utility_readings, tenant_documents, notifications
-- Exemplo para landlords
DROP POLICY IF EXISTS "Authenticated users can manage landlords" ON public.landlords;
CREATE POLICY "Admin/manager/operator can manage landlords" ON public.landlords
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('admin','manager','operator')));

-- Exemplo para units
DROP POLICY IF EXISTS "Authenticated users can manage units" ON public.units;
CREATE POLICY "Admin/manager/operator can manage units" ON public.units
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('admin','manager','operator')));

-- Exemplo para utility_readings
DROP POLICY IF EXISTS "Authenticated users can manage utility readings" ON public.utility_readings;
CREATE POLICY "Admin/manager/operator can manage utility readings" ON public.utility_readings
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('admin','manager','operator')));

-- Exemplo para tenant_documents
DROP POLICY IF EXISTS "Authenticated users can manage documents" ON public.tenant_documents;
CREATE POLICY "Admin/manager/operator can manage documents" ON public.tenant_documents
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('admin','manager','operator')));
CREATE POLICY "Tenant can view own documents" ON public.tenant_documents
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'tenant' AND p.tenant_id = tenant_id));

-- Exemplo para notifications
DROP POLICY IF EXISTS "Authenticated can view notifications" ON public.notifications;
CREATE POLICY "User can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin can manage all notifications" ON public.notifications
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

-- Storage: bucket policies devem ser ajustadas no painel do Supabase para restringir acesso por role

-- Ative RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landlords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utility_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
