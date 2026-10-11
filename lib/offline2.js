// Endpoint batch 3: lanjutan lib/offline.js. Juga 100% lokal, tanpa API pihak
// ketiga, jadi tidak bisa down. Fokus ke kebutuhan bot WA: generator teks,
// format pesan, dan utilitas kecil yang sering dipakai command bot.

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

module.exports = ({ add, fail }) => {
  const need = (v, name) => {
    if (!String(v || "").trim()) throw fail(`${name} wajib diisi`);
    return String(v);
  };

  /* ---------- Lanjutan khusus bot WA ---------- */
  add("wabot", "stickertag", "Format metadata packname/author buat command sticker bot", ["pack?", "author?"], (q) => ({
    packname: q.pack || "Sticker Pack",
    author: q.author || "Dibuat via Bot",
    exif: JSON.stringify({ "sticker-pack-name": q.pack || "Sticker Pack", "sticker-pack-publisher": q.author || "Dibuat via Bot" }),
  }));

  add("wabot", "menuformat", "Rapikan daftar command jadi teks menu bot (pisahkan baris dengan |)", ["judul", "command"], (q) => {
    const items = need(q.command, "command").split("|").map((s) => s.trim()).filter(Boolean);
    if (!items.length) throw fail("command wajib diisi, pisahkan dengan |");
    const teks = `╭──〔 *${need(q.judul, "judul")}* 〕\n` + items.map((c) => `│ ➥ ${c}`).join("\n") + `\n╰────────────`;
    return { judul: q.judul, jumlah: items.length, teks };
  });

  add("wabot", "uptimeformat", "Ubah detik uptime jadi teks hari/jam/menit/detik", ["detik"], (q) => {
    let s = parseInt(q.detik, 10);
    if (!Number.isFinite(s) || s < 0) throw fail("detik harus angka positif");
    const d = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600); s %= 3600;
    const m = Math.floor(s / 60); s %= 60;
    return { teks: `${d}h ${h}j ${m}m ${s}d`, hari: d, jam: h, menit: m, detik: s };
  });

  add("wabot", "warnlevel", "Format teks peringatan/warn anggota grup bertingkat", ["nama", "jumlah", "batas?"], (q) => {
    const jml = parseInt(q.jumlah, 10), batas = parseInt(q.batas || "3", 10);
    if (!Number.isFinite(jml)) throw fail("jumlah harus angka");
    const sisa = Math.max(0, batas - jml);
    return {
      nama: need(q.nama, "nama"), peringatan: jml, batas, sisa,
      teks: sisa === 0 ? `🚫 *${q.nama}* sudah mencapai batas peringatan (${jml}/${batas}) dan akan dikeluarkan.` : `⚠️ *${q.nama}* mendapat peringatan ${jml}/${batas}. Sisa ${sisa} kali lagi.`,
    };
  });

  add("wabot", "rpstext", "Logika permainan batu-gunting-kertas (bot vs pemain)", ["pilihan"], (q) => {
    const opsi = ["batu", "gunting", "kertas"];
    const p = need(q.pilihan, "pilihan").toLowerCase();
    if (!opsi.includes(p)) throw fail("pilihan harus batu, gunting, atau kertas");
    const bot = pick(opsi);
    const menang = { batu: "gunting", gunting: "kertas", kertas: "batu" };
    const hasil = p === bot ? "seri" : menang[p] === bot ? "menang" : "kalah";
    return { pemain: p, bot, hasil, teks: `Kamu: ${p} | Bot: ${bot} → ${hasil === "seri" ? "Seri! 🤝" : hasil === "menang" ? "Kamu menang! 🎉" : "Kamu kalah! 😅"}` };
  });

  /* ---------- Generator & fun tambahan ---------- */
  add("fun", "bountyname", "Buat julukan ala poster buronan bajak laut dari nama", ["nama"], (q) => {
    const gelar = ["Si Pemburu Badai", "Pedang Elang Laut", "Raja Palung Selatan", "Bayangan Ombak", "Penakluk Tujuh Lautan", "Api Biru dari Timur", "Naga Tidur", "Pencuri Rembulan"];
    const nama = need(q.nama, "nama");
    const bounty = (1000 + Math.floor(Math.random() * 999)) * 1_000_000;
    return { nama, julukan: `"${pick(gelar)}" ${nama}`, bounty: "Rp" + bounty.toLocaleString("id-ID") };
  });

  add("fun", "cocokcrew", "Peran kru kapal bajak laut acak buat games grup (hasil konsisten per nama)", ["nama"], (q) => {
    const peran = ["Kapten", "Navigator", "Juru Masak", "Dokter Kapal", "Penembak Jitu", "Ahli Pedang", "Arkeolog", "Tukang Kayu", "Musisi"];
    let h = 2166136261;
    for (const c of need(q.nama, "nama").toLowerCase()) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return { nama: q.nama, peran: peran[(h >>> 0) % peran.length] };
  });

  add("fun", "loot", "Hadiah harta karun acak buat fitur gacha/daily reward bot", ["langka?"], (q) => {
    const tabel = [
      { nama: "Koin Perunggu", rate: 40 }, { nama: "Koin Perak", rate: 30 }, { nama: "Koin Emas", rate: 18 },
      { nama: "Peta Harta Karun", rate: 8 }, { nama: "Permata Langka", rate: 3 }, { nama: "Harta Karun Legendaris", rate: 1 },
    ];
    const r = Math.random() * 100;
    let acc = 0, hasil = tabel[0].nama;
    for (const t of tabel) { acc += t.rate; if (r <= acc) { hasil = t.nama; break; } }
    return { hadiah: hasil, peluangPersen: tabel.find((t) => t.nama === hasil).rate };
  });

  /* ---------- Util tambahan ---------- */
  add("utility", "ceksubnet", "Hitung jumlah IP dari CIDR (contoh 192.168.1.0/24)", ["cidr"], (q) => {
    const m = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/.exec(need(q.cidr, "cidr"));
    if (!m) throw fail("format harus CIDR, contoh 192.168.1.0/24");
    const prefix = parseInt(m[2], 10);
    if (prefix < 0 || prefix > 32) throw fail("prefix harus 0-32");
    const total = 2 ** (32 - prefix);
    return { cidr: q.cidr, prefix, totalIP: total, hostUsable: Math.max(0, total - 2) };
  });

  add("utility", "cronnext", "Perkiraan beberapa waktu terdekat dari interval menit (bukan parser cron penuh)", ["menit"], (q) => {
    const n = parseInt(q.menit, 10);
    if (!Number.isFinite(n) || n < 1) throw fail("menit harus angka positif");
    const now = Date.now();
    const next = Array.from({ length: 5 }, (_, i) => new Date(now + (i + 1) * n * 60000).toISOString());
    return { intervalMenit: n, berikutnya: next };
  });

  add("utility", "checksum", "Checksum sederhana (bukan kriptografis) buat validasi teks cepat", ["text"], (q) => {
    let h = 0;
    for (const c of need(q.text, "text")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return { checksum: h.toString(16) };
  });

  add("utility", "acaktim", "Bagi daftar nama jadi beberapa tim acak (pisahkan koma)", ["nama", "jumlahtim?"], (q) => {
    const names = need(q.nama, "nama").split(",").map((s) => s.trim()).filter(Boolean);
    const jt = clamp(parseInt(q.jumlahtim || "2", 10) || 2, 2, 10);
    if (names.length < jt) throw fail("jumlah nama harus lebih banyak dari jumlah tim");
    const shuffled = [...names].sort(() => Math.random() - 0.5);
    const tim = Array.from({ length: jt }, () => []);
    shuffled.forEach((n, i) => tim[i % jt].push(n));
    return { jumlahTim: jt, tim };
  });

  add("tools", "parsejson", "Validasi dan rapikan teks JSON, tampilkan error di baris berapa bila rusak", ["json"], (q) => {
    try {
      return { valid: true, hasil: JSON.parse(need(q.json, "json")) };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  });

  add("tools", "ekstrakurl", "Ambil semua link dari sebuah teks panjang", ["text"], (q) => {
    const urls = need(q.text, "text").match(/https?:\/\/[^\s)]+/g) || [];
    return { jumlah: urls.length, url: [...new Set(urls)] };
  });

  add("tools", "ekstraknomor", "Ambil semua nomor HP Indonesia dari sebuah teks panjang", ["text"], (q) => {
    const found = need(q.text, "text").match(/(?:\+?62|0)8[0-9]{8,11}/g) || [];
    const norm = found.map((n) => (n.startsWith("0") ? "62" + n.slice(1) : n.replace("+", "")));
    return { jumlah: norm.length, nomor: [...new Set(norm)] };
  });
};
