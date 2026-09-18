# Perbaiki Login Nimiq Pay

## Temuan terverifikasi
Log aplikasi terbit terbaru menunjukkan kegagalan pada tahap `initializing crypto` dengan `TypeError: Invalid URL string`. Jadi signature dari Nimiq Pay belum sempat didekode atau diverifikasi. Penyebab aktifnya adalah pemuatan `@nimiq/core/web` di lingkungan server aplikasi, bukan dua pilihan tombol login dan belum membuktikan adanya kesalahan encoding dari SDK.

## Perubahan
1. Hapus ketergantungan mesin WebAssembly `@nimiq/core/web` dari alur login server.
2. Verifikasi Ed25519 memakai implementasi JavaScript murni yang sudah tersedia, termasuk kandidat payload resmi Nimiq dan fallback yang saat ini didukung.
3. Turunkan alamat Nimiq dari public key dengan Blake2b dan cocokkan hasilnya dengan alamat yang diberikan wallet, juga tanpa WebAssembly.
4. Pertahankan nonce sekali pakai, masa berlaku lima menit, anti-replay, cookie sesi, dan pesan login yang ada.
5. Jangan mencatat public key, signature mentah, atau data sensitif lain; log hanya tahap dan hasil verifikasi.

## Validasi
- Buat pengujian deterministik menggunakan key/signature Nimiq yang valid dan kasus signature atau alamat yang salah.
- Pastikan pemeriksaan tipe dan build produksi lolos.
- Uji tampilan login pada ukuran layar Nimiq Pay; pengujian persetujuan wallet asli tetap dilakukan setelah versi terbaru dipublikasikan.

## Batasan
Hanya alur login wallet yang diubah. Tombol Nimiq Pay dan browser wallet tetap tersedia; fitur pembayaran dan bagian aplikasi lain tidak diubah.
