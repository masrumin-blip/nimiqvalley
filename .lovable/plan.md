# Switch AI Chat ke Griphub

## Tujuan
Ganti backend obrolan AI karakter Nimiq Valley dari Lovable AI Gateway ke provider **Griphub** pakai API key milik user, sambil mempertahankan watak tiap karakter.

## Prasyarat
- User memberikan API key Griphub melalui form aman.
- User memberikan base URL endpoint Griphub (jika tidak standar) dan ID model yang dipakai.

## Langkah implementasi
1. Simpan secret `GRIPHUB_API_KEY` (dan `GRIPHUB_BASE_URL` bila perlu) ke environment proyek.
2. Buat helper server-only `src/lib/griphub.server.ts` untuk membangun request chat completions sesuai format API Griphub.
3. Ganti implementasi `src/routes/api/chat.ts` agar memanggil Griphub alih-alih Lovable AI Gateway.
4. Pertahankan prompt sistem berbasis `src/lib/characters.ts` supaya balasan tiap karakter tetap unik.
5. Uji lewat Playwright: kirim pesan ke beberapa karakter, pastikan balasan muncul dan tidak ada error konsol.

## Catatan
- Jika Griphub kompatibel OpenAI, helper cukup thin wrapper dengan baseURL dan header `Authorization: Bearer`.
- Stream response tetap dipakai supaya UI "sedang mengetik" tetap berfungsi.
