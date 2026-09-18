CREATE INDEX IF NOT EXISTS mp_rooms_winner_finished_idx
ON public.mp_rooms (winner_wallet, game_slug)
WHERE status = 'finished' AND winner_wallet IS NOT NULL;

CREATE INDEX IF NOT EXISTS soccer_matches_winner_finished_idx
ON public.soccer_matches (winner_wallet)
WHERE status = 'finished' AND winner_wallet IS NOT NULL;