# Kantor Pos Nimiq Village

## Yang akan dibuat
- **Kantor Pos di desa**: bangunan kecil "shed" (kiri desa) dijadikan Kantor Pos, dengan papan nama dan ikon amplop di atasnya. Posisi, gambar, dan tabrakan bangunan lain tidak diubah.
- **Menulis surat**: saat pemain mendekat, muncul tombol "Post Office". Isinya: alamat penerima (Nimiq atau EVM), pesan (maks 280 karakter), dan lampiran opsional NIM atau USDT (Polygon).
- **Pengiriman token**: NIM dikirim langsung dari dompet Nimiq ke penerima; USDT dikirim lewat dompet EVM di Polygon. Surat baru tercatat setelah pembayaran terverifikasi di jaringan.
- **Link + Inbox**:
  - Setelah terkirim, pengirim melihat kartu resi dengan tombol Share / Copy Link (`/village?letter=<id>`).
  - Penerima yang membuka link langsung masuk Village, muncul di depan Kantor Pos, dan pop-up surat tampil.
  - Tanpa link pun, saat penerima login ke Village, ada tanda merpati/badge angka di atas Kantor Pos; mendekat membuka inbox.
- **Pop-up surat aestetik**: kertas perkamen, segel lilin emas yang diketuk untuk "membuka", pesan muncul pelan, dan lampiran token tampil dengan kilau koin plus link ke transaksi.
- Hanya pemilik alamat penerima (sesudah login) yang bisa membaca isi surat; orang lain yang membuka link hanya melihat "This letter is for someone else".

## Batasan
- Tidak ada perubahan pada tampilan, kamera, NPC, atau collision Village yang lain.
- Surat tanpa token gratis, maksimal 10 surat per hari per dompet (anti-spam), pesan melewati filter kata kasar yang sudah ada.

## Detail teknis
- Migrasi: tabel `village_letters` (id, from_wallet, to_address, to_chain nim|evm, message, token none|nim|usdt, amount, tx_hash unik, created_at, opened_at). RLS aktif, hanya `service_role` (akses via server, seperti tabel lain).
- `src/lib/letters.server.ts` + `src/lib/letters.functions.ts`: `sendLetter` (requireWallet, moderasi, limit harian, verifikasi tx NIM lewat RPC seperti pembelian key; USDT lewat `eth_getTransactionReceipt` Polygon + decode event Transfer ke penerima dengan jumlah benar), `listInbox`, `getLetter(id)` (cek penerima), `markOpened`.
- `src/lib/wallet.ts`: tambah `sendUsdtPolygon(to, amount)` (ERC-20 transfer via viem encode, 6 desimal). NIM pakai `payNim` yang ada.
- `src/lib/village.ts`: tandai spot `shed` sebagai `postOffice` (koordinat tetap).
- `src/components/VillageCanvas.tsx`: gambar ikon amplop/badge di atas Kantor Pos, deteksi jarak untuk tombol, lompat posisi pemain ke depan pintu saat `?letter=` ada.
- Komponen baru: `PostOfficeDialog.tsx` (tab Write / Inbox), `LetterPopup.tsx` (perkamen + segel animasi), memakai token warna yang ada.
- `src/routes/village.tsx`: baca search param `letter`, validasi, buka popup setelah login.
