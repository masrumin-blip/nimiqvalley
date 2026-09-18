# Fix login Nimiq Pay

## Temuan terverifikasi
- Log produksi menunjukkan kegagalan `invalid response format`, bukan `signature mismatch` atau `public-key mismatch`.
- Error sebenarnya adalah `Cannot read properties of undefined (reading '__wbindgen_malloc')` saat library kriptografi Nimiq dipakai.
- `@nimiq/core/web` menyediakan fungsi inisialisasi default, tetapi fungsi login saat ini langsung memakai `Address`, `PublicKey`, dan `Signature` tanpa menginisialisasi mesin kriptografinya.
- Jadi kandidat penyebab utama bukan algoritma hash. Format signed-message resmi Nimiq Hub memang menggunakan SHA-256; menambahkan Blake2b sekarang tidak menjawab error yang tercatat.

## Perubahan
1. Inisialisasi `@nimiq/core/web` di dalam server handler sebelum membuat atau memakai `Address`, `PublicKey`, `Signature`, atau `Hash`.
2. Pertahankan pemeriksaan nonce sekali pakai, masa berlaku, kecocokan public key dengan address, serta kandidat signature yang sudah ada.
3. Terapkan inisialisasi yang sama pada perhitungan hash transaksi agar jalur pembayaran tidak mengalami crash WASM serupa.
4. Perjelas log per tahap supaya kegagalan inisialisasi, decoding, address, dan signature dapat dibedakan tanpa mencatat key atau signature mentah.

## Verifikasi
- Jalankan pemeriksaan tipe dan build produksi untuk memastikan varian `@nimiq/core/web` tetap kompatibel dan tidak memunculkan kembali error top-level await.
- Uji helper kriptografi dengan pasangan key/signature yang valid dan kasus signature salah.
- Setelah dipublish, coba login dari Nimiq Pay dan pastikan log menunjukkan verifikasi berhasil serta session terbentuk.
