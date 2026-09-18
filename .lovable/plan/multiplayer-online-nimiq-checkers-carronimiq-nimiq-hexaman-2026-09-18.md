# Multiplayer Online: Nimiq Checkers, Carronimiq, Nimiq Hexaman

Menambah mode Online ke tiga game, memakai pola yang sudah terbukti di Nimiq Soccer:
quick match, kode ruangan, dan tantangan teman dari Arena Chat. Login dompet tetap wajib.

## Cara bermain

**Nimiq Checkers (2 pemain)**
- Menu punya dua tab: VS CPU dan Online.
- Giliran bergantian; papan lawan diputar agar bidaknya menghadap pemain.
- Timer giliran 30 detik; kalau habis, langkah terbaik otomatis dijalankan.
- Selesai saat satu pemain tidak punya bidak/langkah, atau lawan keluar.

**Carronimiq (2 pemain)**
- Menu punya tab VS CPU dan Online.
- Bergantian menembak striker; hanya arah + kekuatan yang dikirim, kedua layar memutar fisika yang sama.
- Timer giliran 20 detik, lewat = giliran dilewati.
- Selesai saat semua biji satu warna masuk lubang, atau lawan keluar.

**Nimiq Hexaman (2-4 pemain, kode ruangan)**
- Host membuat ruangan, sampai 3 teman masuk dengan kode; host menekan Start.
- Semua pemain di labirin yang sama, pellet dibagi bersama (siapa cepat dia dapat).
- Ronde berdurasi 3 menit: skor terbanyak saat waktu habis menang.
- Kalau nyawa pemain habis, ia keluar dari ronde. Kalau hanya tersisa 1 pemain sebelum 3 menit, ia langsung menang.
- Pemain tidak saling bertabrakan — tidak ada logika tabrakan antar-pemain di loop permainan; hantu tetap berbahaya.

## Pop up hasil

Satu dialog hasil yang sama gayanya untuk ketiga game: judul pemenang, lalu daftar
pemain diurutkan dari terbaik ke terburuk, dengan statistik per game —
Checkers: bidak tersisa, bidak dimakan, jumlah langkah;
Carrom: biji masuk, tembakan, akurasi;
Hexaman: skor, pellet, waktu bertahan, status (selamat/tumbang).
Tombol: Main lagi (ruangan baru) dan Kembali ke Game Hub.

Kemenangan online masuk leaderboard game masing-masing (Checkers dan Carrom
masih di luar daftar leaderboard, jadi hanya Hexaman yang mengirim skor).

## Detail teknis

Database — satu migrasi generik untuk semua game, tidak menduplikasi tabel soccer:
- `mp_rooms` (id, game_slug, code unik, kind quick|room|friend, host_wallet, status waiting|playing|finished, max_players, settings jsonb, turn_no, turn_wallet, turn_started_at, started_at, ends_at, winner_wallet, created_at, updated_at)
- `mp_room_players` (room_id, wallet, seat, status joined|invited|playing|out|left, score, stats jsonb, UNIQUE(room_id, wallet))
- `mp_moves` (room_id, turn_no, wallet, kind, payload jsonb, UNIQUE(room_id, turn_no)) untuk giliran Checkers/Carrom
- `mp_ticks` (room_id, wallet, x, y, dir, score, alive, updated_at, PK(room_id, wallet)) untuk posisi Hexaman
- RLS aktif, SELECT publik, tulis lewat service_role + GRANT sesuai aturan.

Kode baru (mengikuti pola `src/lib/soccer/*`):
- `src/lib/mp/types.ts` — RoomState, RoomPlayer, MoveRecord, PlayerTick, konstanta timer (checkers 30s, carrom 20s, hexaman ronde 180s), interval polling.
- `src/lib/mp/cloud.server.ts` — quickMatch, createRoom, joinRoom, challengeFriend, respondChallenge, startRoom, submitMove, skipTurn, pushTick, reportOut, finishRoom, fetchRoom, leaveRoom (semua per `game_slug`, pakai supabaseAdmin).
- `src/lib/mp.functions.ts` — createServerFn + Zod, identitas dari `currentWallet()`.
- `src/games/_shared/online/useOnlineRoom.ts` — hook lobby + polling ruangan (1s untuk giliran, ~250ms untuk tick Hexaman), mutation, dan helper kirim langkah.
- `src/components/MatchResultDialog.tsx` — pop up hasil dengan daftar peringkat, dipakai ketiga game.
- Panel lobby bersama (`OnlinePanel`) untuk quick match / buat ruangan / masuk kode / tantang teman / daftar tantangan.

Perubahan pada game:
- `src/games/checkers/Page.tsx` + `lib/engine.ts`: mode cpu|online, kirim langkah `{from, to, captures}`, terapkan langkah lawan lewat engine yang sama, orientasi papan per pemain.
- `src/games/carrom/components/CarromGame.tsx`: mode cpu|online, kirim `{x, vx, vy}` striker, replay fisika deterministik, kunci input saat bukan giliran.
- `src/games/hexaman/components/HexamanGame.tsx`: mode solo|online, seed labirin dari ruangan agar sama, render avatar pemain lain dari tick, pellet diklaim lewat server, timer ronde 3 menit, dan **tidak ada pengecekan tabrakan antar-pemain di loop update**.
