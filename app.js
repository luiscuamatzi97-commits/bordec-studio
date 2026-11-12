/* Bordec Studio — catálogo con perchero animado y modo de edición */
(() => {
'use strict';

const SB_URL = 'https://wrzptgalxvvonsxfpinr.supabase.co';
const SB_KEY = 'sb_publishable_pG0HYShywO4Mj6cqNJSfDw_w7e15bi1';
const BUCKET = 'web-media';
const sb = window.supabase.createClient(SB_URL, SB_KEY);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const THREADS = ['#2350ff', '#e5322a', '#11a052'];
const NEUTRALS = ['#141414', '#2b2b2b', '#5c5c5c', '#8a8a8a', '#bdbdbd', '#d6d6d6', '#f1f1f1', '#ffffff'];
const ACCENTS = ['#2350ff', '#e5322a', '#11a052'];

const DEF = {
  name: 'Bordec Studio', logo_url: '', eyebrow: 'Taller de bordado y DTF',
  hero_title: 'Ropa con puntada propia.',
  hero_text: 'Playeras, sudaderas, polos y uniformes con bordado o estampado DTF. Escoge una prenda del perchero o mándanos tu diseño.',
  rack_hint: 'Pasa el cursor o desliza el perchero. Toca una prenda para verla.',
  catalog_title: 'Catálogo',
  catalog_text: 'Precios por pieza en MXN. El precio de mayoreo se aplica solo en tu bolsa al llegar a la cantidad mínima.',
  steps_title: 'Cómo pedir',
  step1: 'Arma tu bolsa con las prendas y cantidades que necesitas.',
  step2: 'Envíanos tu pedido por WhatsApp junto con tu logo o diseño.',
  step3: 'Aprobamos el boceto, pagas el anticipo y producimos tu pedido.',
  about: 'Bordamos y estampamos en nuestro taller, pieza por pieza.',
  whatsapp: '', instagram: '', facebook: '', tiktok: '', location: '', hours: '', email: ''
};

let S = { ...DEF };
let P = [];
let isAdmin = false, editing = false, preview = false;
let cat = 'Todas';
let bag = [];
try { bag = JSON.parse(localStorage.getItem('bordec_bag') || '[]'); } catch (e) { bag = []; }
const saveBag = () => { try { localStorage.setItem('bordec_bag', JSON.stringify(bag)); } catch (e) {} };

/* ---------------- Utilities ---------------- */
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
function lum(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 0;
  const n = parseInt(m[1], 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
}
function toast(msg, err) {
  const t = $('#toast'); t.textContent = msg; t.classList.toggle('err', !!err); t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3200);
}
function waNumber() {
  let d = String(S.whatsapp || '').replace(/\D/g, '');
  if (d.length === 10) d = '52' + d;
  return d;
}
function waLink(text) {
  const n = waNumber();
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : '';
}
function unitPrice(p, q) {
  return p.wholesale_price && p.wholesale_min && q >= p.wholesale_min ? Number(p.wholesale_price) : Number(p.price);
}
function decoOf(p) {
  if (p.image_url) return 'image';
  return /bordad/i.test(p.category + ' ' + p.name) ? 'emb' : 'dtf';
}

/* ---------------- Garment drawing ---------------- */
const SHAPES = {
  tee: 'M62 46 L30 58 L8 100 L34 112 L46 92 L46 262 Q100 268 154 262 L154 92 L166 112 L192 100 L170 58 L138 46 Q100 70 62 46 Z',
  oversized: 'M58 46 L22 62 L4 126 L36 134 L42 106 L40 274 Q100 280 160 274 L158 106 L164 134 L196 126 L178 62 L142 46 Q100 70 58 46 Z',
  longsleeve: 'M62 46 L30 58 L12 214 L36 218 L48 104 L46 262 Q100 268 154 262 L152 104 L164 218 L188 214 L170 58 L138 46 Q100 70 62 46 Z',
  crewneck: 'M60 46 L26 60 L8 222 L36 226 L46 108 L44 258 L156 258 L154 108 L164 226 L192 222 L174 60 L140 46 Q100 70 60 46 Z',
  polo: 'M62 46 L30 58 L8 100 L34 112 L46 92 L46 262 Q100 268 154 262 L154 92 L166 112 L192 100 L170 58 L138 46 Q100 70 62 46 Z'
};
SHAPES.hoodie = SHAPES.crewneck;
SHAPES.shirt = SHAPES.longsleeve;
SHAPES['shirt-short'] = SHAPES.tee;

function garmentSVG(p, opt = {}) {
  const g = p.garment || 'tee';
  const color = p.color || '#141414';
  const dark = lum(color) < 110;
  const edge = dark ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.22)';
  const seam = dark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.28)';
  const thread = THREADS[hash(p.id || p.name) % 3];
  const uid = 'c' + Math.random().toString(36).slice(2, 8);
  const hook = `<path d="M100 27 V17 C100 9 108 5 112 10 C115 14 111 18 108 16" fill="none" stroke="#6f6f6f" stroke-width="3" stroke-linecap="round"/>`;
  const bar = `<path d="M100 27 L54 47 Q49 51 55 51 L145 51 Q151 51 146 47 Z" fill="none" stroke="#7a7a7a" stroke-width="3" stroke-linejoin="round"/>`;
  const clip = `<path d="M100 27 V17 C100 9 108 5 112 10 C115 14 111 18 108 16" fill="none" stroke="#6f6f6f" stroke-width="3" stroke-linecap="round"/><path d="M60 30 H140" stroke="#7a7a7a" stroke-width="3" stroke-linecap="round"/><rect x="62" y="28" width="14" height="16" rx="2" fill="#3a3a3a"/><rect x="124" y="28" width="14" height="16" rx="2" fill="#3a3a3a"/><path d="M100 27 V30" stroke="#7a7a7a" stroke-width="3"/>`;
  let body = '', extra = '', deco = '', tag = '';

  if (g === 'sheet' || g === 'photo') {
    if (g === 'photo' && p.image_url) {
      body = `<clipPath id="${uid}"><rect x="34" y="36" width="132" height="196" rx="3"/></clipPath><rect x="34" y="36" width="132" height="196" rx="3" fill="#fff"/><image href="${esc(p.image_url)}" x="34" y="36" width="132" height="196" preserveAspectRatio="xMidYMid slice" clip-path="url(#${uid})"/>`;
    } else {
      const dots = [];
      const cols = [thread, '#141414', '#8a8a8a', THREADS[(hash(p.id) + 1) % 3], '#d0d0d0', '#141414'];
      let k = 0;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
        const cx = 66 + c * 34, cy = 78 + r * 38, col = cols[(k++) % cols.length];
        dots.push(r % 2 === c % 2
          ? `<circle cx="${cx}" cy="${cy}" r="12" fill="${col}"/><circle cx="${cx}" cy="${cy}" r="15" fill="none" stroke="#bbb" stroke-dasharray="2 2"/>`
          : `<rect x="${cx - 12}" y="${cy - 12}" width="24" height="24" rx="6" fill="${col}"/><rect x="${cx - 15}" y="${cy - 15}" width="30" height="30" rx="8" fill="none" stroke="#bbb" stroke-dasharray="2 2"/>`);
      }
      body = `<rect x="40" y="36" width="120" height="176" rx="2" fill="#fff" stroke="rgba(0,0,0,.12)"/>${p.image_url ? `<clipPath id="${uid}"><rect x="46" y="44" width="108" height="160"/></clipPath><image href="${esc(p.image_url)}" x="46" y="44" width="108" height="160" preserveAspectRatio="xMidYMid meet" clip-path="url(#${uid})"/>` : dots.join('')}<path d="M40 212 H160" stroke="rgba(0,0,0,.08)"/>`;
    }
    if (opt.tag) tag = priceTag(p, 150, 200, 6);
    return `<svg viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(p.name)}">${clip}${body}${tag}</svg>`;
  }

  const d = SHAPES[g] || SHAPES.tee;
  const big = g === 'oversized';
  // hood lies flat behind the neckline
  if (g === 'hoodie') {
    extra += `<path d="M58 54 Q60 32 100 30 Q140 32 142 54 Q100 80 58 54 Z" fill="${color}" stroke="${edge}"/><path d="M58 54 Q60 32 100 30 Q140 32 142 54 Q100 80 58 54 Z" fill="url(#drape)"/><path d="M68 54 Q72 40 100 39 Q128 40 132 54" fill="none" stroke="${seam}" stroke-width="1.2"/>`;
  }
  let over = `<path d="${g === 'hoodie' ? 'M66 50 Q100 74 134 50' : 'M62 46 Q100 70 138 46'}" fill="none" stroke="${seam}" stroke-width="2"/>`;
  if (g === 'hoodie') {
    over += `<path d="M92 66 V112 M108 66 V112" stroke="${dark ? '#d9d9d9' : '#3a3a3a'}" stroke-width="2" stroke-linecap="round"/><path d="M66 196 H134 L146 244 H54 Z" fill="none" stroke="${seam}" stroke-width="1.5"/>`;
  }
  if (g === 'crewneck' || g === 'hoodie') {
    over += `<path d="M44 248 H156 M10 212 L36 216 M190 212 L164 216" stroke="${seam}" stroke-width="1.5"/>`;
  }
  if (g === 'longsleeve' || g === 'shirt') over += `<path d="M14 202 L37 206 M186 202 L163 206" stroke="${seam}" stroke-width="1.5"/>`;
  if (g === 'polo' || g === 'shirt' || g === 'shirt-short') {
    const cc = dark ? '#1d1d1d' : '#fafafa';
    over += `<path d="M64 46 L100 72 L84 92 L58 56 Z" fill="${cc}" stroke="${seam}" stroke-width="1.4"/><path d="M136 46 L100 72 L116 92 L142 56 Z" fill="${cc}" stroke="${seam}" stroke-width="1.4"/>`;
    const len = g === 'polo' ? 118 : 258;
    over += `<path d="M100 72 V${len}" stroke="${seam}" stroke-width="1.4"/>`;
    const bc = dark ? '#cfcfcf' : '#3a3a3a';
    for (let y = 92; y < len; y += (g === 'polo' ? 14 : 30)) over += `<circle cx="104" cy="${y}" r="2.4" fill="${bc}"/>`;
  }

  const chestY = big ? 104 : 96;
  if (decoOf(p) === 'image') {
    const w = big ? 82 : 70, h = big ? 92 : 80, x = 100 - w / 2;
    deco = `<clipPath id="${uid}"><rect x="${x}" y="${chestY}" width="${w}" height="${h}"/></clipPath><image href="${esc(p.image_url)}" x="${x}" y="${chestY}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${uid})"/>`;
    if (g === 'polo' || g === 'shirt' || g === 'shirt-short') deco = `<clipPath id="${uid}"><rect x="112" y="${chestY + 6}" width="30" height="30"/></clipPath><image href="${esc(p.image_url)}" x="112" y="${chestY + 6}" width="30" height="30" preserveAspectRatio="xMidYMid meet" clip-path="url(#${uid})"/>`;
  } else if (decoOf(p) === 'emb') {
    const cx = 126, cy = chestY + 18;
    deco = `<circle cx="${cx}" cy="${cy}" r="13" fill="none" stroke="${thread}" stroke-width="3" stroke-dasharray="2.2 1.6"/><path d="M${cx - 5} ${cy + 5} L${cx} ${cy - 6} L${cx + 5} ${cy + 5}" fill="none" stroke="${thread}" stroke-width="2.2" stroke-linejoin="round"/>`;
  } else {
    const w = big ? 60 : 50, x = 100 - w / 2, y = chestY + 4;
    const ink = dark ? '#f1f1f1' : '#141414', base = dark ? '#141414' : '#f1f1f1';
    deco = `<rect x="${x}" y="${y}" width="${w}" height="${w}" rx="3" fill="${ink}"/><circle cx="${x + w * .62}" cy="${y + w * .4}" r="${w * .17}" fill="${thread}"/><path d="M${x + 7} ${y + w - 9} H${x + w * .55}" stroke="${base}" stroke-width="3" stroke-linecap="round"/><path d="M${x + 7} ${y + w - 16} H${x + w * .38}" stroke="${base}" stroke-width="3" stroke-linecap="round"/>`;
  }
  if (opt.tag) tag = priceTag(p, big ? 160 : 154, big ? 108 : 96, 0);

  return `<svg viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(p.name)}">${hook}${extra}<path d="${d}" fill="${color}" stroke="${edge}" stroke-width="1.2" stroke-linejoin="round"/><path d="${d}" fill="url(#fold)"/><path d="${d}" fill="url(#drape)"/>${over}${deco}${bar}${tag}</svg>`;
}
function priceTag(p, x, y, dy) {
  const label = Number(p.price) > 0 ? fmt(p.price) : 'Cotizar';
  const w = Math.max(44, label.length * 7.4 + 14);
  const tx = x + 6, ty = y + 44 + dy;
  return `<g class="tag"><path d="M${x} ${y} L${tx + 10} ${ty}" stroke="#9a9a9a" stroke-width="1"/><g transform="rotate(8 ${tx + 10} ${ty})"><rect x="${tx}" y="${ty}" width="${w}" height="24" rx="3" fill="#fff" stroke="rgba(0,0,0,.18)"/><circle cx="${tx + 8}" cy="${ty + 12}" r="2" fill="#bbb"/><text x="${tx + 15}" y="${ty + 16}" font-family="Geist Mono, ui-monospace, monospace" font-size="11" font-weight="500" fill="#0e0e0e">${esc(label)}</text></g></g>`;
}

/* ---------------- Settings / text ---------------- */
function applySettings() {
  $$('[data-k]').forEach(el => {
    const k = el.dataset.k;
    if (document.activeElement === el) return;
    el.textContent = S[k] ?? DEF[k] ?? '';
  });
  document.title = S.name || DEF.name;
  const logo = $('#logo');
  if (S.logo_url) { logo.src = S.logo_url; logo.alt = S.name; logo.hidden = false; $('#wordmark').hidden = true; }
  else { logo.hidden = true; $('#wordmark').hidden = false; }
  $('#year').textContent = new Date().getFullYear();

  const wa = waLink(`Hola ${S.name}, quiero información sobre sus prendas.`);
  const fw = $('#footWa');
  fw.hidden = !wa; if (wa) fw.href = wa;
  const hw = $('#heroWa');
  hw.hidden = !wa; if (wa) hw.href = waLink(`Hola ${S.name}, quiero cotizar un pedido.`);

  const rows = [];
  if (S.whatsapp) rows.push(['WhatsApp', `<a href="${esc(wa)}" target="_blank" rel="noopener">${esc(S.whatsapp)}</a>`]);
  if (S.instagram) rows.push(['Instagram', link(S.instagram)]);
  if (S.facebook) rows.push(['Facebook', link(S.facebook)]);
  if (S.tiktok) rows.push(['TikTok', link(S.tiktok)]);
  if (S.email) rows.push(['Correo', `<span>${esc(S.email)}</span>`]);
  if (S.location) rows.push(['Ubicación', esc(S.location)]);
  if (S.hours) rows.push(['Horario', esc(S.hours)]);
  if (!rows.length) rows.push(['Contacto', isAdmin ? 'Agrega tu WhatsApp y redes en «Logo y contacto».' : 'Pronto publicaremos nuestros datos de contacto.']);
  $('#footList').innerHTML = rows.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
}
function link(u) {
  const url = /^https?:\/\//i.test(u) ? u : 'https://' + u.replace(/^@/, 'instagram.com/');
  const label = u.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
  return `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`;
}
function renderFacts() {
  const vis = P.filter(p => p.visible);
  const cats = new Set(vis.map(p => p.category));
  const mins = vis.map(p => p.wholesale_min).filter(Boolean);
  const from = vis.filter(p => Number(p.price) > 0).map(p => Number(p.price));
 const tees = vis.filter(p => /playera/i.test(p.name) && Number(p.price) > 0).map(p => Number(p.price));
  const f = [
    ['Playeras desde', tees.length ? fmt(Math.min(...tees)) : (from.length ? fmt(Math.min(...from)) : '—')],
    ['Técnicas', 'Bordado · DTF'],
  ];
  if (mins.length) f.push(['Mayoreo', `desde ${Math.min(...mins)} pzs`]);
  $('#facts').innerHTML = f.map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join('');
}

/* ---------------- Rack physics ---------------- */
const K = 30, DAMP = 1.5, MAXA = 26;
let H = [], raf = 0, last = 0, hoverIdx = -1;
const scroller = $('#rackScroll'), track = $('#rackTrack');

function renderRack() {
  $$('.hg', track).forEach(n => n.remove());
  const items = P.filter(p => p.on_rack && (p.visible || (editing && !preview))).sort(bySort);
  H = items.map((p, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'hg' + (p.visible ? '' : ' hg-hidden'); b.dataset.id = p.id;
    b.setAttribute('aria-label', `${p.name}, ${Number(p.price) > 0 ? fmt(p.price) : 'cotizar'}`);
    b.innerHTML = `<span class="hg-shift"><span class="hg-swing">${garmentSVG(p, { tag: true })}</span></span>`;
    track.appendChild(b);
    return { p, el: b, shift: b.firstChild, swing: b.firstChild.firstChild, a: 0, v: 0, sx: 0, tx: 0, psv: 0, rate: 12, delay: 0 };
  });
  if (!items.length) {
    const e = document.createElement('p'); e.className = 'hg empty'; e.style.cssText = 'width:auto;margin:60px 0 40px;cursor:default';
    e.textContent = editing ? 'Activa «Colgar en el perchero» en una prenda para verla aquí.' : 'Pronto colgaremos prendas aquí.';
    track.appendChild(e);
  }
  intro();
}
function bySort(a, b) { return (a.sort - b.sort) || a.name.localeCompare(b.name); }

function intro() {
  if (RM.matches) { H.forEach(h => { h.sx = h.tx = 0; apply(h); }); return; }
  const now = performance.now();
  const vw = Math.max(window.innerWidth, 600);
  H.forEach((h, i) => {
    h.sx = vw * 0.9 + i * 30; h.tx = 0; h.rate = 4.2; h.delay = now + i * 70; h.a = -8; h.v = 0; h.psv = 0;
    apply(h);
  });
  kick();
}
function apply(h) {
  h.shift.style.transform = `translate3d(${h.sx.toFixed(2)}px,0,0)`;
  h.swing.style.transform = `rotate(${h.a.toFixed(3)}deg)`;
}
function tick(t) {
  const dt = Math.min(0.034, Math.max(0.001, (t - last) / 1000)); last = t;
  let active = false;
  for (const h of H) {
    if (h.delay && t < h.delay) { active = true; continue; }
    h.delay = 0;
    const prev = h.sx;
    h.sx += (h.tx - h.sx) * Math.min(1, dt * h.rate);
    if (Math.abs(h.tx - h.sx) < 0.05) { h.sx = h.tx; if (h.rate < 12) h.rate = 12; }
    const sv = (h.sx - prev) / dt;
    h.v += (sv - h.psv) * 0.11; h.psv = sv;
    const acc = -K * h.a - DAMP * h.v;
    h.v += acc * dt; h.a += h.v * dt;
    if (h.a > MAXA) { h.a = MAXA; h.v *= -0.3; } else if (h.a < -MAXA) { h.a = -MAXA; h.v *= -0.3; }
    apply(h);
    if (Math.abs(h.a) > 0.03 || Math.abs(h.v) > 0.05 || h.sx !== h.tx) active = true;
  }
  raf = active ? requestAnimationFrame(tick) : 0;
  if (!active) track.classList.remove('live');
}
function kick() { if (RM.matches) return; if (!raf) { track.classList.add('live'); last = performance.now(); raf = requestAnimationFrame(tick); } }
function nudge(i, dv) { const h = H[i]; if (!h) return; h.v = Math.max(-260, Math.min(260, h.v + dv)); }

function part(i) {
  hoverIdx = i;
  H.forEach((h, j) => {
    const d = j - i;
    h.tx = i < 0 || d === 0 ? 0 : Math.sign(d) * (34 / Math.abs(d) + 6) * (Math.abs(d) <= 3 ? 1 : 0);
  });
  kick();
}
function caption(p) {
  const c = $('#rackCaption');
  if (!p) { c.innerHTML = `<span data-k="rack_hint">${esc(S.rack_hint)}</span>`; if (editing) bindEditable(c.firstChild); return; }
  const ws = p.wholesale_price && p.wholesale_min ? ` · mayoreo ${fmt(p.wholesale_price)} desde ${p.wholesale_min} pzs` : '';
  c.innerHTML = `<b>${esc(p.name)}</b><span class="mono">${Number(p.price) > 0 ? fmt(p.price) : 'Cotizar'}</span><span class="meta-hide">${esc(ws)}</span>`;
}

let lastPX = null, lastPT = 0;
scroller.addEventListener('pointermove', e => {
  const now = performance.now();
  if (lastPX !== null && !RM.matches) {
    const vx = (e.clientX - lastPX) / Math.max(8, now - lastPT) * 1000;
    for (let i = 0; i < H.length; i++) {
      const r = H[i].el.getBoundingClientRect();
      const cx = r.left + r.width / 2, half = r.width * 0.55;
      const dist = Math.abs(e.clientX - cx);
      if (dist < half && e.clientY > r.top + 40) nudge(i, -vx * 0.035 * (1 - dist / half));
    }
    kick();
  }
  lastPX = e.clientX; lastPT = now;
  const el = e.target.closest('.hg');
  const i = el ? H.findIndex(h => h.el === el) : -1;
  if (e.pointerType === 'mouse' && i !== hoverIdx && !drag.on) { part(i); caption(i >= 0 ? H[i].p : null); }
});
scroller.addEventListener('pointerleave', () => { lastPX = null; if (hoverIdx !== -1) { part(-1); caption(null); } });
track.addEventListener('focusin', e => {
  const el = e.target.closest('.hg'); const i = H.findIndex(h => h.el === el);
  if (i >= 0) { part(i); caption(H[i].p); nudge(i, 60); kick(); }
});
track.addEventListener('focusout', () => { part(-1); });

let lastScroll = 0;
scroller.addEventListener('scroll', () => {
  const dx = scroller.scrollLeft - lastScroll; lastScroll = scroller.scrollLeft;
  if (RM.matches || !dx) return;
  const dv = Math.max(-40, Math.min(40, dx)) * -2.2;
  H.forEach((h, i) => nudge(i, dv * (0.75 + (i % 3) * 0.15)));
  kick();
}, { passive: true });

const drag = { on: false, x: 0, s: 0, moved: false };
scroller.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse' || e.button !== 0) return;
  drag.on = true; drag.x = e.clientX; drag.s = scroller.scrollLeft; drag.moved = false;
});
window.addEventListener('pointermove', e => {
  if (!drag.on) return;
  const dx = e.clientX - drag.x;
  if (Math.abs(dx) > 5) { drag.moved = true; scroller.classList.add('dragging'); }
  if (drag.moved) scroller.scrollLeft = drag.s - dx;
});
const endDrag = () => { drag.on = false; scroller.classList.remove('dragging'); };
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);
window.addEventListener('blur', endDrag);
track.addEventListener('click', e => {
  if (drag.moved) { e.preventDefault(); e.stopPropagation(); drag.moved = false; return; }
  const el = e.target.closest('.hg'); if (!el || !el.dataset.id) return;
  const i = H.findIndex(h => h.el === el); nudge(i, 140); kick();
  openProduct(el.dataset.id);
}, true);
$('#rackPrev').addEventListener('click', () => scroller.scrollBy({ left: -scroller.clientWidth * 0.7, behavior: RM.matches ? 'auto' : 'smooth' }));
$('#rackNext').addEventListener('click', () => scroller.scrollBy({ left: scroller.clientWidth * 0.7, behavior: RM.matches ? 'auto' : 'smooth' }));
scroller.addEventListener('keydown', e => {
  if (e.target !== scroller) return;
  if (e.key === 'ArrowRight') { scroller.scrollBy({ left: 200 }); e.preventDefault(); }
  if (e.key === 'ArrowLeft') { scroller.scrollBy({ left: -200 }); e.preventDefault(); }
});

/* ---------------- Catalog ---------------- */
function renderCatalog() {
  const list = P.filter(p => p.visible || (editing && !preview)).sort((a, b) => a.category.localeCompare(b.category) || bySort(a, b));
  const counts = {};
  list.forEach(p => counts[p.category] = (counts[p.category] || 0) + 1);
  const cats = ['Todas', ...Object.keys(counts).sort((a, b) => a.localeCompare(b))];
  if (!cats.includes(cat)) cat = 'Todas';
  $('#chips').innerHTML = cats.map(c => `<button class="chip" type="button" aria-pressed="${c === cat}" data-cat="${esc(c)}">${esc(c)}<span class="n">${c === 'Todas' ? list.length : counts[c]}</span></button>`).join('');
  const shown = cat === 'Todas' ? list : list.filter(p => p.category === cat);
  $('#grid').innerHTML = shown.length ? shown.map(card).join('') :
    `<div class="empty"><p>${editing ? 'Aún no hay prendas. Usa «+ Prenda» para agregar la primera.' : 'No hay prendas en esta categoría.'}</p></div>`;
  $('#catList').innerHTML = Object.keys(counts).map(c => `<option value="${esc(c)}">`).join('');
}
function card(p) {
  const ws = p.wholesale_price && p.wholesale_min ? `<span class="card-ws">Mayoreo ${fmt(p.wholesale_price)} · ${p.wholesale_min}+ pzs</span>` : '';
  return `<article class="card">
    <div class="card-visual" data-open="${p.id}" role="button" tabindex="0" aria-label="Ver ${esc(p.name)}">
      ${p.badge ? `<span class="card-badge">${esc(p.badge)}</span>` : ''}${p.visible ? '' : '<span class="card-hidden">Oculta</span>'}
      ${garmentSVG(p)}
    </div>
    <div class="card-body">
      <span class="card-cat">${esc(p.category)}</span>
      <span class="card-name">${esc(p.name)}</span>
      ${ws}
      <div class="card-row">
        <span class="card-price">${Number(p.price) > 0 ? fmt(p.price) : 'Cotizar'}</span>
        ${editing && !preview ? `<button class="btn btn-outline card-add" type="button" data-edit="${p.id}">Editar</button>` : `<button class="btn btn-outline card-add" type="button" data-add="${p.id}">Agregar</button>`}
      </div>
    </div>
  </article>`;
}
$('#chips').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (!b) return; cat = b.dataset.cat; renderCatalog(); });
$('#grid').addEventListener('click', e => {
  const o = e.target.closest('[data-open]'), a = e.target.closest('[data-add]'), ed = e.target.closest('[data-edit]');
  if (ed) return openEditor(ed.dataset.edit);
  if (a) { addToBag(a.dataset.add, 1); return; }
  if (o) openProduct(o.dataset.open);
});
$('#grid').addEventListener('keydown', e => {
  const o = e.target.closest('[data-open]');
  if (o && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openProduct(o.dataset.open); }
});

/* ---------------- Product detail ---------------- */
let cur = null;
function openProduct(id) {
  if (editing && !preview) return openEditor(id);
  const p = P.find(x => x.id === id); if (!p) return;
  cur = p;
  $('#pdVisual').innerHTML = garmentSVG(p);
  $('#pdCat').textContent = p.category;
  $('#pdName').textContent = p.name;
  $('#pdBadge').hidden = !p.badge; $('#pdBadge').textContent = p.badge || '';
  $('#pdDesc').textContent = p.description || '';
  $('#pdPrice').textContent = Number(p.price) > 0 ? fmt(p.price) + ' por pieza' : 'Precio a cotizar';
  $('#pdWs').textContent = p.wholesale_price && p.wholesale_min ? `Mayoreo: ${fmt(p.wholesale_price)} por pieza desde ${p.wholesale_min} piezas` : '';
  const inBag = bag.find(b => b.id === id);
  $('#pdQty').value = inBag ? inBag.q : 1;
  pdTotal();
  const wa = waLink(`Hola ${S.name}, me interesa: ${p.name}${Number(p.price) > 0 ? ' (' + fmt(p.price) + ')' : ''}. ¿Me das más información?`);
  $('#pdWa').hidden = !wa; if (wa) $('#pdWa').href = wa;
  $('#dlgProduct').showModal();
}
function pdTotal() {
  const q = Math.max(1, parseInt($('#pdQty').value, 10) || 1);
  if (!cur || !(Number(cur.price) > 0)) { $('#pdTotal').textContent = ''; return; }
  const u = unitPrice(cur, q);
  $('#pdTotal').textContent = `${q} × ${fmt(u)} = ${fmt(u * q)}${u < cur.price ? ' (mayoreo)' : ''}`;
}
$('#pdQty').addEventListener('input', pdTotal);
$('#pdMinus').addEventListener('click', () => { $('#pdQty').value = Math.max(1, (+$('#pdQty').value || 1) - 1); pdTotal(); });
$('#pdPlus').addEventListener('click', () => { $('#pdQty').value = (+$('#pdQty').value || 0) + 1; pdTotal(); });
$('#pdAdd').addEventListener('click', () => {
  const q = Math.max(1, parseInt($('#pdQty').value, 10) || 1);
  const it = bag.find(b => b.id === cur.id);
  if (it) it.q = q; else bag.push({ id: cur.id, q });
  saveBag(); renderBag(); $('#dlgProduct').close(); toast(`Agregaste ${cur.name} a tu bolsa`);
});

/* ---------------- Bag ---------------- */
function addToBag(id, q) {
  const p = P.find(x => x.id === id); if (!p) return;
  const it = bag.find(b => b.id === id);
  if (it) it.q += q; else bag.push({ id, q });
  saveBag(); renderBag(); toast(`Agregaste ${p.name} a tu bolsa`);
}
function bagLines() {
  return bag.map(b => ({ ...b, p: P.find(x => x.id === b.id) })).filter(b => b.p);
}
function renderBag() {
  const L = bagLines();
  const n = L.reduce((s, b) => s + b.q, 0);
  $('#bagCount').textContent = n; $('#bagCount').classList.toggle('has', n > 0);
  $('#bagList').innerHTML = L.length ? L.map(b => {
    const u = unitPrice(b.p, b.q), isWs = u < b.p.price;
    const need = b.p.wholesale_min && !isWs && Number(b.p.price) > 0 ? ` · mayoreo con ${b.p.wholesale_min - b.q} más` : '';
    return `<div class="bag-item">
      <div class="bag-thumb">${garmentSVG(b.p)}</div>
      <div><p class="bag-name">${esc(b.p.name)}</p><p class="bag-meta">${Number(b.p.price) > 0 ? `<span class="${isWs ? 'ws' : ''}">${fmt(u)} c/u${isWs ? ' mayoreo' : ''}</span>${need}` : 'A cotizar'}</p>
        <button class="bag-rm" type="button" data-rm="${b.id}">Quitar</button></div>
      <div class="bag-qty"><button class="iconbtn" type="button" data-q="${b.id}" data-d="-1" aria-label="Quitar una">−</button><span>${b.q}</span><button class="iconbtn" type="button" data-q="${b.id}" data-d="1" aria-label="Agregar una">+</button></div>
    </div>`;
  }).join('') : `<div class="empty"><p>Tu bolsa está vacía.</p><p class="form-help">Toca una prenda del perchero o del catálogo y agrégala aquí. Al final envías el pedido por WhatsApp.</p><a class="btn btn-dark" href="#catalogo" data-close-bag style="margin-top:14px">Ver catálogo</a></div>`;
  $('#bagFoot').hidden = !L.length;
  const total = L.reduce((s, b) => s + unitPrice(b.p, b.q) * b.q, 0);
  $('#bagTotal').textContent = fmt(total) + (L.some(b => !(Number(b.p.price) > 0)) ? ' + cotización' : '');
  updateSend();
}
function orderText() {
  const L = bagLines();
  const lines = L.map(b => {
    const u = unitPrice(b.p, b.q);
    return `• ${b.q} × ${b.p.name}${Number(b.p.price) > 0 ? ` — ${fmt(u)} c/u = ${fmt(u * b.q)}${u < b.p.price ? ' (mayoreo)' : ''}` : ' — a cotizar'}`;
  });
  const total = L.reduce((s, b) => s + unitPrice(b.p, b.q) * b.q, 0);
  const name = $('#bagName').value.trim(), notes = $('#bagNotes').value.trim();
  return `Hola ${S.name}, quiero hacer este pedido:\n\n${lines.join('\n')}\n\nTotal estimado: ${fmt(total)}${notes ? `\n\nDetalles: ${notes}` : ''}${name ? `\n\nSoy ${name}.` : ''}`;
}
function updateSend() {
  const wa = waLink(orderText());
  const a = $('#bagSend');
  if (wa) { a.href = wa; a.removeAttribute('aria-disabled'); $('#bagErr').hidden = true; }
  else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); $('#bagErr').hidden = false; $('#bagErr').textContent = isAdmin ? 'Agrega tu número de WhatsApp en «Logo y contacto» para recibir pedidos.' : 'Pronto podrás enviar tu pedido por WhatsApp desde aquí.'; }
}
$('#bagName').addEventListener('input', updateSend);
$('#bagNotes').addEventListener('input', updateSend);
$('#bagList').addEventListener('click', e => {
  const q = e.target.closest('[data-q]'), rm = e.target.closest('[data-rm]');
  if (e.target.closest('[data-close-bag]')) { $('#dlgBag').close(); return; }
  if (q) { const it = bag.find(b => b.id === q.dataset.q); it.q += +q.dataset.d; if (it.q < 1) bag = bag.filter(b => b !== it); }
  else if (rm) bag = bag.filter(b => b.id !== rm.dataset.rm);
  else return;
  saveBag(); renderBag();
});
$('#bagBtn').addEventListener('click', () => { renderBag(); $('#dlgBag').showModal(); });

/* ---------------- Dialog helpers ---------------- */
$$('dialog').forEach(d => {
  d.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) d.close();
    else if (e.target === d) d.close();
  });
});

/* ---------------- Data ---------------- */
async function load() {
  const [s, p] = await Promise.all([
    sb.from('web_settings').select('data').eq('id', 1).maybeSingle(),
    sb.from('web_products').select('*').order('sort')
  ]);
  if (s.data && s.data.data) S = { ...DEF, ...s.data.data };
  if (p.error) { $('#grid').innerHTML = '<p class="empty">No pudimos cargar el catálogo. Revisa tu conexión y recarga la página.</p>'; }
  P = (p.data || []).map(x => ({ ...x, price: Number(x.price), wholesale_price: x.wholesale_price == null ? null : Number(x.wholesale_price) }));
  renderAll();
}
function renderAll() { applySettings(); renderFacts(); renderRack(); renderCatalog(); renderBag(); }

/* ---------------- Admin: auth ---------------- */
async function checkSession() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return setAdmin(false);
  const { data: ok } = await sb.rpc('is_web_admin');
  setAdmin(!!ok);
}
function setAdmin(on) {
  isAdmin = on; editing = on && !preview;
  document.body.classList.toggle('editing', editing);
  $('#adminbar').hidden = !on;
  $('#adminLink').textContent = on ? 'Estás en modo edición' : 'Acceso para el taller';
  $$('[data-k]').forEach(el => editing ? bindEditable(el) : unbindEditable(el));
  if (P.length || on) { renderRack(); renderCatalog(); applySettings(); updateSend(); }
}
$('#adminLink').addEventListener('click', () => { if (!isAdmin) { $('#lgErr').hidden = true; $('#dlgLogin').showModal(); } });
if (location.hash === '#admin') setTimeout(() => !isAdmin && $('#dlgLogin').showModal(), 400);
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('#lgEmail').value.trim(), password = $('#lgPass').value;
  const err = $('#lgErr');
  if (!email || !password) { err.hidden = false; err.textContent = 'Escribe tu correo y tu contraseña.'; return; }
  $('#lgBtn').textContent = 'Entrando…';
  const { error } = await sb.auth.signInWithPassword({ email, password });
  $('#lgBtn').textContent = 'Entrar a editar';
  if (error) { err.hidden = false; err.textContent = 'El correo o la contraseña no coinciden. Usa los mismos datos de tu dashboard.'; return; }
  const { data: ok } = await sb.rpc('is_web_admin');
  if (!ok) { await sb.auth.signOut(); err.hidden = false; err.textContent = 'Esta cuenta no tiene permiso para editar la página.'; return; }
  $('#dlgLogin').close(); $('#lgPass').value = '';
  await load(); setAdmin(true); toast('Listo. Ya puedes editar tu página.');
});
$('#aOut').addEventListener('click', async () => { await sb.auth.signOut(); preview = false; setAdmin(false); await load(); toast('Saliste del modo edición'); });
$('#aPreview').addEventListener('click', () => {
  preview = !preview; $('#aPreview').setAttribute('aria-pressed', preview); $('#aPreview').textContent = preview ? 'Volver a editar' : 'Ver como cliente';
  setAdmin(true);
});

/* ---------------- Admin: inline text ---------------- */
function bindEditable(el) {
  if (!el || el.dataset.bound) return;
  el.dataset.bound = '1'; el.contentEditable = 'plaintext-only';
  if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
  el.spellcheck = true;
  el.addEventListener('keydown', onEditKey);
  el.addEventListener('blur', onEditBlur);
  el.addEventListener('click', stopLink);
}
function unbindEditable(el) {
  if (!el.dataset.bound) return;
  delete el.dataset.bound; el.removeAttribute('contenteditable');
  el.removeEventListener('keydown', onEditKey); el.removeEventListener('blur', onEditBlur); el.removeEventListener('click', stopLink);
}
function stopLink(e) { e.preventDefault(); e.stopPropagation(); }
function onEditKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
  if (e.key === 'Escape') { e.currentTarget.textContent = S[e.currentTarget.dataset.k] ?? ''; e.currentTarget.blur(); }
}
async function onEditBlur(e) {
  const k = e.currentTarget.dataset.k;
  const v = e.currentTarget.textContent.replace(/\s+/g, ' ').trim();
  if (!v) { e.currentTarget.textContent = S[k] ?? DEF[k]; return; }
  if (v === S[k]) return;
  await saveSettings({ [k]: v });
}
async function saveSettings(patch) {
  const next = { ...S, ...patch };
  const { error } = await sb.from('web_settings').upsert({ id: 1, data: next, updated_at: new Date().toISOString() });
  if (error) { toast('No se guardó el cambio. Revisa tu conexión e inténtalo otra vez.', true); return false; }
  S = next; applySettings(); updateSend(); toast('Cambio guardado'); return true;
}

/* ---------------- Admin: images ---------------- */
function shrink(file, max) {
  return new Promise((res, rej) => {
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') return res(file);
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        c.toBlob(b => b ? res(b) : rej(new Error('blob')), 'image/webp', 0.88);
      };
      im.onerror = () => rej(new Error('img'));
      im.src = fr.result;
    };
    fr.onerror = () => rej(new Error('read'));
    fr.readAsDataURL(file);
  });
}
async function upload(file, folder, max) {
  const blob = await shrink(file, max);
  const ext = blob.type === 'image/svg+xml' ? 'svg' : blob.type === 'image/gif' ? 'gif' : 'webp';
  const path = `${folder}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: '31536000' });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/* ---------------- Admin: product editor ---------------- */
let ed = null;
function openEditor(id) {
  const p = id ? P.find(x => x.id === id) : null;
  ed = p ? { ...p } : { id: null, name: 'Nueva prenda', category: cat !== 'Todas' ? cat : 'Diseños DTF personalizado', description: '', price: 0, wholesale_price: null, wholesale_min: null, garment: 'tee', color: '#141414', image_url: null, on_rack: true, visible: true, badge: '', sort: (Math.max(0, ...P.map(x => x.sort || 0)) + 1) };
  $('#edTitle').textContent = p ? 'Editar prenda' : 'Nueva prenda';
  $('#edName').value = ed.name; $('#edCat').value = ed.category; $('#edDesc').value = ed.description || '';
  $('#edGarment').value = ed.garment; $('#edPrice').value = ed.price || ''; $('#edWs').value = ed.wholesale_price ?? ''; $('#edWsMin').value = ed.wholesale_min ?? '';
  $('#edBadge').value = ed.badge || ''; $('#edSort').value = ed.sort ?? 0;
  $('#edRack').checked = !!ed.on_rack; $('#edVisible').checked = !!ed.visible;
  $('#edErr').hidden = true; $('#edConfirm').hidden = true; $('#edDel').hidden = !p;
  renderSwatches(); edImg(); edPreview();
  if (!$('#dlgEdit').open) $('#dlgEdit').showModal();
}
function readEditor() {
  ed.name = $('#edName').value.trim(); ed.category = $('#edCat').value.trim() || 'Otros';
  ed.description = $('#edDesc').value.trim(); ed.garment = $('#edGarment').value;
  ed.price = Math.max(0, +$('#edPrice').value || 0);
  ed.wholesale_price = $('#edWs').value === '' ? null : Math.max(0, +$('#edWs').value);
  ed.wholesale_min = $('#edWsMin').value === '' ? null : Math.max(0, parseInt($('#edWsMin').value, 10));
  ed.badge = $('#edBadge').value.trim(); ed.sort = parseInt($('#edSort').value, 10) || 0;
  ed.on_rack = $('#edRack').checked; ed.visible = $('#edVisible').checked;
}
function edPreview() { $('#edPreview').innerHTML = garmentSVG({ ...ed, name: ed.name || 'Prenda' }, { tag: true }); }
function edImg() { const i = $('#edImg'); i.hidden = !ed.image_url; if (ed.image_url) i.src = ed.image_url; $('#edImgDel').hidden = !ed.image_url; }
function renderSwatches() {
  const all = [...NEUTRALS, ...ACCENTS];
  $('#edSwatches').innerHTML = all.map(c => `<button type="button" class="sw" data-c="${c}" style="background:${c}" aria-label="Color ${c}" aria-pressed="${c.toLowerCase() === (ed.color || '').toLowerCase()}"></button>`).join('') +
    `<input type="color" id="edColor" value="${/^#[0-9a-f]{6}$/i.test(ed.color) ? ed.color : '#141414'}" aria-label="Otro color">`;
}
$('#edSwatches').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; ed.color = b.dataset.c; renderSwatches(); edPreview(); });
$('#edSwatches').addEventListener('input', e => { if (e.target.id === 'edColor') { ed.color = e.target.value; $$('.sw', $('#edSwatches')).forEach(s => s.setAttribute('aria-pressed', 'false')); edPreview(); } });
$('#edForm').addEventListener('input', e => { if (e.target.id !== 'edColor') { readEditor(); edPreview(); } });
$('#edFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  toast('Subiendo foto…');
  try { ed.image_url = await upload(f, 'products', 1400); edImg(); edPreview(); toast('Foto lista. Guarda la prenda para publicarla.'); }
  catch (err) { toast('No se pudo subir la foto. Prueba con un JPG o PNG de menos de 5 MB.', true); }
  e.target.value = '';
});
$('#edImgDel').addEventListener('click', () => { ed.image_url = null; edImg(); edPreview(); });
$('#edForm').addEventListener('submit', async e => {
  e.preventDefault(); readEditor();
  if (!ed.name) { $('#edErr').hidden = false; $('#edErr').textContent = 'Escribe un nombre para la prenda.'; $('#edName').focus(); return; }
  const row = { name: ed.name, category: ed.category, description: ed.description, price: ed.price, wholesale_price: ed.wholesale_price, wholesale_min: ed.wholesale_min, garment: ed.garment, color: ed.color, image_url: ed.image_url, on_rack: ed.on_rack, visible: ed.visible, badge: ed.badge, sort: ed.sort, updated_at: new Date().toISOString() };
  $('#edSave').textContent = 'Guardando…';
  const q = ed.id ? sb.from('web_products').update(row).eq('id', ed.id).select().single() : sb.from('web_products').insert(row).select().single();
  const { data, error } = await q;
  $('#edSave').textContent = 'Guardar prenda';
  if (error) { $('#edErr').hidden = false; $('#edErr').textContent = 'No se guardó. Revisa tu conexión e inténtalo otra vez.'; return; }
  const n = { ...data, price: Number(data.price), wholesale_price: data.wholesale_price == null ? null : Number(data.wholesale_price) };
  const i = P.findIndex(x => x.id === n.id); if (i >= 0) P[i] = n; else P.push(n);
  $('#dlgEdit').close(); renderFacts(); renderRack(); renderCatalog(); toast(`Guardaste «${n.name}»`);
});
$('#edDel').addEventListener('click', () => { $('#edConfirmText').textContent = `¿Eliminar «${ed.name}» de la página? No se borra de tu dashboard.`; $('#edConfirm').hidden = false; $('#edDelYes').focus(); });
$('#edDelNo').addEventListener('click', () => { $('#edConfirm').hidden = true; });
$('#edDelYes').addEventListener('click', async () => {
  const { error } = await sb.from('web_products').delete().eq('id', ed.id);
  if (error) { $('#edErr').hidden = false; $('#edErr').textContent = 'No se pudo eliminar. Inténtalo otra vez.'; return; }
  P = P.filter(x => x.id !== ed.id); bag = bag.filter(b => b.id !== ed.id); saveBag();
  $('#dlgEdit').close(); renderAll(); toast(`Eliminaste «${ed.name}»`);
});
$('#aNew').addEventListener('click', () => openEditor(null));

/* ---------------- Admin: page settings ---------------- */
let pgLogo = '';
$('#aPage').addEventListener('click', () => {
  pgLogo = S.logo_url || '';
  $('#pgName').value = S.name || ''; $('#pgWa').value = S.whatsapp || ''; $('#pgIg').value = S.instagram || ''; $('#pgFb').value = S.facebook || '';
  $('#pgTk').value = S.tiktok || ''; $('#pgEmail').value = S.email || ''; $('#pgLoc').value = S.location || ''; $('#pgHours').value = S.hours || '';
  $('#pgErr').hidden = true; pgLogoShow(); $('#dlgPage').showModal();
});
function pgLogoShow() { const i = $('#pgLogo'); i.hidden = !pgLogo; if (pgLogo) i.src = pgLogo; $('#pgLogoDel').hidden = !pgLogo; }
$('#pgFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  toast('Subiendo logo…');
  try { pgLogo = await upload(f, 'logo', 800); pgLogoShow(); toast('Logo listo. Guarda los cambios para publicarlo.'); }
  catch (err) { toast('No se pudo subir el logo. Prueba con un PNG o JPG de menos de 5 MB.', true); }
  e.target.value = '';
});
$('#pgLogoDel').addEventListener('click', () => { pgLogo = ''; pgLogoShow(); });
$('#pgWa').addEventListener('blur', () => {
  const d = $('#pgWa').value.replace(/\D/g, '');
  $('#pgErr').hidden = !(d && d.length !== 10 && d.length !== 12);
  $('#pgErr').textContent = 'El número de WhatsApp debe tener 10 dígitos (o 12 con el 52 de México).';
});
$('#pgForm').addEventListener('submit', async e => {
  e.preventDefault();
  const d = $('#pgWa').value.replace(/\D/g, '');
  if (d && d.length !== 10 && d.length !== 12) { $('#pgErr').hidden = false; $('#pgErr').textContent = 'El número de WhatsApp debe tener 10 dígitos (o 12 con el 52 de México).'; $('#pgWa').focus(); return; }
  const ok = await saveSettings({
    logo_url: pgLogo, name: $('#pgName').value.trim() || DEF.name, whatsapp: $('#pgWa').value.trim(),
    instagram: $('#pgIg').value.trim(), facebook: $('#pgFb').value.trim(), tiktok: $('#pgTk').value.trim(),
    email: $('#pgEmail').value.trim(), location: $('#pgLoc').value.trim(), hours: $('#pgHours').value.trim()
  });
  if (ok) $('#dlgPage').close();
});

/* ---------------- Admin: import from dashboard ---------------- */
function guessGarment(n) {
  if (/sudadera con gorro/i.test(n)) return 'hoodie';
  if (/sudadera/i.test(n)) return 'crewneck';
  if (/polo/i.test(n)) return 'polo';
  if (/camisa.*larga/i.test(n)) return 'shirt';
  if (/camisa/i.test(n)) return 'shirt-short';
  if (/oversized/i.test(n)) return 'oversized';
  if (/manga larga/i.test(n)) return 'longsleeve';
  if (/sticker|tatuaje/i.test(n)) return 'sheet';
  return 'tee';
}
$('#aImport').addEventListener('click', async () => {
  const btn = $('#aImport'); btn.textContent = 'Importando…';
  try {
    const { data: u } = await sb.auth.getUser();
    const { data, error } = await sb.from('finance_data').select('data').eq('owner_id', u.user.id);
    if (error) throw error;
    const src = (data || []).flatMap(r => (r.data && r.data.p) || []);
    if (!src.length) { toast('No encontré productos en tu dashboard.', true); return; }
    let nuevos = 0, act = 0, k = Math.max(0, ...P.map(x => x.sort || 0));
    for (const d of src) {
      const ex = P.find(x => x.source_id === d.id);
      const base = { name: d.n, category: d.c || 'Otros', price: Number(d.v) || 0, wholesale_price: d.w ? Number(d.w) : null, wholesale_min: d.wq ? Number(d.wq) : null, updated_at: new Date().toISOString() };
      if (ex) {
        if (ex.name === base.name && ex.category === base.category && ex.price === base.price && ex.wholesale_price === base.wholesale_price && ex.wholesale_min === base.wholesale_min) continue;
        const { error: e2 } = await sb.from('web_products').update(base).eq('id', ex.id); if (!e2) act++;
      } else {
        const g = guessGarment(d.n);
        const { error: e3 } = await sb.from('web_products').insert({ ...base, source_id: d.id, garment: g, on_rack: g !== 'sheet', sort: ++k, color: NEUTRALS[hash(d.id) % NEUTRALS.length], description: '' }); if (!e3) nuevos++;
      }
    }
    await load(); setAdmin(true);
    toast(nuevos || act ? `Importé ${nuevos} prenda(s) nueva(s) y actualicé ${act}.` : 'Tu página ya tiene todo lo del dashboard.');
  } catch (err) { toast('No pude leer tu dashboard. Vuelve a entrar e inténtalo otra vez.', true); }
  finally { btn.textContent = 'Importar del dashboard'; }
});

/* ---------------- Boot ---------------- */
window.addEventListener('resize', () => kick());
RM.addEventListener?.('change', () => renderRack());
renderAll();
load().then(checkSession);
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT' && isAdmin) setAdmin(false); });
})();
