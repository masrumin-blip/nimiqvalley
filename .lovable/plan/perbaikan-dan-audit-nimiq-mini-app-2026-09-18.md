# Perbaikan dan audit Nimiq Mini App

## Tujuan
Membuat NimiqValley benar-benar kompatibel dengan Nimiq Pay, memperbaiki login yang gagal pada screenshot, dan menutup masalah keamanan yang ditemukan saat audit tanpa mengubah tampilan aplikasi.

## Yang akan dikerjakan

1. **Perbaiki login Nimiq Pay**
   - Ganti pemanggilan yang salah dari `signMessage()` menjadi API resmi `sign()`.
   - Gunakan tipe asli dari Nimiq Mini App SDK agar kesalahan nama/metode terdeteksi otomatis.
   - Tangani hasil gagal atau pembatalan dari Nimiq Pay dengan pesan yang jelas, bukan pesan umum yang menyesatkan.
   - Gunakan satu koneksi provider yang stabil selama sesi, tanpa meminta koneksi wallet berulang kali.

2. **Amankan bukti kepemilikan wallet**
   - Buat login challenge acak dari server dengan batas waktu singkat dan hanya dapat dipakai sekali.
   - Kirim signature dan public key dari Nimiq Pay maupun Nimiq browser wallet.
   - Verifikasi signature, isi challenge, public key, dan kecocokan alamat di server sebelum membuat sesi login.
   - Tolak signature palsu, challenge kedaluwarsa, dan replay login.

3. **Benahi transaksi NIM**
   - Sesuaikan pembacaan hasil transaksi dengan format resmi SDK (`string` atau error provider).
   - Tampilkan alasan pembatalan, saldo kurang, dan gangguan jaringan dengan benar.
   - Jangan memberikan chat credit, room credit, atau match key bila transaksi tidak ditemukan atau belum valid.
   - Verifikasi pengirim, penerima, jumlah, keunikan hash, dan status transaksi sebelum kredit diberikan.

4. **Benahi integrasi Polygon/USDT**
   - Jangan menjalankan `eth_requestAccounts` otomatis saat halaman Village dibuka.
   - Baca akun yang sudah diizinkan secara diam-diam; jika belum ada, tampilkan aksi koneksi yang harus ditekan pengguna.
   - Pastikan chain benar-benar Polygon (`0x89`) sebelum membaca USDT.
   - Tangani penolakan pergantian jaringan dan error `4902` dengan pesan yang jelas.
   - Pertahankan kontrak USDT Polygon dan 6 desimal yang saat ini sudah benar.

5. **Audit penggunaan di ponsel**
   - Naikkan area sentuh kontrol penting menjadi minimum 44×44 px tanpa mengubah gaya visual utama.
   - Periksa seluruh halaman pada lebar 375 px untuk teks terpotong, elemen keluar layar, dan scroll horizontal.
   - Pastikan semua dialog wallet hanya muncul setelah tindakan pengguna, tidak bertumpuk, dan app tetap dapat dipakai setelah dibatalkan.

6. **Validasi akhir berdasarkan checklist Mini Apps**
   - Uji login Nimiq Pay dan Nimiq browser wallet.
   - Uji pembatalan login, pembatalan pembayaran, pembayaran gagal, pembayaran sukses, dan pembacaan USDT.
   - Uji halaman utama, Village, Game Hub, AI Chat, Arena Chat, leaderboard, serta setiap game pada viewport ponsel.
   - Periksa kembali tidak ada private key, seed phrase, atau API key di kode.
   - Cek error pemuatan modul yang tercatat di preview dan pastikan halaman dapat dimuat ulang dengan aman.
   - Laporkan hasil akhir per item sebagai `PASS`, `FAIL`, atau `SKIP`; pengujian terakhir di aplikasi Nimiq Pay pada perangkat asli tetap dilakukan setelah versi perbaikan dipublish.

## Temuan audit saat ini

- **FAIL:** Login Nimiq Pay selalu gagal karena app mencari metode `signMessage`, sedangkan SDK menyediakan `sign`.
- **FAIL kritis:** Server menerima signature sebagai teks tetapi belum memverifikasi bahwa wallet benar-benar menandatanganinya.
- **FAIL kritis:** Kredit saat ini masih dapat diberikan ketika pencarian transaksi gagal; transaksi wajib terbukti valid terlebih dahulu.
- **FAIL:** Village memanggil permintaan akun EVM otomatis saat halaman dibuka, padahal dialog persetujuan harus berasal dari tindakan pengguna.
- **FAIL:** Sebagian tombol hanya 32–36 px, di bawah target sentuh minimum 44 px.
- **PASS:** SDK Mini App sudah terpasang dan provider Nimiq diakses melalui `init()`.
- **PASS:** Ethereum provider diakses melalui `window.ethereum`.
- **PASS:** Alamat kontrak USDT Polygon, chain ID `0x89`, ABI encoding, dan 6 desimal sudah benar.
- **PASS:** Tidak ditemukan private key, seed phrase, atau API key tertanam di source code.
- **PASS:** Tidak ada upaya mengambil private key atau melewati dialog persetujuan native.

## Batas perubahan

- Tidak mengubah desain, susunan menu, game, ekonomi, atau isi aplikasi.
- Fokus hanya pada kompatibilitas Nimiq Pay, keamanan login/pembayaran, error handling, dan kelayakan layar ponsel.
