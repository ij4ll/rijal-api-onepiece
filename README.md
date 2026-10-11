# Rijal Rest API

REST API publik (GET & POST, tanpa API key) + dashboard dokumentasi.

## Jalankan lokal
    npm install
    npm start        # http://localhost:3000

## Deploy ke Vercel
1. Push folder ini ke GitHub, lalu Import di Vercel (atau pakai bot: `.deploy rijal-api-v2 user/repo`).
2. Tidak ada Environment Variables wajib. Semua endpoint langsung aktif.
   Opsional: FIREFLY_KEY (stalktt, stalkig) dan CUKI_KEY (cadangan pinterest) bila ingin pakai key sendiri.
3. Atur nama domain di Settings > Domains > Edit domain .vercel.app menjadi rijal-api-v2.vercel.app.

## Endpoint
301 endpoint, bisa diakses lewat GET (query string) maupun POST (body JSON/form), tanpa API key.
Daftar lengkap ada di /api/endpoints atau dashboard.

Kategori baru `wabot` (11 endpoint) berisi endpoint yang memang dirancang untuk dipakai langsung di
script bot WhatsApp: linkwa, vcard, mentionformat, groupcheck, polltext, sambutan, stickertag,
menuformat, uptimeformat, warnlevel, rpstext. Endpoint ini, dan semua endpoint baru di
`lib/offline.js` + `lib/offline2.js` (47 endpoint), diproses 100% di server sendiri (tanpa panggil
API pihak ketiga) sehingga tidak akan pernah down.

## Log request (console)
Setiap request ke `/api/*` dicatat ke console server (`console.log`, muncul di terminal lokal atau
log Vercel). Dashboard juga punya panel "Log Transmisi Den Den Mushi" di bagian bawah halaman yang
menampilkan log tiap kali endpoint dicoba lewat tombol Kirim di dashboard, sama seperti console log
tapi tampil langsung di browser.

## Tema
Dashboard pakai tema bajak laut (font Pirata One, aksen emas/merah bendera) dengan video laut
sebagai background (`https://u.pone.rs/mgmihqou.mp4`). Kalau browser pengguna mengaktifkan
"reduce motion", video otomatis tidak diputar dan diganti gradasi warna statis.

| Kategori | Isi | Sumber |
|---|---|---|
| game (28) | tebak gambar, family100, asah otak, caklontong, truth, dare, cek jawaban, dll | data Luffy v4.8, diproses di server sendiri |
| utility, fun, islami, tools | kalkulator, konversi, weton, hijriah, jodoh, sandi, dll | diproses di server sendiri |
| maker (27), image (28), random (10) | fake lobby ML/FF, fake story IG, iqc, brat, edit foto AI, cecan, dll | provider dari plugin Luffy (nexray, api-faa, zenzxz, deline, cuki, nexadev, dll) |
| ai (15), search (21), stalk (16), download (15), music, info | AI chat, pencarian, profil, downloader | provider dari Luffy |

Endpoint yang diproses di server sendiri tidak bisa down. Endpoint provider bergantung pada layanan pihak ketiga:
bila layanan itu mati, API membalas JSON error yang rapi (bukan crash) dan bot bisa menampilkannya ke pengguna.
Endpoint gambar dan video menerima parameter url (maks 3 sampai 4 MB) karena respons Vercel dibatasi sekitar 4,5 MB.

## Dipakai dari bot WhatsApp
Format respons sukses (JSON):
    { "ok": true, "status": true, "creator": "Rijal", "data": {...}, "result": {...} }
`data` dan `result` isinya sama, pakai mana saja. Format gagal:
    { "ok": false, "status": false, "error": "pesan error", "message": "pesan error" }
Endpoint gambar, audio, dan video membalas file aslinya langsung (Content-Type image/*, audio/*, video/*).

Contoh Baileys / axios:
    const base = "https://rijal-api-v2.vercel.app";
    // JSON
    const { data } = await axios.get(`${base}/api/game/tebakgambar`, { validateStatus: () => true });
    if (!data.ok) return m.reply(data.error);
    await m.reply(data.result.jawaban);
    // Gambar
    const r = await axios.get(`${base}/api/maker/fakenote`, { params: { name, message }, responseType: "arraybuffer", validateStatus: () => true });
    if (!String(r.headers["content-type"]).startsWith("image/")) return m.reply(JSON.parse(Buffer.from(r.data)).error);
    await sock.sendMessage(m.chat, { image: Buffer.from(r.data) }, { quoted: m });
Selalu cek `ok` (atau Content-Type) sebelum memakai hasilnya. Nama parameter yang umum dipakai bot
(query, teks, link, user) otomatis dipetakan ke parameter yang benar, dan nama endpoint tidak peduli huruf besar kecil.

## Uji
    npm test
Menjalankan semua endpoint memakai fetch tiruan dalam 6 kondisi (normal, media langsung, error 500, respons sampah, internet mati, timeout)
dan memastikan setiap respons rapi, tidak crash, dan endpoint lokal tetap jalan saat internet mati. Ini menguji kode, bukan apakah layanan pihak ketiga hidup.

## Domain
Base URL: https://rijal-api-v2.vercel.app (atur di Vercel > Settings > Domains > Edit domain .vercel.app).
Dashboard memakai alamat ini untuk contoh URL dan tombol Coba; saat dijalankan lokal otomatis memakai localhost.
Untuk mengganti, ubah PUBLIC_URL di public/app.js.

## Pasang domain sendiri (Vercel)
1. Beli domain (Niagahoster, Rumahweb, Namecheap, Cloudflare, dll).
2. Vercel > project > Settings > Domains > Add, isi domain (mis. api.domainkamu.com).
3. Atur DNS di tempat domain dikelola:
   - Subdomain (api.domainkamu.com):  CNAME  api  ->  cname.vercel-dns.com
   - Domain utama (domainkamu.com):   A      @    ->  76.76.21.21
   Jika memakai Cloudflare, set proxy ke "DNS only" (awan abu-abu) selama verifikasi.
4. Tunggu beberapa menit sampai status di Vercel menjadi Valid Configuration. HTTPS aktif otomatis.
5. Tes: https://api.domainkamu.com/api/endpoints
Nilai DNS yang tertulis di halaman Domains Vercel adalah yang paling benar, ikuti itu bila berbeda.

## Tambah endpoint
Edit lib/luffy.js (provider), lib/local.js (hitungan lokal), lib/games.js (game), lib/more.js, atau lib/providers.js, panggil add(kategori, nama, deskripsi, [param], handler).
Dashboard ikut berubah otomatis. Jalankan `npm test` setelah menambah endpoint.
