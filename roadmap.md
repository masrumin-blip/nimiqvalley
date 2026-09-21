# Roadmap

- [x] Remove multiplayer controls from Nimiq Car Race.
- [x] Finish preview checks for the merged NimiqValley app.
- [x] Make Hexaman maze more connected and less dead-end heavy.
- [x] Fix Nimiq Pet mobile layout shown in screenshots.
- [x] Reduce Nimiq Slide item and countdown popup size.
- [x] Replace game top return bar with a single exit button to Game Hub.
- [x] Wallet login + leaderboard for 11 games.
- [x] Real AI chat through Lovable AI with character personas.
- [x] Arena Chat (global, DM, friends, profile).
- [x] Nimiq Soccer online multiplayer (quick match, room code, friend challenge, 10s turn timer).
- [x] Online multiplayer for Checkers, Carrom, and Hexaman (no player-vs-player collision; last runner standing ends the Hexaman round with a stats popup).
- [x] Automatic game achievement badges on Arena Chat profiles.
- [x] Preload all games at boot, wallet login gate (Nimiq Pay + browser wallet), English-only UI.
- [x] NIM payments: chat packs, 25 NIM room passes, daily X-visit reward.
- [x] Shared matchmaking queue with widening skill window and 60s CPU suggestion.
- [x] Nimiq Pay compatibility and mini-app security audit remediation.
- [x] Align Nimiq Village house and tree collisions with their visible footprints; make the in-game chat close icon green.

## Catatan setelah penggantian penuh dari zip (20 Sep 2026)
- Kode aplikasi disamakan dengan zip: Hexaman kembali solo; mode demo, chat in-game, halaman privacy/terms, dan gerak halus rival Bomber dihapus.
- Ditambahkan: 15 kunci pertandingan gratis per hari (`free_keys_date` di wallet_credits, migrasi 0015_daily_free_keys.sql).
- Database masih memuat perubahan dari migrasi lama 0015-0017 (kredit atomik, redeem pembayaran atomik, token sesi di-hash) yang filenya tidak ada di zip. `src/lib/session.server.ts` dipertahankan memakai `token_hash` agar cocok dengan tabel `player_sessions`.
- Kode kredit versi zip tidak memakai rutin database `spend_*`, jadi tidak ada bentrok di sana.
