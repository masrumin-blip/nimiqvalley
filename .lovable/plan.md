# AI Chat pakai Griphub

Ganti mesin balasan chat dari layanan AI bawaan Lovable ke Griphub, pakai akses yang kamu berikan.

Catatan penting: kunci API tadi kamu tulis langsung di chat, jadi sebaiknya dianggap sudah bocor. Setelah ini jalan, buat kunci baru di Griphub dan kabari aku — kunci lama bisa kamu cabut.

## Yang dipakai

- Alamat layanan: https://griphubrouter.web.id/v1
- Model: grok-4.6
- Kunci API: disimpan di penyimpanan rahasia proyek (tidak ditulis di kode, tidak pernah dikirim ke browser)

## Yang berubah

1. Kunci API disimpan sebagai rahasia proyek bernama `GRIPHUB_API_KEY`.
2. Bagian server yang menjawab chat diarahkan ke Griphub dengan model grok-4.6, tetap mengalir kata demi kata seperti sekarang.
3. Watak kelima karakter (Nimi, Kael, Lumi, Mira, Elvar) tetap persis seperti sekarang — tidak ada perubahan gaya bicara.
4. Pesan error dibuat jelas: kunci salah, kuota habis, atau layanan sedang sibuk masing-masing punya pesan sendiri di layar.
5. Aku uji langsung satu percakapan nyata di halaman chat sebelum bilang selesai. Kalau Griphub menolak, aku laporkan apa adanya, bukan diam-diam balik ke layanan lama.

## Detail teknis

- Rahasia baru: `GRIPHUB_API_KEY` (disimpan via set_secret, nilai sudah diketahui).
- Helper baru `src/lib/griphub.server.ts`: `createOpenAICompatible({ baseURL: "https://griphubrouter.web.id/v1", apiKey: process.env.GRIPHUB_API_KEY, name: "griphub" })`, dibuat di dalam handler.
- `src/routes/api/chat.ts`: ganti provider Lovable Gateway → provider Griphub, model `grok-4.6`; hapus `providerOptions.openai` khas Responses API (`store`, `include`, `forceReasoning`, `reasoningEffort`) karena ini jalur chat-completions biasa; `streamText` + `toUIMessageStreamResponse()` tetap.
- Persona tetap dibaca dari `src/lib/characters.ts` — tidak disentuh.
- `src/routes/chat.$characterId.tsx`: hanya penyesuaian pemetaan pesan error (401 kunci, 402/429 kuota, 5xx sibuk). Tidak ada perubahan tampilan.
- Paket `@ai-sdk/openai-compatible` ditambahkan bila belum ada.
- Verifikasi: skrip Playwright di /tmp/browser/griphub/ — buka /chat/elvar, kirim satu pesan, pastikan balasan muncul dan konsol bersih.
