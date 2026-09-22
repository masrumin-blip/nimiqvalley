CREATE TABLE public.ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  character_id text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_chat_messages_wallet_character_idx
  ON public.ai_chat_messages (wallet, character_id, created_at);

GRANT ALL ON public.ai_chat_messages TO service_role;

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
