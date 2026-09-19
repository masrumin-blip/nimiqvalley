# Perbaiki "Sign in with your wallet first" di AI Chat

Kamu sudah login dan kredit chat masih tersisa (6 left), tapi setiap pesan ke karakter ditolak dengan pesan "Sign in with your wallet first".

## Penyebab

Login di Nimiq Pay tidak memakai cookie (WebView-nya memblokir cookie), melainkan token yang disimpan di perangkat. Token itu ikut terkirim otomatis pada hampir semua permintaan ke server, **kecuali** permintaan khusus AI Chat — jalur itu dibuat terpisah dan tidak membawa tanda pengenal login. Akibatnya server menganggap pengirim pesan belum masuk, lalu menolaknya.

## Perbaikan

1. Sertakan tanda pengenal login pada setiap pesan yang dikirim ke ruang cerita, sama seperti bagian aplikasi lain.
2. Karena tanda pengenal bisa berubah saat login/logout, ambil nilainya saat pesan dikirim (bukan sekali di awal), supaya tidak basi.
3. Jika server benar-benar menolak karena belum login, tampilkan pesan yang jelas plus arahan untuk masuk kembali, bukan teks merah tanpa jalan keluar.

## Catatan teknis

- `src/routes/chat.$characterId.tsx`: `DefaultChatTransport` dibuat dengan `headers: () => ({ [PLAYER_TOKEN_HEADER]: readPlayerToken() ?? "" })` (fungsi, agar dievaluasi per request) dari `@/lib/player-token`; `body` tetap `{ characterId }`.
- `src/routes/api/chat.ts` tetap memakai `currentWallet()`; tidak ada perubahan logika kredit. Header `x-player-token` sudah dibaca `requestToken()` di `src/lib/session.server.ts` lewat `getRequestHeader`, jadi tidak perlu perubahan server.
- Penanganan error 401 di `onError` chat diberi pesan khusus ("Your session expired — sign in again").

## Pemeriksaan

Kirim satu pesan ke Nimi Queen setelah login dan pastikan balasan mengalir serta hitungan chat berkurang.
