# Rapikan kredensial sebelum repo dibuka publik

## Apa yang ditemukan sekarang

- File `.env` ikut terkirim ke GitHub (tidak ada di daftar abaikan). Isinya alamat backend, ID proyek, dan kunci publik aplikasi.
- Tidak ditemukan kunci rahasia (API key AI, service key, kata sandi sesi, private key dompet) di dalam kode maupun catatan rencana. Kunci rahasia disimpan di penyimpanan rahasia Lovable, bukan di repo.
- Catatan rencana lama di folder `.lovable/plan/` ikut publik. Isinya hanya catatan pengerjaan, tapi menyebut nama layanan dan rencana internal.

Artinya: yang benar-benar perlu dibereskan adalah `.env` yang ikut terunggah, bukan kebocoran kunci rahasia.

## Yang akan dikerjakan

1. **Berhenti mengunggah `.env`**
   - Tambahkan `.env` (dan variannya seperti `.env.local`) ke daftar file yang diabaikan Git.
   - Keluarkan `.env` dari daftar file yang dilacak repo, tanpa menghapus file lokalnya supaya aplikasi tetap jalan.
   - `.env.example` tetap ada sebagai contoh isian, berisi nilai contoh saja.

2. **Lengkapi contoh isian**
   - Pastikan `.env.example` mencantumkan semua nama pengaturan yang dibutuhkan orang lain untuk menjalankan salinan mereka sendiri, termasuk kunci sesi, tanpa nilai asli.

3. **Tulis petunjuk aman di README**
   - Bagian singkat: salin `.env.example` ke `.env`, isi dengan backend milik sendiri, jangan pernah commit `.env`.

4. **Sembunyikan catatan kerja internal (opsional, minta konfirmasi)**
   - Folder `.lovable/` bisa diabaikan dari repo agar catatan rencana tidak ikut publik.

## Catatan penting soal kunci yang sudah terlanjur terunggah

Menghapus `.env` dari commit berikutnya tidak menghapusnya dari riwayat lama di GitHub. Jadi setelah langkah di atas:

- Ganti kunci sesi (`SESSION_SECRET`) dengan nilai baru di pengaturan rahasia; ini akan membuat sesi login lama berakhir dan semua pemain perlu masuk ulang.
- Kunci publik aplikasi dan alamat backend memang dirancang untuk terlihat dari sisi pengunjung, jadi tidak perlu diganti; keamanannya bergantung pada aturan akses database yang sudah dikunci di pembaruan sebelumnya.
- Kalau ingin riwayat benar-benar bersih, cara paling sederhana: buat repo publik baru dan unggah kode versi sekarang, lalu hapus repo lama.

## Rincian teknis

- `.gitignore`: tambah `.env`, `.env.*`, kecualikan `!.env.example`.
- `git rm --cached .env` agar berhenti dilacak tanpa menghapus file.
- `.env.example`: tambahkan `SESSION_SECRET=""` beserta komentar singkat.
- Tidak ada perubahan pada kode aplikasi, tampilan, atau database.
