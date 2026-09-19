-- These tables are only ever read/written by trusted server code using the
-- service role. Remove public/anon/authenticated read access entirely.

DROP POLICY IF EXISTS "chat friends are publicly readable" ON public.chat_friends;
DROP POLICY IF EXISTS "chat profiles are publicly readable" ON public.chat_profiles;
DROP POLICY IF EXISTS "daily claims are publicly readable" ON public.daily_claims;

REVOKE ALL ON public.chat_friends FROM anon, authenticated;
REVOKE ALL ON public.chat_profiles FROM anon, authenticated;
REVOKE ALL ON public.daily_claims FROM anon, authenticated;

GRANT ALL ON public.chat_friends TO service_role;
GRANT ALL ON public.chat_profiles TO service_role;
GRANT ALL ON public.daily_claims TO service_role;

ALTER TABLE public.chat_friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_claims ENABLE ROW LEVEL SECURITY;

-- The moderation routine is a SECURITY DEFINER function invoked only by server
-- code through the service role; nobody else should be able to call it.
REVOKE ALL ON FUNCTION public.moderate_chat_submission(text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_chat_submission(text, text, boolean) TO service_role;
