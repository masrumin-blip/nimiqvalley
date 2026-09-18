# Leaderboard, login dompet, dan tata letak Game Hub

## 1. Login dengan dompet Nimiq

- Tombol "Connect" di Game Hub memakai dompet Nimiq Pay (alamat Nimiq jadi identitas pemain).
- Untuk membuktikan alamat itu benar milik pemain, dompet diminta menandatangani satu pesan singkat; tanda tangan diperiksa di sisi server sebelum skor disimpan.
- Sesi disimpan di perangkat, jadi pemain tidak perlu menyambung ulang tiap kali main.
- Pemain bisa mengisi nama tampilan (maks 16 karakter). Kalau kosong, dipakai alamat yang dipersingkat.
- Tanpa login pemain tidak bisa main 

## 2. Papan peringkat

Aktifkan Lovable Cloud untuk menyimpan skor (database + fungsi server).

Game yang punya papan peringkat (11): Jump, Car Race, Hexaman, Mininja, Rooftop, Slide, Soccer, Tappy, CosNimiq Shooter, Spaceship, Crossing.
Tidak punya: Checkers, Bomber, Pet, Carronimiq.

Metrik per game (skor tertinggi disimpan, kecuali balapan):

- Jump, Hexaman, Mininja, Slide, Tappy, Shooter, Spaceship: skor akhir.
- Rooftop: koin terkumpul. Crossing: koin terkumpul.
- Soccer: jumlah kemenangan lawan CPU (akumulasi).
- Car Race: waktu lap terbaik (makin kecil makin baik).

Alur: saat satu ronde selesai, game mengirim hasilnya; server hanya menyimpan bila lebih baik dari rekor pemain sebelumnya di game itu.

Halaman `/leaderboard`:

- Daftar pilihan game di atas, tabel 50 besar di bawah (peringkat, nama, skor).
- Baris pemain sendiri disorot, dan posisinya ditampilkan meski di luar 50 besar.
- Tombol kembali ke Game Hub.

## 3. Tampilan Game Hub

- Daftar game jadi 2 kolom di semua ukuran layar (2 game per baris ke bawah), jarak dan tinggi kartu dirapikan agar pas di ponsel.
- Di atas daftar game: satu baris tombol berisi tombol Leaderboard untuk menuju ke halaman khusus leaderboard ,dan status login (Connect / nama pemain).

## Catatan teknis

- Tabel `profiles` (wallet address sebagai kunci, display_name) dan `scores` (wallet, game_slug, value, updated_at) dengan unique (wallet, game_slug); RLS baca publik, tulis hanya lewat fungsi server terverifikasi + GRANT eksplisit.
- Autentikasi memakai Mini App SDK (`init()` → `listAccounts`, `signMessage`); verifikasi tanda tangan di server function, lalu terbitkan sesi bertanda tangan (HMAC) di cookie httpOnly. Tidak memakai email/password.
- Hook bersama `useSubmitScore(slug)` dipanggil di titik "game over" masing-masing game; hanya menambah satu panggilan, tanpa mengubah mekanik.
- Shooter berjalan sebagai halaman statis di `public/games/shooter/index.html`: skor dikirim ke aplikasi lewat `postMessage` saat game over, lalu diteruskan ke server.
- Rute baru `src/routes/leaderboard.tsx` dengan metadata head sendiri.