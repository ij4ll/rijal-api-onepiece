// Endpoint batch 2: 100% diproses lokal, tanpa panggil API pihak ketiga.
// Tujuannya supaya endpoint ini TIDAK PERNAH down/mati, beda dengan endpoint
// yang bergantung ke API gratisan orang lain. Banyak dibuat khusus biar enak
// dipakai di script bot WhatsApp (format link wa.me, vcard kontak, dsb).

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

module.exports = ({ add, fail }) => {
  const need = (v, name) => {
    if (!String(v || "").trim()) throw fail(`${name} wajib diisi`);
    return String(v);
  };
  const phoneDigits = (v) => {
    const d = String(v || "").replace(/[^0-9]/g, "");
    if (!d) throw fail("nomor wajib diisi, contoh: 628123456789");
    return d.startsWith("0") ? "62" + d.slice(1) : d;
  };

  /* ---------- Khusus bot WhatsApp ---------- */
  add("wabot", "linkwa", "Buat link wa.me dari nomor HP, dengan pesan opsional", ["nomor", "pesan?"], (q) => {
    const n = phoneDigits(q.nomor);
    const url = q.pesan ? `https://wa.me/${n}?text=${encodeURIComponent(q.pesan)}` : `https://wa.me/${n}`;
    return { nomor: n, link: url };
  });

  add("wabot", "vcard", "Buat file vCard (.vcf) kontak, siap dikirim bot sebagai contact card", ["nama", "nomor"], (q) => {
    const nama = need(q.nama, "nama");
    const n = phoneDigits(q.nomor);
    const vcf = `BEGIN:VCARD\nVERSION:3.0\nN:${nama}\nFN:${nama}\nTEL;type=CELL;type=VOICE;waid=${n}:+${n}\nEND:VCARD`;
    return { nama, nomor: n, vcard: vcf };
  });

  add("wabot", "mentionformat", "Format daftar nomor jadi teks siap dipakai mentions bot (pisahkan koma)", ["nomor"], (q) => {
    const list = need(q.nomor, "nomor").split(",").map((s) => phoneDigits(s)).filter(Boolean);
    if (!list.length) throw fail("nomor wajib diisi, pisahkan koma untuk lebih dari satu");
    return { jumlah: list.length, jid: list.map((n) => `${n}@s.whatsapp.net`), teks: list.map((n) => `@${n}`).join(" ") };
  });

  add("wabot", "groupcheck", "Cek dan rapikan format link grup/channel WhatsApp", ["link"], (q) => {
    const link = need(q.link, "link").trim();
    const g = /chat\.whatsapp\.com\/([A-Za-z0-9]+)/.exec(link);
    const c = /whatsapp\.com\/channel\/([A-Za-z0-9]+)/.exec(link);
    if (g) return { tipe: "grup", kode: g[1], link: `https://chat.whatsapp.com/${g[1]}` };
    if (c) return { tipe: "channel", kode: c[1], link: `https://whatsapp.com/channel/${c[1]}` };
    throw fail("Bukan link grup/channel WhatsApp yang valid");
  });

  add("wabot", "polltext", "Buat teks polling rapi dari daftar opsi (pisahkan |)", ["judul", "opsi"], (q) => {
    const opsi = need(q.opsi, "opsi").split("|").map((s) => s.trim()).filter(Boolean);
    if (opsi.length < 2) throw fail("opsi minimal 2, pisahkan dengan |");
    const emoji = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
    const teks = `📊 *${need(q.judul, "judul")}*\n\n` + opsi.map((o, i) => `${emoji[i] || `${i + 1}.`} ${o}`).join("\n");
    return { judul: q.judul, opsi, teks };
  });

  add("wabot", "sambutan", "Teks sambutan anggota baru grup, siap pakai", ["nama", "grup?"], (q) => ({
    teks: `👋 Selamat datang *${need(q.nama, "nama")}* di grup${q.grup ? ` *${q.grup}*` : ""}!\nJangan lupa baca deskripsi grup dan jaga etika ya 🙏`,
  }));

  /* ---------- Generator teks ---------- */
  add("maker", "strikethrough", "Ubah teks jadi coret (unicode, tampil di WA)", ["text"], (q) => ({
    hasil: [...need(q.text, "text")].map((c) => c + "\u0336").join(""),
  }));

  add("maker", "bold", "Ubah teks jadi tebal unicode", ["text"], (q) => {
    const map = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const bold = "𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵".match(/./gu);
    return { hasil: [...need(q.text, "text")].map((c) => { const i = map.indexOf(c); return i === -1 ? c : bold[i]; }).join("") };
  });

  add("maker", "bubble", "Ubah teks jadi huruf bubble/bulat unicode", ["text"], (q) => {
    const map = "abcdefghijklmnopqrstuvwxyz0123456789";
    const bub = "ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ⓪①②③④⑤⑥⑦⑧⑨".match(/./gu);
    return { hasil: [...need(q.text, "text").toLowerCase()].map((c) => { const i = map.indexOf(c); return i === -1 ? c : bub[i]; }).join("") };
  });

  add("maker", "reverse", "Balik urutan teks", ["text"], (q) => ({ hasil: [...need(q.text, "text")].reverse().join("") }));

  add("maker", "zalgo", "Efek teks horor/glitch (zalgo text)", ["text", "level?"], (q) => {
    const marks = ["\u0300","\u0301","\u0302","\u0303","\u0304","\u0305","\u0306","\u0307","\u0308","\u030a","\u030b","\u030c"];
    const lvl = clamp(parseInt(q.level || "3", 10) || 3, 1, 8);
    return { hasil: [...need(q.text, "text")].map((c) => c + Array.from({ length: lvl }, () => pick(marks)).join("")).join("") };
  });

  add("maker", "typing", "Pecah teks jadi efek ketik per huruf (array tahapan)", ["text"], (q) => {
    const t = need(q.text, "text").slice(0, 100);
    const frames = [];
    for (let i = 1; i <= t.length; i++) frames.push(t.slice(0, i));
    return { total: frames.length, frames };
  });

  /* ---------- Generator & konversi nomor/angka ---------- */
  add("tools", "formatrupiah", "Format angka jadi Rupiah", ["angka"], (q) => {
    const n = Number(String(q.angka || "").replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(n)) throw fail("angka tidak valid");
    return { angka: n, hasil: "Rp" + n.toLocaleString("id-ID") };
  });

  add("tools", "maskemail", "Sembunyikan sebagian alamat email", ["email"], (q) => {
    const e = need(q.email, "email");
    const m = /^(.{1,3}).*@(.*)$/.exec(e);
    if (!m) throw fail("email tidak valid");
    return { asli: e, hasil: `${m[1]}${"*".repeat(Math.max(3, e.split("@")[0].length - m[1].length))}@${m[2]}` };
  });

  add("tools", "masknomor", "Sembunyikan sebagian nomor HP", ["nomor"], (q) => {
    const n = phoneDigits(q.nomor);
    return { asli: n, hasil: n.slice(0, 5) + "*".repeat(Math.max(0, n.length - 7)) + n.slice(-2) };
  });

  add("tools", "otp", "Buat kode OTP acak (angka, default 6 digit)", ["panjang?"], (q) => {
    const len = clamp(parseInt(q.panjang || "6", 10) || 6, 4, 10);
    return { panjang: len, otp: Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join("") };
  });

  add("tools", "referral", "Buat kode referral acak dari nama", ["nama?"], (q) => {
    const base = (q.nama || "USER").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6) || "USER";
    return { kode: base + Math.random().toString(36).slice(2, 6).toUpperCase() };
  });

  add("tools", "invoiceid", "Buat nomor invoice/order unik berdasarkan waktu sekarang", ["prefix?"], (q) => {
    const d = new Date();
    const pad = (n, l = 2) => String(n).padStart(l, "0");
    const id = `${(q.prefix || "INV").toUpperCase()}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${Math.floor(Math.random() * 900 + 100)}`;
    return { invoice: id };
  });

  add("tools", "cicilanbunga", "Hitung cicilan flat per bulan dengan bunga tahunan", ["pokok", "bunga", "bulan"], (q) => {
    const pokok = Number(q.pokok), bunga = Number(q.bunga), bulan = parseInt(q.bulan, 10);
    if (![pokok, bunga, bulan].every(Number.isFinite) || bulan < 1) throw fail("pokok/bunga/bulan tidak valid");
    const totalBunga = pokok * (bunga / 100) * (bulan / 12);
    const perBulan = (pokok + totalBunga) / bulan;
    return { pokok, bungaPersenTahun: bunga, bulan, totalBunga: Math.round(totalBunga), totalBayar: Math.round(pokok + totalBunga), perBulan: Math.round(perBulan) };
  });

  /* ---------- Teks & analisis ---------- */
  add("utility", "slug", "Ubah teks jadi slug URL (huruf-kecil-pakai-strip)", ["text"], (q) => ({
    hasil: need(q.text, "text").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  }));

  add("utility", "titlecase", "Kapitalkan huruf awal tiap kata", ["text"], (q) => ({
    hasil: need(q.text, "text").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()),
  }));

  add("utility", "statistikteks", "Hitung huruf, kata, kalimat, vokal/konsonan dari teks", ["text"], (q) => {
    const t = need(q.text, "text");
    const huruf = (t.match(/[a-zA-Z]/g) || []).length;
    const vokal = (t.match(/[aiueoAIUEO]/g) || []).length;
    return {
      panjang: t.length,
      kata: t.trim().split(/\s+/).filter(Boolean).length,
      kalimat: (t.match(/[.!?]+/g) || []).length || (t.trim() ? 1 : 0),
      huruf, vokal, konsonan: huruf - vokal,
      angka: (t.match(/[0-9]/g) || []).length,
    };
  });

  add("utility", "anagram", "Cek apakah dua teks adalah anagram", ["text1", "text2"], (q) => {
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "").split("").sort().join("");
    const hasil = norm(need(q.text1, "text1")) === norm(need(q.text2, "text2"));
    return { text1: q.text1, text2: q.text2, anagram: hasil };
  });

  add("utility", "leetspeak", "Ubah teks jadi leetspeak (a->4, e->3, dst)", ["text"], (q) => {
    const map = { a: "4", e: "3", i: "1", o: "0", s: "5", t: "7", g: "9", b: "8" };
    return { hasil: [...need(q.text, "text").toLowerCase()].map((c) => map[c] || c).join("") };
  });

  add("utility", "wordfreq", "Hitung frekuensi tiap kata dalam teks", ["text"], (q) => {
    const words = need(q.text, "text").toLowerCase().match(/[a-z0-9]+/g) || [];
    const freq = {};
    for (const w of words) freq[w] = (freq[w] || 0) + 1;
    return { totalKata: words.length, kataUnik: Object.keys(freq).length, frekuensi: freq };
  });

  /* ---------- Generator identitas acak (data fiktif, bukan data asli siapa pun) ---------- */
  add("fun", "namaacak", "Nama fiktif acak Indonesia untuk testing/dummy data", ["gender?"], (q) => {
    const depan = { l: ["Budi", "Agus", "Dedi", "Rizky", "Fajar", "Andi", "Bayu", "Dimas"], p: ["Sri", "Siti", "Dewi", "Putri", "Ayu", "Rina", "Lestari", "Indah"] };
    const belakang = ["Saputra", "Wijaya", "Pratama", "Santoso", "Kusuma", "Hidayat", "Nugroho", "Setiawan"];
    const g = (q.gender || pick(["l", "p"])).toLowerCase().startsWith("p") ? "p" : "l";
    return { gender: g === "p" ? "perempuan" : "laki-laki", nama: `${pick(depan[g])} ${pick(belakang)}` };
  });

  add("fun", "pantun", "Buat pantun acak 4 baris", [], () => {
    const sampiran = ["Jalan-jalan ke kota Blitar", "Beli duku di pinggir jalan", "Pergi pagi membawa payung", "Naik delman keliling kota"];
    const isi = ["Rajin belajar kunci kesuksesan", "Jangan lupa selalu bersyukur", "Hidup tenang hati pun senang", "Teman baik jangan dilupakan"];
    return { pantun: `${pick(sampiran)}\n${pick(sampiran)}\n${pick(isi)}\n${pick(isi)}` };
  });

  add("fun", "shiprate", "Hitung persentase jodoh/cocok dua nama (hasil konsisten untuk pasangan nama yang sama)", ["nama1", "nama2"], (q) => {
    let h = 2166136261;
    for (const c of (need(q.nama1, "nama1") + need(q.nama2, "nama2")).toLowerCase()) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    const persen = (h >>> 0) % 101;
    return { nama1: q.nama1, nama2: q.nama2, persen, komentar: persen > 80 ? "Jodoh banget! 💕" : persen > 50 ? "Lumayan cocok 😄" : persen > 20 ? "Masih perlu usaha 😅" : "Mending temenan aja 😂" };
  });

  /* ---------- Util tambahan ---------- */
  add("tools", "cekpassword", "Nilai kekuatan password (tanpa menyimpan password)", ["password"], (q) => {
    const p = need(q.password, "password");
    let skor = 0;
    if (p.length >= 8) skor++;
    if (p.length >= 12) skor++;
    if (/[A-Z]/.test(p)) skor++;
    if (/[a-z]/.test(p)) skor++;
    if (/[0-9]/.test(p)) skor++;
    if (/[^a-zA-Z0-9]/.test(p)) skor++;
    const label = ["Sangat lemah", "Lemah", "Cukup", "Baik", "Kuat", "Sangat kuat"][clamp(skor, 0, 5)];
    return { panjang: p.length, skor, dariSkor: 6, label };
  });

  add("tools", "validasiemail", "Cek format alamat email valid atau tidak", ["email"], (q) => ({
    email: q.email, valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(need(q.email, "email")),
  }));

  add("tools", "validasinomor", "Cek dan normalkan nomor HP Indonesia", ["nomor"], (q) => {
    const n = phoneDigits(q.nomor);
    return { input: q.nomor, normal: n, valid: /^62(8[1-9])[0-9]{7,10}$/.test(n) };
  });
};
