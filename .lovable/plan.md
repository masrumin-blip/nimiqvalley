# AI Chat Beneran untuk 5 Karakter Nimiq Valley

Sekarang balasan karakter cuma daftar kalimat yang berputar. Rencana ini menggantinya dengan AI sungguhan, memakai AI bawaan Lovable — kamu tidak perlu menyiapkan atau membayar kunci API pihak ketiga; pemakaiannya memotong kredit workspace.

## Yang akan berubah

1. **Balasan hidup**
   Setiap pesan kamu dikirim ke AI dan dijawab mengalir (muncul huruf demi huruf), bukan kalimat siap pakai. Karakter mengingat isi percakapan selama halaman terbuka.

2. **Kepribadian unik per karakter**
   Tiap tokoh dapat "watak" sendiri sehingga gaya balasannya jelas berbeda:
   - **Nimi Queen** — anggun dan berwibawa; kalimat rapi, sedikit formal, suka menutup dengan satu kalimat bijak.
   - **Kael Arvand** — penjelajah, ceria dan cepat; kalimat pendek, penuh semangat, sering mengajak bertindak.
   - **Lumi Aster** — lembut dan puitis; banyak kiasan cahaya, angin, mimpi; bicara pelan dan menenangkan.
   - **Mira Floren** — hangat dan periang; ramah, banyak bertanya balik, suka menyemangati.
   - **Empu Elvar** — sesepuh yang tenang dan misterius; kalimat pendek berlapis makna, kadang berupa perumpamaan.
   Semua menjawab dalam bahasa yang kamu pakai, panjang balasan dijaga 1–3 kalimat supaya terasa seperti obrolan.

3. **Tampilan ruang cerita**
   - Gelembung "sedang mengetik" saat AI menyusun jawaban.
   - Tombol kirim nonaktif selama balasan berjalan.
   - Layar otomatis menggulir ke pesan terbaru.
   - Pesan kecil yang sopan kalau AI sedang sibuk atau kredit habis, bukan layar diam.
   - Teks "local demo" dan "backend and credentials not included" dihapus.

4. **Privasi**
   Percakapan tetap tidak disimpan ke database; hilang saat halaman ditutup. (Kalau nanti mau riwayat tersimpan, itu pekerjaan terpisah.)

## Catatan teknis

- Rute server `src/routes/api/chat.ts` memakai AI SDK + Lovable AI Gateway (`openai/gpt-6-astra` lewat Responses API, streaming, `store: false`, reasoning effort `low`), kunci dibaca dari `LOVABLE_API_KEY` di server; disiapkan lewat tool bila belum ada.
- Karakter diberi field `persona` (system prompt) di `src/lib/characters.ts`; rute memvalidasi `characterId` dan menolak id tak dikenal.
- `src/routes/chat.$characterId.tsx` memakai `useChat` dari `@ai-sdk/react` dengan `DefaultChatTransport({ api: "/api/chat" })`, id chat per karakter, render lewat `message.parts`, pesan pembuka tetap `greeting`.
- Paket yang dipasang: `ai`, `@ai-sdk/react`, `@ai-sdk/openai`, plus helper run-id di `src/lib/ai-gateway.server.ts`.
- Status error gateway ditangani sesuai aturan: 429/5xx boleh dicoba ulang terbatas, sisanya tampilkan pesan dan berhenti.

## Pemeriksaan

Buka satu ruang karakter, kirim satu pesan, pastikan balasan mengalir dan tidak ada error di konsol.
