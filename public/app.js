/* ---------- Animasi masuk 0% sampai 100% ---------- */
const loader = (() => {
  const el = document.getElementById("loader");
  const html = document.documentElement;
  if (!el) { html.classList.remove("loading"); return { finish() {} }; }
  const num = document.getElementById("loaderNum");
  const fill = document.getElementById("loaderFill");
  const msg = document.getElementById("loaderMsg");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MIN = reduce ? 0 : 1300; // waktu minimal supaya hitungannya sempat terlihat
  const t0 = performance.now();
  let shown = 0, wantFinish = false, closed = false;

  const paint = (v) => {
    const n = Math.min(100, Math.max(0, Math.round(v)));
    num.textContent = n;
    fill.style.width = n + "%";
    el.setAttribute("aria-valuenow", n);
    msg.textContent = n >= 100 ? "Selesai!" : n >= 45 ? "Memuat daftar endpoint..." : "Menyiapkan halaman...";
  };
  const close = () => {
    if (closed) return;
    closed = true;
    paint(100);
    html.classList.remove("loading");
    el.classList.add("done");
    setTimeout(() => (el.hidden = true), 900);
  };
  const tick = (now) => {
    if (closed) return;
    const t = now - t0;
    const finishing = wantFinish && t >= MIN;
    // Sebelum data siap, hitungan melambat mendekati 90%. Begitu siap, langsung dikebut ke 100%.
    const target = finishing ? 100 : 90 * (1 - Math.exp(-t / 900));
    shown += (target - shown) * (finishing ? 0.2 : 0.25);
    if (finishing && 100 - shown < 0.6) shown = 100;
    paint(shown);
    if (shown >= 100) return setTimeout(close, 280);
    requestAnimationFrame(tick);
  };
  paint(0);
  if (reduce) return { finish: close };
  requestAnimationFrame(tick);
  setTimeout(close, 9000); // pengaman: halaman tidak boleh tertahan di layar loading
  return { finish() { wantFinish = true; } };
})();

const LABEL = {
  download: "Downloader", music: "Musik", image: "Gambar", video: "Video", maker: "Maker",
  ai: "AI", search: "Pencarian", info: "Info", stalk: "Profil", tools: "Tools", fun: "Hiburan", utility: "Utility", islami: "Islami", random: "Random", game: "Game", wabot: "Bot WA",
};
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Domain dipakai otomatis mengikuti domain tempat web ini di-deploy (Vercel, domain custom,
// atau localhost saat development) - tidak di-hardcode lagi ke satu URL tertentu.
const base = location.origin;
const clean = (p) => (p.endsWith("?") ? p.slice(0, -1) : p);
const title = (e) => e.name.charAt(0).toUpperCase() + e.name.slice(1);
const catName = (c) => (c === "semua" ? "Semua" : LABEL[c] || c);

let all = [];
let cat = "semua";
let term = "";
let cur = null;

/* ---------- Daftar ---------- */
function render() {
  const t = term.trim().toLowerCase();
  const rows = all.filter((e) => (cat === "semua" || e.cat === cat) && (!t || `${e.name} ${e.desc} ${e.cat} ${e.path}`.toLowerCase().includes(t)));
  if (!rows.length) {
    $("#list").innerHTML = `<p class="empty">Tidak ada endpoint yang cocok. Hapus kata kunci atau pilih kategori lain.</p>`;
    return;
  }
  const groups = {};
  rows.forEach((e) => (groups[e.cat] ||= []).push(e));
  $("#list").innerHTML = Object.entries(groups)
    .map(([c, items]) => `<section><h2 class="group">${esc(catName(c))}</h2><div class="grid">${items
      .map((e) => `<button type="button" class="card" data-path="${esc(e.path)}"><span class="badge">GET/POST</span><h3>${esc(title(e))}</h3><p>${esc(e.desc)}</p><span class="tag ${e.kind}">${e.kind === "ready" ? "Siap dipakai" : "Perlu provider"}</span></button>`)
      .join("")}</div></section>`)
    .join("");
}

function renderCats() {
  const names = ["semua", ...new Set(all.map((e) => e.cat))];
  const html = (extra) => names.map((c) => `<button type="button" data-cat="${c}" aria-pressed="${c === cat}">${esc(catName(c))}${extra(c)}</button>`).join("");
  $("#cats").innerHTML = html(() => "");
  $("#drawerCats").innerHTML = html((c) => ` (${c === "semua" ? all.length : all.filter((e) => e.cat === c).length})`);
}

/* ---------- Modal ---------- */
function field(p) {
  const opt = p.endsWith("?");
  const n = clean(p);
  return `<div class="field"><label for="f-${esc(n)}">${esc(n)}${opt ? "" : ' <span class="req" aria-hidden="true">*</span>'}<svg class="i" role="img" aria-label="${opt ? "Opsional" : "Wajib diisi"}"><title>${opt ? "Opsional" : "Wajib diisi"}</title><use href="#i-info"/></svg></label><input id="f-${esc(n)}" name="${esc(n)}" ${opt ? "" : "required"} autocomplete="off" placeholder="Masukkan ${esc(n)}..."></div>`;
}

function sync() {
  $("#mSend").disabled = !$$("#mForm input[required]").every((i) => i.value.trim());
}

function openModal(e) {
  cur = e;
  $("#mTitle").textContent = title(e);
  $("#mDesc").textContent = e.desc;
  $("#mUrl").textContent = base + e.path;
  $("#mNote").hidden = e.kind !== "provider";
  $("#mParams").innerHTML = e.params.length ? e.params.map(field).join("") : `<p class="muted">Endpoint ini tidak butuh parameter.</p>`;
  const out = $("#mOut");
  out.hidden = true;
  out.innerHTML = "";
  sync();
  $("#modal").showModal();
  $(".mbody").scrollTop = 0;
}

function buildUrl() {
  const u = new URL(cur.path, base);
  new FormData($("#mForm")).forEach((v, k) => v.trim() && u.searchParams.set(k, v.trim()));
  return u.toString();
}

async function copy(text, btn) {
  const html = btn.innerHTML;
  try { await navigator.clipboard.writeText(text); btn.textContent = btn.classList.contains("circle") ? "✓" : "Tersalin"; }
  catch { btn.textContent = "!"; }
  setTimeout(() => (btn.innerHTML = html), 1500);
}

$("#mForm").addEventListener("input", sync);
$("#mCopy").addEventListener("click", (ev) => copy(base + cur.path, ev.currentTarget));
$("#mForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if ($("#mSend").disabled) return;
  const out = $("#mOut");
  const url = buildUrl();
  out.hidden = false;
  const t0 = performance.now();
  const ms = () => Math.round(performance.now() - t0);
  konsolLine("req", `➜ GET ${cur.path} ${Object.keys(cur.params || {}).length ? "(dengan parameter)" : ""}`);
  if (cur.out === "image") {
    out.innerHTML = `<h3>Respons</h3><img alt="Hasil" src="${esc(url)}">`;
    $("img", out).onload = () => konsolLine("ok", `✔ ${cur.path} -> gambar dimuat (${ms()}ms)`);
    $("img", out).onerror = (e) => {
      e.target.replaceWith(Object.assign(document.createElement("p"), { className: "status", textContent: "Gambar gagal dimuat. Periksa parameter lalu coba lagi." }));
      konsolLine("err", `✘ ${cur.path} -> gagal memuat gambar (${ms()}ms)`);
    };
  } else if (cur.out === "video") {
    out.innerHTML = `<h3>Respons</h3><video controls playsinline style="max-width:100%" src="${esc(url)}"></video>`;
    konsolLine("ok", `✔ ${cur.path} -> video siap diputar (${ms()}ms)`);
  } else if (cur.out === "audio") {
    out.innerHTML = `<h3>Respons</h3><audio controls src="${esc(url)}"></audio>`;
    konsolLine("ok", `✔ ${cur.path} -> audio siap diputar (${ms()}ms)`);
  } else {
    out.innerHTML = `<h3>Respons</h3><p class="status">Memuat...</p>`;
    try {
      const r = await fetch(url);
      const txt = await r.text();
      let body = txt;
      try { body = JSON.stringify(JSON.parse(txt), null, 2); } catch {}
      out.innerHTML = `<h3>Respons</h3><p class="status">Status ${r.status}</p><pre>${esc(body)}</pre>`;
      konsolLine(r.ok ? "ok" : "warn", `${r.ok ? "✔" : "⚠"} ${cur.path} -> ${r.status} (${ms()}ms)`);
    } catch {
      out.innerHTML = `<h3>Respons</h3><p class="status">Request gagal. Periksa koneksi lalu coba lagi.</p>`;
      konsolLine("err", `✘ ${cur.path} -> request gagal, cek koneksi (${ms()}ms)`);
    }
  }
  out.scrollIntoView({ block: "nearest", behavior: "smooth" });
});

/* ---------- Log Transmisi Den Den Mushi (console log tiap request) ---------- */
const konsolLog = $("#konsolLog");
const konsolCount = $("#konsolCount");
const konsolDot = $("#konsolDot");
let logEntries = 0;
let idleTimer = null;

function konsolLine(cls, text) {
  const stamp = new Date().toLocaleTimeString("id-ID", { hour12: false });
  const row = document.createElement("p");
  row.className = "ln " + cls;
  row.innerHTML = `<span class="t">[${stamp}]</span> ${esc(text)}`;
  if (konsolLog.querySelector(".empty")) konsolLog.innerHTML = "";
  konsolLog.appendChild(row);
  konsolLog.scrollTop = konsolLog.scrollHeight;
  logEntries++;
  konsolCount.textContent = logEntries;
  konsolDot.classList.remove("idle");
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => konsolDot.classList.add("idle"), 2500);
  // Log yang sama juga dikirim ke console browser (DevTools), bukan cuma panel di halaman.
  console.log(`[DenDenMushi] ${text}`);
}

$("#konsolBar").addEventListener("click", () => {
  const body = $("#konsolBody");
  const open = body.hidden;
  body.hidden = !open;
  $("#konsolBar").setAttribute("aria-expanded", String(open));
});
$("#konsolClear").addEventListener("click", () => {
  konsolLog.innerHTML = `<p class="empty">Belum ada transmisi. Coba salah satu endpoint lewat tombol "Kirim".</p>`;
  logEntries = 0;
  konsolCount.textContent = "0";
});
konsolLog.innerHTML = `<p class="empty">Belum ada transmisi. Coba salah satu endpoint lewat tombol "Kirim".</p>`;

/* ---------- Interaksi umum ---------- */
const drawer = $("#drawer");
const modal = $("#modal");
const panel = $("#bellPanel");
const bell = $("#bellBtn");

function setPanel(open) {
  panel.hidden = !open;
  bell.setAttribute("aria-expanded", String(open));
  if (open) { $("#dot").hidden = true; try { localStorage.setItem("seenNote", "1"); } catch {} }
}

document.addEventListener("click", (ev) => {
  const t = ev.target;
  const c = t.closest("[data-cat]");
  if (c) { cat = c.dataset.cat; renderCats(); render(); if (drawer.open) drawer.close(); return; }
  const card = t.closest(".card");
  if (card) { openModal(all.find((e) => e.path === card.dataset.path)); return; }
  if (t.closest("[data-close]")) { t.closest("dialog").close(); return; }
  if (t === modal || t === drawer) { t.close(); return; }
  if (!t.closest(".bellwrap")) setPanel(false);
});
bell.addEventListener("click", () => setPanel(panel.hidden));
$("#menuBtn").addEventListener("click", () => drawer.showModal());
$("#search").addEventListener("input", (ev) => { term = ev.target.value; render(); });
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") setPanel(false);
  if (ev.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && !document.querySelector("dialog[open]")) {
    ev.preventDefault();
    $("#search").focus();
  }
});
const fab = $("#toTop");
addEventListener("scroll", () => fab.classList.toggle("show", scrollY > 400), { passive: true });
fab.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
try { if (localStorage.getItem("seenNote")) $("#dot").hidden = true; } catch {}

/* ---------- Muat data ---------- */
(async () => {
  fetch("/api/ip").then((r) => r.json()).then((d) => ($("#ip").textContent = d.ip || "Tidak tersedia")).catch(() => ($("#ip").textContent = "Tidak tersedia"));
  try {
    all = (await (await fetch("/api/endpoints")).json()).data;
    $("#total").textContent = all.length;
    renderCats();
    render();
    // Tunggu font siap sebentar saja (maks 1,2 detik) supaya tampilan tidak melompat saat loader menutup.
    await Promise.race([document.fonts ? document.fonts.ready : 0, new Promise((r) => setTimeout(r, 1200))]);
  } catch {
    $("#list").innerHTML = `<p class="empty">Daftar endpoint gagal dimuat. Muat ulang halaman ini.</p>`;
  } finally {
    loader.finish();
  }
})();
