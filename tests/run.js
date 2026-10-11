// Uji semua endpoint tanpa internet memakai fetch tiruan.  Jalankan: node tests/run.js
//
// Yang diuji:
//   1. Setiap endpoint, dalam 5 kondisi server sumber (normal, media langsung, error 500, respons sampah, mati total, timeout),
//      selalu membalas dengan format yang bisa dibaca bot: JSON { ok, status, data/result } atau { ok:false, error }, atau file media.
//      Tidak boleh ada HTML, crash, atau menggantung.
//   2. Endpoint lokal (game, utilitas, hiburan) harus tetap 200 walau internet mati total.
//   3. Hasil hitungan endpoint lokal dicocokkan dengan nilai yang sudah diketahui benar.
//
// Catatan: ini menguji logika dan ketahanan kode, bukan apakah layanan pihak ketiga hidup.

try { require.resolve("express"); } catch { require("./shim"); }
const http = require("http");
const path = require("path");
const root = path.join(__dirname, "..");
const app = require(path.join(root, "api/index.js"));
const { list } = require(path.join(root, "lib/registry.js"));

// ---------- Fetch tiruan ----------
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const realFetch = global.fetch;
let mode = "ok";
const reply = (body, { status = 200, type = "application/json" } = {}) =>
  new Response(body, { status, headers: { "content-type": type } });
const JSON_OK = {
  status: true, success: true,
  result: {
    url: "https://cdn.test/x.png", image: "https://cdn.test/x.png", download: "https://cdn.test/x.mp3",
    title: "judul", judul: "judul", text: "teks", name: "nama", username: "user",
    list: [{ title: "a", url: "https://cdn.test/x.png" }],
  },
};
global.fetch = async (input, opt = {}) => {
  const url = String(input);
  if (url.startsWith("http://127.0.0.1")) return realFetch(input, opt);
  if (mode === "down") throw new TypeError("fetch failed");
  if (mode === "timeout") throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
  if (mode === "err500") return reply("Internal Server Error", { status: 500, type: "text/plain" });
  if (mode === "garbage") return reply("<html><body>bukan json</body></html>", { type: "text/html" });
  if (url.includes("api.mojang.com")) return reply(JSON.stringify({ id: "069a79f444e94726a5befca90e38aaf5", name: "Notch" }));
  if (url.startsWith("https://cdn.test/")) return reply(PNG, { type: url.endsWith(".mp3") ? "audio/mpeg" : "image/png" });
  if (mode === "direct") return reply(PNG, { type: "image/png" });
  return reply(JSON.stringify(JSON_OK));
};

// ---------- Nilai parameter uji ----------
const OVERRIDE = {
  konversi: { nilai: "10", dari: "km", ke: "mil" },
  selisihtanggal: { dari: "2020-01-01", ke: "2020-03-01" },
  hitungmundur: { tanggal: "2099-01-01" },
  weton: { tanggal: "1945-08-17" },
  hijriah: { tanggal: "2024-03-11" },
  jsonformat: { text: '{"a":1}' },
  hex: { text: "616263", mode: "decode" },
  urlencode: { text: "a b" },
  stalkminecraft: { username: "Notch" },
  cekjawaban: { tebakan: "Bunglon", jawaban: "bunglon" },
  balogo: { textl: "Blue", textr: "Archive" },
  base64: { text: "halo", mode: "encode" },
  kalkulator: { expr: "1+2", ekspresi: "1+2" },
  kurs: {},
};
const BY_NAME = {
  url: "https://example.com/a.jpg", image: "https://example.com/a.jpg", ppurl: "https://example.com/a.jpg", avatar: "https://example.com/a.jpg",
  text: "halo dunia", q: "naruto", username: "tes", prompt: "kucing lucu",
  angka: "17", n: "10", a: "12", b: "18", c: "2", harga: "100000", diskon: "10", pokok: "1000000", bunga: "12", bulan: "12", harta: "200000000",
  tahun: "2024", nilai: "10", total_match: "100", wr_now: "50", wr_target: "60", shift: "3", id: "123456", zone: "1234", uid: "123456789",
  tanggal: "2000-01-31", kota: "jakarta", user: "tes", name: "tes", nama: "tes",
};
const dummy = (e) => {
  const o = {};
  for (const p of e.params) {
    const n = p.replace(/\?$/, "");
    if (p.endsWith("?")) continue;
    o[n] = BY_NAME[n] ?? "tes";
  }
  return { ...o, ...(OVERRIDE[e.name] || {}) };
};

// ---------- Ambil daftar endpoint lokal ----------
const collect = (file) => {
  const names = new Set();
  const add = (cat, name) => names.add(`${cat}/${name}`);
  require(path.join(root, file))({ add, fail: (m) => new Error(m), enc: encodeURIComponent, isUrl: (s) => /^https?:/i.test(s) });
  return names;
};
const LOCAL = new Set([...collect("lib/games.js"), ...collect("lib/local.js")]);
const LUFFY = collect("lib/luffy.js");

// ---------- HTTP helper ----------
const server = http.createServer(app);
let base;
const hit = (e, q) =>
  new Promise((resolve) => {
    const u = new URL(e.path, base);
    for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
    const t = setTimeout(() => resolve({ hang: true }), 8000);
    http.get(u, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        clearTimeout(t);
        const body = Buffer.concat(chunks);
        const type = String(res.headers["content-type"] || "");
        let json = null;
        if (type.includes("json")) { try { json = JSON.parse(body.toString()); } catch {} }
        resolve({ code: res.statusCode, type, body, json, loc: res.headers.location });
      });
    }).on("error", (err) => { clearTimeout(t); resolve({ err }); });
  });

const check = (r) => {
  if (r.hang) return "menggantung";
  if (r.err) return "koneksi putus: " + r.err.message;
  if (r.code >= 300 && r.code < 400) return r.loc ? null : "redirect tanpa lokasi";
  if (/^(image|audio|video)\//.test(r.type) || r.type.includes("octet-stream")) return r.code === 200 && r.body.length ? null : "media kosong";
  if (!r.json) return `bukan JSON (${r.type || "tanpa content-type"})`;
  if (typeof r.json.ok !== "boolean") return "tidak ada field ok";
  if (r.json.ok) return r.json.status === true && "result" in r.json && "data" in r.json ? null : "field status/result/data tidak lengkap";
  if (!r.json.error || typeof r.json.error !== "string") return "error kosong";
  if (r.json.status !== false) return "field status harus false saat gagal";
  if (/Cannot read|undefined|is not a function|TypeError|at .*\.js/.test(r.json.error)) return "bocor detail internal: " + r.json.error;
  if (r.code < 400) return "ok:false tapi status HTTP " + r.code;
  return null;
};

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  const eps = list();
  const problems = [];
  const stats = {};

  for (const m of ["ok", "direct", "err500", "garbage", "down", "timeout"]) {
    mode = m;
    const s = (stats[m] = { sukses: 0, errorRapi: 0, masalah: 0 });
    for (const e of eps) {
      const r = await hit(e, dummy(e));
      const bad = check(r);
      if (bad) { s.masalah++; problems.push(`[${m}] ${e.cat}/${e.name}: ${bad}`); }
      else if (r.json && r.json.ok === false) s.errorRapi++;
      else s.sukses++;

      // Endpoint lokal harus tetap berhasil walau internet mati total.
      if (LOCAL.has(`${e.cat}/${e.name}`) && !(r.json && r.json.ok === true) && !(r.code === 400)) {
        problems.push(`[${m}] ${e.cat}/${e.name}: endpoint lokal gagal saat internet mati (${r.code})`);
      }
      // Endpoint dari Luffy tidak boleh membocorkan error tak terduga.
      if (LUFFY.has(`${e.cat}/${e.name}`) && r.json && r.json.ok === false && r.code === 500) {
        problems.push(`[${m}] ${e.cat}/${e.name}: status 500 tak terduga`);
      }
    }
  }

  // Mode normal: semua endpoint Luffy dengan data tiruan wajib sukses.
  mode = "ok";
  for (const e of eps.filter((x) => LUFFY.has(`${x.cat}/${x.name}`))) {
    const r = await hit(e, dummy(e));
    const okMedia = r.code === 200 && /^(image|audio|video)\//.test(r.type);
    const okJson = r.json && r.json.ok === true;
    if (!okMedia && !okJson && !(r.code === 400)) problems.push(`[ok] ${e.cat}/${e.name}: seharusnya sukses, dapat ${r.code} ${r.json?.error || r.type}`);
    if (r.code === 400) problems.push(`[ok] ${e.cat}/${e.name}: ditolak 400 (${r.json?.error})`);
  }

  // ---------- Nilai yang sudah diketahui benar ----------
  const V = async (cat, name, q) => (await hit({ path: `/api/${cat}/${name}` }, q)).json?.data;
  const eq = (label, got, want) => {
    if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`[nilai] ${label}: dapat ${JSON.stringify(got)}, seharusnya ${JSON.stringify(want)}`);
  };
  mode = "down";
  const w = await V("utility", "weton", { tanggal: "1945-08-17" });
  eq("weton 17-08-1945", [w?.hari, w?.pasaran, w?.neptu], ["Jumat", "Legi", 11]);
  eq("kabisat 2024", (await V("utility", "kabisat", { tahun: "2024" }))?.kabisat, true);
  eq("kabisat 1900", (await V("utility", "kabisat", { tahun: "1900" }))?.kabisat, false);
  const f = await V("utility", "fpbkpk", { a: "12", b: "18" });
  eq("fpb/kpk 12,18", [f?.fpb, f?.kpk], [6, 36]);
  eq("17 prima", (await V("utility", "bilangan", { angka: "17" }))?.prima, true);
  eq("1 km ke mil", (await V("utility", "konversi", { nilai: "1", dari: "km", ke: "m" }))?.hasil, 1000);
  eq("100C ke F", (await V("utility", "konversi", { nilai: "100", dari: "c", ke: "f" }))?.hasil, 212);
  eq("akar x2-3x+2", (await V("utility", "kuadrat", { a: "1", b: "-3", c: "2" }))?.akar, [2, 1]);
  eq("diskon 10%", (await V("utility", "diskon", { harga: "100000", diskon: "10" }))?.bayar, 90000);
  const wr = await V("tools", "winrate", { total_match: "100", wr_now: "50", wr_target: "60" });
  eq("winrate 50->60", [wr?.menangBeruntunDibutuhkan, wr?.hasilAkhir], [25, 60]);
  eq("faktorial 5", (await V("utility", "faktorial", { n: "5" }))?.hasil, 120);
  eq("fibonacci 8", (await V("utility", "fibonacci", { n: "8" }))?.deret, ["0", "1", "1", "2", "3", "5", "8", "13"]);
  eq("hijriah 11-03-2024", (await V("islami", "hijriah", { tanggal: "2024-03-11" }))?.hijriah?.replace(/\s+/g, " ").toLowerCase().includes("ramadan"), true);
  eq("cekjawaban", (await V("game", "cekjawaban", { tebakan: " Bunglon ", jawaban: "bunglon" }))?.benar, true);
  eq("rot13", (await V("utility", "rot13", { text: "Halo" }))?.hasil, "Unyb");
  eq("jodoh konsisten", (await V("fun", "jodoh", { nama1: "a", nama2: "b" }))?.persen, (await V("fun", "jodoh", { nama1: "b", nama2: "a" }))?.persen);
  const g = await V("game", "tebakkimia", {});
  eq("tebakkimia punya jawaban", typeof g?.jawaban, "string");
  const bad400 = await hit({ path: "/api/utility/kabisat" }, {});
  eq("parameter wajib kosong -> 400", [bad400.code, bad400.json?.ok], [400, false]);
  const alias = await hit({ path: "/api/utility/rot13" }, { teks: "Halo" });
  eq("alias parameter teks->text", alias.json?.data?.hasil, "Unyb");
  const miss = await hit({ path: "/api/xxx/yyy" }, {});
  eq("endpoint tak ada -> 404 JSON", [miss.code, miss.json?.ok], [404, false]);
  const upper = await hit({ path: "/api/Utility/Rot13" }, { text: "a" });
  eq("nama endpoint tak peduli huruf besar", upper.json?.ok, true);

  // ---------- Laporan ----------
  const cats = {};
  eps.forEach((e) => (cats[e.cat] = (cats[e.cat] || 0) + 1));
  console.log(`Total endpoint terdaftar : ${eps.length}`);
  console.log(`  dari Luffy             : ${LUFFY.size}`);
  console.log(`  lokal (selalu aktif)   : ${LOCAL.size} + utilitas bawaan lain`);
  console.log("Per kategori             :", Object.entries(cats).map(([k, v]) => `${k} ${v}`).join(", "));
  console.log("\nHasil per kondisi server sumber (jumlah endpoint):");
  for (const [m, s] of Object.entries(stats)) console.log(`  ${m.padEnd(8)} sukses ${String(s.sukses).padStart(3)} | gagal tapi rapi ${String(s.errorRapi).padStart(3)} | MASALAH ${s.masalah}`);
  console.log(problems.length ? `\n${problems.length} MASALAH:\n- ${problems.slice(0, 80).join("\n- ")}` : "\nSemua pemeriksaan lolos.");
  server.close();
  process.exit(problems.length ? 1 : 0);
})();
