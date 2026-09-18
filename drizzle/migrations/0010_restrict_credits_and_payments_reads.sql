DROP POLICY IF EXISTS "wallet credits are publicly readable" ON public.wallet_credits;
DROP POLICY IF EXISTS "nim payments are publicly readable" ON public.nim_payments;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.wallet_credits FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.nim_payments FROM anon, authenticated;

GRANT ALL ON public.wallet_credits TO service_role;
GRANT ALL ON public.nim_payments TO service_role;