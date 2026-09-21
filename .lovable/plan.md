# Perbaikan chat dan collision Nimiq Village

## Perubahan
- Ubah ikon **X** pada chat di dalam game dari kuning menjadi hijau, tanpa mengubah posisi atau fungsi chat.
- Samakan area collision setiap rumah dengan lebar bagian dasar gambar rumah sesuai tier-nya, sehingga pemain berhenti di dinding/bagian bawah rumah dan tidak tertahan oleh area kosong transparan.
- Tambahkan collision pada batang setiap pohon berdasarkan jenis dan skala pohonnya; kanopi tetap bisa dilewati secara visual agar gerakan tidak terasa terlalu sempit.
- Gunakan daftar pohon yang sama untuk menggambar dan membentuk collision, sehingga posisi gambar dan penghalangnya selalu cocok.
- Terapkan collision yang sama pada pemain dan NPC, sambil mempertahankan kamera, tata letak, aset, dan tampilan Nimiq Village yang sekarang.

## Pemeriksaan
- Uji berjalan mengelilingi keempat tipe rumah, beberapa ukuran pohon, bangunan, kolam, dan batas pulau.
- Pastikan pemain tidak masuk ke badan rumah/batang pohon, tetapi tetap bisa lewat dekat sisi gambar secara wajar.
- Pastikan tombol X terlihat hijau dan chat tetap membuka sebagai lapisan tanpa memuat ulang game.
- Periksa tampilan pada ukuran ponsel dan desktop serta pastikan tidak ada error baru.

## Detail teknis
- Pusatkan ukuran gambar rumah dan collider dalam metadata tier bersama agar tidak kembali berbeda.
- Bentuk collider pohon dari ukuran sprite dasar × skala, lalu batasi collider pada area batang/akar, bukan seluruh kanopi.
