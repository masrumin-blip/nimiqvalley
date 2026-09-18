# Badge Pencapaian di Profil Arena Chat

## Hasil yang akan dibuat

- Menambahkan bagian **Achievements** pada profil Arena Chat.
- Badge dihitung otomatis dari hasil permainan yang sudah tersimpan, sehingga pemain tidak memilih atau mengubah badge sendiri.
- Badge tampil pada profil sendiri dan profil pemain lain; pengaturan profil privat tetap menunjukan stats ini

## Aturan badge otomatis

### Peringkat tiap game

- **Valley Champion** — peringkat #1 pada suatu game.
- **Podium Player** — peringkat #2–#3 pada suatu game.
- **Top Contender** — peringkat #4–#10 pada suatu game.
- Nama game dan posisi aktual ditampilkan pada badge, misalnya `#3 Nimiq Tappy`.
- Hanya tier tertinggi pemain untuk setiap game yang ditampilkan agar tidak ada badge duplikat.

### Kemenangan online

- **First Victory** — 1 kemenangan online.
- **Battle Tested** — 10 kemenangan online.
- **Arena Veteran** — 25 kemenangan online.
- **Valley Legend** — 50 kemenangan online.
- Total kemenangan dihitung dari pertandingan selesai pada Nimiq Soccer, Checkers, Carronimiq, dan Hexaman.

### Aktivitas bermain

- **First Steps** — pernah mencatat hasil di 1 game.
- **Game Explorer** — pernah mencatat hasil di 5 game.
- **Valley Master** — pernah mencatat hasil di seluruh 11 game leaderboard.

## Tampilan profil

- Tambahkan ringkasan ringkas: jumlah badge, total kemenangan online, dan jumlah game yang pernah dimainkan.
- Tampilkan badge sebagai koleksi ikon kecil berwarna dengan nama dan detail pencapaian.
- Saat belum ada pencapaian, tampilkan keadaan kosong yang rapi tanpa mengganggu kolom bio dan sosial.
- Nama pemain pada Global Chat dan daftar teman dapat membuka profil ringkas, sehingga badge berguna dan terlihat oleh pemain lain.

## Teknis

- Buat tipe data pencapaian bersama dan fungsi server untuk menghitung badge dari tabel skor serta riwayat pertandingan yang sudah ada.
- Gunakan hasil pertandingan server sebagai sumber kemenangan online, bukan angka lokal dari perangkat pemain.
- Tambahkan indeks database pada data pemenang bila diperlukan agar penghitungan profil tetap cepat; perubahan database tetap memakai RLS dan grant yang sesuai.
- Gabungkan pencapaian ke data profil Arena tanpa menambah polling terpisah atau memperberat Global Chat.

## Pemeriksaan

- Uji profil tanpa pencapaian, profil dengan peringkat, dan profil dengan kemenangan online.
- Pastikan tier badge, nama game, hitungan kemenangan, serta aturan profil privat tampil benar.
- Periksa tampilan ponsel dan desktop serta pastikan chat, teman, DM, dan penyimpanan profil tetap bekerja.