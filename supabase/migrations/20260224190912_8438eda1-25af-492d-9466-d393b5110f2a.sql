
-- Enum for unit status
CREATE TYPE public.unit_status AS ENUM ('available', 'occupied', 'maintenance');

-- Enum for contract status
CREATE TYPE public.contract_status AS ENUM ('active', 'expired', 'terminated', 'pending');

-- Enum for document status
CREATE TYPE public.document_status AS ENUM ('pending', 'approved', 'rejected');

-- Profiles table for admin users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Landlords (locadores) table
CREATE TABLE public.landlords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  nationality TEXT DEFAULT 'brasileiro(a)',
  marital_status TEXT DEFAULT 'casado(a)',
  rg TEXT NOT NULL,
  rg_issuer TEXT DEFAULT 'SSP/SP',
  cpf TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT DEFAULT 'Hortolândia',
  state TEXT DEFAULT 'São Paulo',
  cep TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.landlords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage landlords" ON public.landlords
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Units table
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  identifier TEXT NOT NULL UNIQUE,
  address_number TEXT NOT NULL,
  area_sqm NUMERIC(10,2) NOT NULL,
  floor TEXT,
  description TEXT,
  status unit_status NOT NULL DEFAULT 'available',
  electricity_connection TEXT,
  water_connection TEXT,
  monthly_rent NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage units" ON public.units
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tenants (locatários) table
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  nationality TEXT DEFAULT 'brasileiro(a)',
  rg TEXT,
  rg_issuer TEXT,
  cpf TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  cep TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage tenants" ON public.tenants
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Contracts table
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id) NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
  landlord_id UUID REFERENCES public.landlords(id) NOT NULL,
  second_landlord_id UUID REFERENCES public.landlords(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration_months INTEGER NOT NULL DEFAULT 36,
  monthly_rent NUMERIC(10,2) NOT NULL,
  payment_day INTEGER NOT NULL DEFAULT 20,
  deposit_amount NUMERIC(10,2),
  late_fee_percent NUMERIC(5,2) DEFAULT 0.33,
  late_fee_max_percent NUMERIC(5,2) DEFAULT 20.00,
  adjustment_index TEXT DEFAULT 'IGPM',
  rescission_penalty_months INTEGER DEFAULT 3,
  cleaning_fee NUMERIC(10,2) DEFAULT 500.00,
  status contract_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage contracts" ON public.contracts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tenant documents submission
CREATE TABLE public.tenant_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  status document_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE public.tenant_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage documents" ON public.tenant_documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Payments tracking
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  is_paid BOOLEAN DEFAULT false,
  late_fee NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage payments" ON public.payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Utility readings (water/electricity)
CREATE TABLE public.utility_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_type TEXT NOT NULL CHECK (connection_type IN ('electricity', 'water')),
  connection_identifier TEXT NOT NULL,
  reading_date DATE NOT NULL,
  reading_value NUMERIC(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.utility_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage utility readings" ON public.utility_readings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Notifications/Alerts
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  type TEXT DEFAULT 'info',
  related_entity_type TEXT,
  related_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can create notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_landlords_updated_at BEFORE UPDATE ON public.landlords FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial data: Landlords
INSERT INTO public.landlords (full_name, rg, rg_issuer, cpf, address, city, state, cep, marital_status)
VALUES 
  ('Luiz Antônio de Morais', '10.879.995', 'SSP/SP', '980.765.238-34', 'Rua Orlando Signorelli, nº 425 – Conj. Jardim Botânico, Jardim Adelaide', 'Hortolândia', 'São Paulo', '13.185-340', 'casado'),
  ('Ilma Barbosa do Carmo Morais', '17731022-4', 'SSP/SP', '052.404.088-58', 'Rua Orlando Signorelli, nº 425 – Conj. Jardim Botânico, Jardim Adelaide', 'Hortolândia', 'São Paulo', '13.185-340', 'casada');

-- Insert initial data: Units
INSERT INTO public.units (name, identifier, address_number, area_sqm, floor, description, electricity_connection, water_connection, status) VALUES
  ('Sala 1', 'sala-1', '422A', 44.00, 'Superior', 'Sala comercial no andar superior', '422A', '422A', 'available'),
  ('Sala 2', 'sala-2', '422A', 37.00, 'Superior', 'Sala comercial no andar superior', '422A', '422A', 'available'),
  ('Sala 3', 'sala-3', '422A', 42.00, 'Superior', 'Sala comercial no andar superior', '422A', '422A', 'available'),
  ('Sala 4', 'sala-4', '422A', 37.00, 'Superior', 'Sala comercial no andar superior', '422A', '422A', 'available'),
  ('Sala Fundo', 'sala-fundo', '422B', 78.00, 'Térreo', 'Sala comercial no fundo do terreno', '422B', '422B', 'available'),
  ('Salão', 'salao', '422', 78.00, 'Térreo', 'Salão comercial abaixo das salas do andar superior', '422', '422', 'available');

-- Storage bucket for tenant documents
INSERT INTO storage.buckets (id, name, public) VALUES ('tenant-documents', 'tenant-documents', false);

CREATE POLICY "Authenticated users can upload documents" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tenant-documents');

CREATE POLICY "Authenticated users can view documents" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'tenant-documents');
