REVOKE ALL ON FUNCTION public.spend_match_key(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.spend_room_credit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_match_key(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.spend_room_credit(text) TO service_role;