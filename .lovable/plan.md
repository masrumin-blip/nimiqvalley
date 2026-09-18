# Plan: Gabungkan NimiqValley, Game Hub, dan AI Chat

## Tujuan
Menyusun tiga arsip yang diunggah menjadi satu aplikasi terpadu dengan halaman awal berupa menu utama.

## Susunan aplikasi
- Jadikan **NimiqValley** sebagai fondasi utama karena arsip ini berisi Village dan 15 halaman game.
- Tambahkan **AI Chat karakter** dari `nimiq-valley-aichat-v2.zip` sebagai area baru di aplikasi.
- Gunakan `arena-chat.zip` sebagai referensi untuk struktur chat/server chat bila dibutuhkan, tanpa menimpa tampilan karakter dari AI Chat v2.
- Ganti halaman kosong proyek saat ini dengan menu utama berisi pilihan:
  - Nimiq Village
  - Game Hub
  - AI Chat

## Rute yang akan tersedia
```text
/                 -> Menu utama
/village          -> Nimiq Village
/games            -> Game Hub
/games/...        -> Masing-masing game
/chat             -> Daftar karakter AI Chat
/chat/$characterId -> Chat per karakter
```

## Langkah kerja
1. Ekstrak arsip ke area sementara dan periksa agar tidak ada metadata Git yang ikut tersalin.
2. Pindahkan kode NimiqValley yang relevan ke proyek: halaman, komponen, game, asset, dan file publik game.
3. Tambahkan halaman chat karakter dari AI Chat v2, termasuk data karakter dan gambar karakter.
4. Satukan navigasi agar pengguna bisa berpindah antara Village, Game Hub, dan AI Chat dari menu utama.
5. Rapikan metadata halaman agar judul dan deskripsi aplikasi tidak lagi memakai placeholder.
6. Sesuaikan dependensi yang dibutuhkan oleh gabungan aplikasi.
7. Verifikasi tampilan utama di mobile dan desktop, serta pastikan tautan utama membuka halaman yang benar.

## Catatan teknis
- File binary seperti gambar game dan karakter akan dibawa sebagai asset aplikasi sesuai kebutuhan.
- Jika fitur AI Chat membutuhkan jawaban AI sungguhan atau penyimpanan riwayat chat, itu perlu Lovable Cloud. Jika belum diaktifkan, chat akan disusun memakai kemampuan yang tersedia dari arsip terlebih dahulu.
- Struktur routing tetap memakai TanStack Router sesuai proyek ini.
