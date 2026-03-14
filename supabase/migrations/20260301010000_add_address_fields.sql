ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address_number text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS neighborhood text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS complement text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS marital_status text;
ALTER TABLE public.landlords ADD COLUMN IF NOT EXISTS address_number text;
ALTER TABLE public.landlords ADD COLUMN IF NOT EXISTS neighborhood text;
ALTER TABLE public.landlords ADD COLUMN IF NOT EXISTS complement text;
