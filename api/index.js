const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { list, find } = require("../lib/registry");

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors());

const limiter = (limit) =>
  rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({ ok: false, status: false, error: "Terlalu banyak request. Coba lagi sebentar lagi." }),
  });
// Nama alternatif parameter yang sering dipakai script bot.
const ALIAS = {
  q: ["query", "text", "teks", "search", "kata"],
  text: ["teks", "q", "query", "prompt", "message", "pesan"],
  prompt: ["text", "q", "query", "teks"],
  url: ["link", "u", "image", "img"],
  image: ["url", "img", "link"],
  username: ["user", "name", "nama", "id"],
  user: ["username", "name", "nama"],
};
const general = limiter(60); // semua endpoint: 60 request/menit/IP
const heavy = limiter(15); // endpoint berat (downloader, AI, video): 15 request/menit/IP

// Dashboard (saat dijalankan lokal; di Vercel file public/ dilayani otomatis)
app.use(express.static(path.join(__dirname, "../public")));

// Log tiap request ke /api di console server (muncul di terminal lokal / log Vercel).
// Dashboard punya "console log" sendiri di browser (lihat public/app.js) karena
// log server tidak bisa dikirim real-time ke browser tanpa infrastruktur tambahan.
app.use("/api", (req, res, next) => {
  const t0 = Date.now();
  const stamp = () => new Date().toISOString().slice(11, 19);
  res.on("finish", () => {
    const ms = Date.now() - t0;
    const tag = res.statusCode < 300 ? "OK" : res.statusCode < 500 ? "WARN" : "ERR";
    console.log(`[${stamp()}] ${tag} ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms) ip=${req.ip}`);
  });
  next();
});

// GET untuk baca data, POST untuk kirim data (body JSON atau form) - cocok dipakai bot WA.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use("/api", (req, res, next) =>
  req.method === "GET" || req.method === "HEAD" || req.method === "POST"
    ? next()
    : res.status(405).json({ ok: false, status: false, error: "Hanya method GET dan POST yang diizinkan" })
);
app.use("/api", general);

app.get("/api/ip", (req, res) => res.json({ ok: true, ip: req.ip }));

app.get("/api/endpoints", (req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json({ ok: true, total: list().length, data: list() });
});

app.all("/api/:cat/:name", (req, res) => {
  const e = find(req.params.cat, req.params.name);
  if (!e) {
    return res.status(404).json({ ok: false, status: false, error: "Endpoint tidak ditemukan. Daftar lengkap ada di /api/endpoints" });
  }

  const run = async () => {
    try {
      const q = {};
      // POST: ambil dari body (JSON atau form). GET: ambil dari query string. Keduanya boleh digabung.
      const body = req.body && typeof req.body === "object" ? req.body : {};
      for (const [k, v] of Object.entries({ ...body, ...req.query })) q[k] = String(Array.isArray(v) ? v[0] : v).slice(0, 500);
      // Bot sering memakai nama parameter berbeda (query, teks, link). Isi otomatis bila parameter wajib kosong.
      for (const p of e.params) {
        const n = p.replace(/\?$/, "");
        if ((q[n] || "").trim()) continue;
        const a = (ALIAS[n] || []).find((k) => (q[k] || "").trim());
        if (a) q[n] = q[a];
      }
      for (const p of e.params) {
        if (!p.endsWith("?") && !(q[p] || "").trim()) {
          return res.status(400).json({ ok: false, status: false, error: `Parameter '${p}' wajib diisi`, params: e.params });
        }
      }
      const r = await e.run(q);
      if (r && r.redirect) return res.redirect(302, r.redirect);
      if (r && r.buffer) {
        const cache = e.cat === "random" ? "no-store" : "public, max-age=3600";
        return res.type(r.type || "application/octet-stream").set("Cache-Control", cache).send(r.buffer);
      }
      if (r && r.svg) {
        return res.type("image/svg+xml").set("Cache-Control", "public, max-age=3600").send(r.svg);
      }
      // "status" dan "result" disediakan agar kompatibel dengan script bot yang memakai format REST API umum.
      res.set("Cache-Control", "no-store").json({ ok: true, status: true, creator: "Rijal", data: r, result: r });
    } catch (err) {
      const status = err.name === "TimeoutError" ? 504 : Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 502;
      // Error yang sengaja dibuat (punya status) ditampilkan apa adanya. Error tak terduga disamarkan agar detail internal tidak bocor.
      const error =
        err.name === "TimeoutError" ? "Server sumber terlalu lama membalas"
        : Number.isInteger(err.status) ? String(err.message || "Terjadi kesalahan").slice(0, 300)
        : "Respons server sumber tidak sesuai harapan. Coba lagi nanti.";
      res.status(status).json({ ok: false, status: false, error, message: error });
    }
  };

  e.heavy ? heavy(req, res, run) : run();
});

app.use((req, res, next) => (req.path.startsWith("/api") ? res.status(404).json({ ok: false, status: false, error: "Route tidak ada" }) : next()));
app.use((req, res) => res.status(404).type("text").send("Halaman tidak ditemukan"));

// Penangkap error terakhir: apa pun yang lolos tetap dibalas JSON, tidak pernah HTML atau crash.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ ok: false, status: false, error: "Terjadi kesalahan di server" });
});

module.exports = app;
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Jalan di http://localhost:${port}`));
}
