# Arena Chat masuk ke NimiqValley

Menambahkan area obrolan antar pemain (chat global, profil, teman, pesan pribadi) dari aplikasi yang kamu unggah ke dalam NimiqValley, tanpa mengubah AI Chat yang sudah ada.

buat ada di game hub di kolom atas

## Yang akan dibuat

Halaman baru **Arena** di alamat `/arena`, berisi 4 tab:

- **Global** — ruang obrolan bersama semua pemain, pesan baru muncul otomatis tiap 2 detik.
- **DM** — pesan pribadi satu lawan satu.
- **Teman** — kirim, terima, atau tolak permintaan teman.
- **Profil** — bio, tautan sosial (X, Instagram, Discord), pilihan profil publik/privat, dan siapa yang boleh mengirim DM.

Nama tampil di chat memakai identitas dompet yang sudah dipakai untuk leaderboard, jadi tidak ada kotak nickname terpisah. Kalau belum masuk, halaman menampilkan ajakan menghubungkan dompet seperti pada game.

## Tempat masuknya

- Kartu baru **Arena Chat** di menu utama, di samping Village, Games, dan AI Chat.
- Tombol menuju Arena di Game Hub, sebaris dengan tombol Leaderboard.
- Tombol kembali di halaman Arena menuju menu utama.

## Penyimpanan

Percakapan disimpan permanen di database proyek (bukan hanya di memori seperti versi unggahanmu), agar pesan tidak hilang saat aplikasi di-restart dan bisa dibaca semua pemain.

## Yang tidak berubah

AI Chat (`/chat`), semua game, leaderboard, dan login dompet tetap seperti sekarang.

## Detail teknis

- Tabel baru: `chat_messages`, `chat_presence`, `chat_profiles`, `chat_friends`, `chat_dms` sesuai `docs/chat_schema.sql` bawaan unggahan, plus GRANT dan RLS. Identitas diganti dari nickname bebas menjadi wallet pemain: kolom `nickname` diisi display name, dengan kolom `wallet` sebagai kunci identitas dan kebijakan RLS menulis hanya untuk `authenticated`.
- Salin ke proyek: `src/lib/chat/types.ts`, `config.ts` (`CHAT_BACKEND = "cloud"`), `adapter.server.ts`, `cloud.server.ts` (diisi query Supabase, `memory.server.ts` tidak disalin), dan `src/lib/chat.functions.ts` (server function, validasi Zod, wallet diambil dari sesi pemain di server — bukan dari input klien).
- UI dari `src/routes/index.tsx` unggahan dipindah ke `src/routes/arena.tsx`, memakai `usePlayer` + `WalletGate` proyek, token warna proyek, dan `head()` sendiri.
- Polling 2 detik memakai TanStack Query yang sudah ada; tidak ada paket baru yang perlu dipasang.
- `src/integrations/supabase/types.ts` diregenerasi setelah migrasi.
- Verifikasi: Playwright membuka `/arena`, kirim satu pesan, muat ulang halaman, pastikan pesan tetap ada dan tanpa error konsol.