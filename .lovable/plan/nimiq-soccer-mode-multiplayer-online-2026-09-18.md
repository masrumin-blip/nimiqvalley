# Nimiq Soccer: mode multiplayer online

Menambahkan mode lawan pemain sungguhan di Nimiq Soccer, tanpa mengubah mode lawan CPU yang sudah ada.

## Cara main

Di menu Nimiq Soccer muncul dua pilihan: **Lawan CPU** (seperti sekarang) dan **Online**.

Di dalam menu Online ada tiga cara bertemu lawan:

- **Cari lawan cepat** — masuk antrean, langsung dipasangkan dengan pemain lain yang sedang menunggu.
- **Kode ruangan** — buat kode 5 huruf lalu bagikan; teman memasukkan kode itu untuk bergabung.
- **Tantang teman** — pilih dari daftar teman Arena Chat, teman menerima tantangan di halaman Online miliknya.

Login dompet tetap wajib (sama seperti sekarang), dan nama yang tampil memakai nama pemain yang sudah dipakai di leaderboard.

## Jalannya pertandingan

- Bergiliran menembak seperti mode CPU: satu pemain membidik, hasil tembakannya dikirim, lawan melihat gerakan yang sama persis.
- Papan skor menampilkan nama kedua pemain; target gol sama dengan mode CPU (pilihan pembuat ruangan).
- Ada penghitung waktu 10 detik pada giliran. Kalau pemain yang mendapat giliran tidak bergerak sampai waktu habis, gilirannya dilewati dan lawan langsung mendapat giliran.
- Kalau seorang pemain keluar, lawan diberi tahu dan pertandingan ditutup.
- Kemenangan online ikut dihitung ke leaderboard Soccer, sama seperti kemenangan lawan CPU.

## Yang tidak berubah

Mekanik tembakan, fisika, tampilan lapangan, mode CPU, game lain, Arena Chat, dan leaderboard tetap seperti sekarang.

## Catatan teknis

- Tabel baru: `soccer_matches` (id, kode ruangan, wallet tuan rumah, wallet tamu, status `waiting`/`playing`/`finished`, target gol, skor, giliran, nomor giliran, `turn_started_at`, pemenang, `created_at`/`updated_at`) dan `soccer_moves` (match_id, nomor giliran, wallet, indeks bidak, vektor tarikan, `created_at`, unik per (match_id, turn_no)). Tantangan teman disimpan sebagai baris `soccer_matches` berstatus `invited` dengan wallet tamu terisi. RLS: baca publik untuk baris pertandingan sendiri, semua tulis lewat fungsi server (service role) + GRANT eksplisit.
- Fungsi server baru `src/lib/soccer.functions.ts` (identitas dari `currentWallet()` seperti `chat.functions.ts`, validasi Zod): `quickMatch`, `createRoom`, `joinRoom`, `challengeFriend`, `respondChallenge`, `getMatch` (state + langkah sejak nomor giliran tertentu), `submitMove`, `skipTurn` (server memvalidasi 10 detik lewat `turn_started_at`), `leaveMatch`. Data akses di `src/lib/soccer/cloud.server.ts` memakai `supabaseAdmin`.
- Sinkronisasi memakai polling TanStack Query ~1 detik (pola sama dengan Arena Chat `POLL_INTERVAL_MS`), bukan websocket.
- Determinisme: hanya vektor tarikan (indeks bidak + dx/dy) yang dikirim; simulasi fisika dijalankan ulang identik di kedua sisi dari langkah bernomor, sehingga posisi tidak pernah berbeda.
- `SoccerGame.tsx` dirapikan agar menerima adaptor giliran: sumber giliran lokal (CPU) atau jarak jauh (online), tanpa mengubah fungsi fisika yang ada.
- Daftar teman diambil dari fungsi `listFriends` yang sudah ada di `src/lib/chat/cloud.server.ts`.
