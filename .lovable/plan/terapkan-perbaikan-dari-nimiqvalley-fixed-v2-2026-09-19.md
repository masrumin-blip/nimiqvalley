# Terapkan perbaikan dari nimiqvalley-fixed-v2

Isi zip adalah salinan proyek ini yang sudah diperbaiki di luar, tetapi dibuat dari versi **sebelum** dua perubahan terakhir (papan peringkat lokal Tappy dihapus, teks "room" di Daily Reward dihapus) dan seluruh filenya sudah diformat ulang.

Karena itu: **tidak** menimpa proyek dengan isi zip. Hanya perbaikan yang benar-benar berisi perubahan perilaku yang diambil; sisanya (±100 file yang berbeda hanya karena format/baris) dibiarkan.

## Perbaikan yang diambil

1. **Token sesi perangkat disimpan teracak**
   Token login perangkat kini hanya disimpan dalam bentuk hash, sehingga bocornya tabel tidak bisa dipakai masuk. Semua pemain perlu login ulang sekali.

2. **Kredit dan pembayaran jadi satu langkah utuh**
   Pemakaian pesan AI, kunci, dan penukaran pembayaran NIM dijalankan sebagai satu operasi di database. Pembayaran tidak bisa lagi tercatat "sudah dipakai" tanpa kredit masuk, dan klik ganda tidak memotong kredit dua kali.

3. **Batas nilai papan peringkat**
   Setiap game punya batas skor minimum dan maksimum yang wajar; kiriman skor di luar batas ditolak, jadi angka palsu tidak merusak papan.

4. **Batas ukuran percakapan AI**
   Permintaan chat divalidasi dan hanya membawa 20 pesan terakhir (maks ±24 ribu karakter), supaya kiriman raksasa tidak membebani.

## Yang tidak diubah

- Tampilan dan logika 15 game, Village, Arena Chat, dan menu utama.
- Penghapusan papan peringkat lokal Tappy dan teks "room" di Daily Reward tetap seperti sekarang.
- Format/penulisan ulang kode dari zip tidak diikuti.

## Catatan teknis

- Migrasi baru: `0015_atomic_credit_operations.sql`, `0016_atomic_payment_redeem.sql`, `0017_hash_player_session_tokens.sql` (fungsi `spend_chat_credit`, `spend_match_key`, `redeem_nim_payment` — `SECURITY DEFINER`, execute hanya untuk `service_role`; `player_sessions.token` → `token_hash` dan baris lama dihapus).
- File kode yang disesuaikan: `src/lib/session.server.ts` (hashToken SHA-256), `src/lib/credits.server.ts` (pakai RPC), `src/lib/leaderboard.ts` + `src/lib/leaderboard.functions.ts` (minValue/maxValue), `src/routes/api/chat.ts` (skema Zod + trimMessages).
- Setelah itu: regenerasi tipe backend dan jalankan typecheck.
