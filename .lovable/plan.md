# Perbaiki Login Nimiq Pay

## Temuan terverifikasi
- Dokumentasi resmi Nimiq Mini Apps menetapkan akses melalui `init()`, akun melalui `listAccounts()`, dan tanda tangan melalui `sign(message | { message, isHex })`, dengan hasil `publicKey` dan `signature` berupa hex.
- Dokumentasi Mini Apps tidak menjelaskan byte/prefix/hash internal yang ditandatangani Nimiq Pay.
- Kode saat ini memanggil `nimiq.sign(message)`, lalu server mencoba enam tebakan format—termasuk format lama Nimiq Hub. Ini masih menghasilkan “wallet signature is invalid” pada Nimiq Pay asli.
- Nimiq Hub dan Nimiq Pay memakai API berbeda, tetapi saat ini keduanya diverifikasi melalui daftar tebakan yang sama.

## Perubahan
1. **Buat format login Nimiq Pay yang eksplisit**
   - Hash challenge login menjadi 32 byte dengan SHA-256.
   - Kirim hash tersebut ke Nimiq Pay menggunakan bentuk resmi `sign({ message: hex, isHex: true })`, bukan string biasa.
   - Sertakan jenis tanda tangan (`pay-hex-v1` atau `hub-v1`) dalam permintaan login agar server tidak lagi menebak format.

2. **Pisahkan verifikasi per dompet**
   - Untuk Nimiq Pay, verifikasi tepat terhadap 32 byte challenge hash yang dikirim sebagai hex.
   - Untuk browser wallet/Nimiq Hub, pertahankan formula resmi Hub: prefix Nimiq + panjang pesan + pesan, lalu SHA-256.
   - Tetap pastikan public key menghasilkan alamat yang sama dengan alamat dari `listAccounts()`.
   - Pertahankan challenge sekali pakai dan masa berlaku lima menit.

3. **Buat kegagalan dapat dibedakan tanpa membocorkan data**
   - Bedakan error untuk format respons, public key yang tidak cocok, dan signature yang gagal.
   - Catat hanya jenis dompet dan tahap kegagalan; jangan mencatat challenge, public key, signature, atau alamat lengkap.

4. **Uji dan validasi**
   - Tambahkan pengujian tetap untuk kedua format tanda tangan agar perubahan berikutnya tidak merusak login.
   - Jalankan pemeriksaan tipe dan build produksi untuk memastikan library kriptografi tidak kembali masuk ke bundle browser yang bermasalah.
   - Uji tampilan dan alur login mobile; pengujian akhir persetujuan tanda tangan tetap dilakukan di aplikasi Nimiq Pay setelah versi baru dipublikasikan.
   - Periksa juga error pemuatan modul preview yang tercatat agar hasil pengujian tidak tertukar dengan cache/build preview lama.

## Acuan
- https://nimiq.dev/mini-apps
- https://nimiq.dev/mini-apps/api-reference/nimiq-provider
- https://nimiq.github.io/api-reference/sign-message
