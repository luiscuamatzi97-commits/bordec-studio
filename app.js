/* Bordec Studio — catálogo con estudio de temporada (modelo + pila en perspectiva) y modo de edición */
(() => {
'use strict';

const SB_URL = 'https://wrzptgalxvvonsxfpinr.supabase.co';
const SB_KEY = 'sb_publishable_pG0HYShywO4Mj6cqNJSfDw_w7e15bi1';
const BUCKET = 'web-media';
const sb = window.supabase.createClient(SB_URL, SB_KEY);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
// colours from the database only ever reach markup as a plain hex or rgb() value
const safeColor = (c, d = '#0b0b0b') => { const v = String(c ?? '').trim(); return /^#[0-9a-f]{3,8}$/i.test(v) || /^rgba?\([\d\s.,%]+\)$/i.test(v) ? v : d; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const THREADS = ['#ff2525', '#006dff', '#a74dff', '#14d600'];
const NEUTRALS = ['#0b0b0b', '#1f1f1f', '#3a3a3a', '#5c5c5c', '#9b9b9b', '#d6d6d6', '#f4f4f4', '#ffffff'];
const ACCENTS = ['#ff2525', '#006dff', '#a74dff', '#14d600'];

const DEF = {
  name: 'Bordec Studio', logo_url: '', eyebrow: 'Taller de bordado y DTF',
  hero_title: 'Ropa con puntada propia.',
  hero_text: 'Playeras, sudaderas, polos y uniformes con bordado o estampado DTF. Elige un diseño de la temporada, tu talla y tu color.',
  season_word: 'Temporada 26',
  col_words: {},
  catalog_title: 'Catálogo',
  catalog_text: 'Precios por pieza en MXN. El precio de mayoreo se aplica solo en tu bolsa al llegar a la cantidad mínima.',
  steps_title: 'Cómo pedir',
  step1: 'Arma tu bolsa con las prendas, tallas y colores que necesitas.',
  step2: 'Envíanos tu pedido por WhatsApp junto con tu logo o diseño.',
  step3: 'Aprobamos el boceto, pagas el anticipo y producimos tu pedido.',
  about: 'Bordamos y estampamos en nuestro taller, pieza por pieza. Hacemos desde una playera para regalo hasta uniformes para todo tu equipo.',
  whatsapp: '', instagram: '', facebook: '', tiktok: '', location: '', hours: '', email: ''
};

let S = { ...DEF };
let P = [];
let isAdmin = false, editing = false, preview = false;
let cat = 'Todas';
let bag = [];
try { bag = JSON.parse(localStorage.getItem('bordec_bag') || '[]').filter(b => b && b.id); } catch (e) { bag = []; }
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
function waNumber() { let d = String(S.whatsapp || '').replace(/\D/g, ''); if (d.length === 10) d = '52' + d; return d; }
function waLink(text) { const n = waNumber(); return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : ''; }
function unitPrice(p, q) { return p.wholesale_price && p.wholesale_min && q >= p.wholesale_min ? Number(p.wholesale_price) : Number(p.price); }
const priceLabel = p => Number(p.price) > 0 ? fmt(p.price) : 'Cotizar';
function decoOf(p) { if (p.image_url) return 'image'; return /bordad/i.test(p.category + ' ' + p.name) ? 'emb' : 'dtf'; }
function sizesOf(p) { const s = Array.isArray(p.sizes) ? p.sizes.filter(Boolean) : []; return s.length ? s : (p.garment === 'sheet' ? ['Carta'] : ['S', 'M', 'L', 'XL']); }
function colorsOf(p) {
  const out = [{ n: 'Original', h: p.color || '#0b0b0b' }];
  for (const c of (Array.isArray(p.colors) ? p.colors : [])) {
    if (c && /^#[0-9a-f]{6}$/i.test(c.h) && !out.some(o => o.h.toLowerCase() === c.h.toLowerCase())) out.push({ n: c.n || c.h, h: c.h });
  }
  return p.garment === 'sheet' ? [] : out;
}
const bySort = (a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name);
const isApparel = p => p.garment !== 'sheet' && p.garment !== 'photo';

/* ---------------- Garment drawing ---------------- */
const SHAPES = {
  tee: 'M62 46 L30 58 L8 100 L34 112 L46 92 L46 262 Q100 268 154 262 L154 92 L166 112 L192 100 L170 58 L138 46 Q100 70 62 46 Z',
  oversized: 'M58 46 L22 62 L4 126 L36 134 L42 106 L40 274 Q100 280 160 274 L158 106 L164 134 L196 126 L178 62 L142 46 Q100 70 58 46 Z',
  longsleeve: 'M62 46 L30 58 L12 214 L36 218 L48 104 L46 262 Q100 268 154 262 L152 104 L164 218 L188 214 L170 58 L138 46 Q100 70 62 46 Z',
  crewneck: 'M60 46 L26 60 L8 222 L36 226 L46 108 L44 258 L156 258 L154 108 L164 226 L192 222 L174 60 L140 46 Q100 70 60 46 Z'
};
SHAPES.polo = SHAPES.tee; SHAPES.hoodie = SHAPES.crewneck; SHAPES.shirt = SHAPES.longsleeve; SHAPES['shirt-short'] = SHAPES.tee;

/* opt.bare → returns only the garment body (no hanger, no <svg>) for dressing the model */
function garmentSVG(p, opt = {}) {
  const g = p.garment || 'tee';
  const color = safeColor(opt.color || p.color, '#0b0b0b');
  const dark = lum(color) < 110;
  const edge = dark ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.22)';
  const seam = dark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.28)';
  const thread = THREADS[hash(p.id || p.name) % THREADS.length];
  const uid = 'c' + Math.random().toString(36).slice(2, 8);
  const hanger = `<path d="M100 27 V17 C100 9 108 5 112 10 C115 14 111 18 108 16" fill="none" stroke="#6f6f6f" stroke-width="3" stroke-linecap="round"/>`;
  const bar = `<path d="M100 27 L54 47 Q49 51 55 51 L145 51 Q151 51 146 47 Z" fill="none" stroke="#7a7a7a" stroke-width="3" stroke-linejoin="round"/>`;
  const wrap = inner => opt.bare ? inner : `<svg viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(p.name)}">${inner}</svg>`;

  if (g === 'sheet' || g === 'photo') {
    if (g === 'photo' && p.image_url) {
      return wrap(`<clipPath id="${uid}"><rect x="34" y="36" width="132" height="196" rx="6"/></clipPath><rect x="34" y="36" width="132" height="196" rx="6" fill="#fff"/><image href="${esc(p.image_url)}" x="34" y="36" width="132" height="196" preserveAspectRatio="xMidYMid slice" clip-path="url(#${uid})"/>`);
    }
    const dots = []; const cols = [thread, '#0b0b0b', '#9b9b9b', THREADS[(hash(p.id) + 1) % 4], '#d0d0d0', '#1f1f1f']; let k = 0;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      const cx = 66 + c * 34, cy = 78 + r * 38, col = cols[(k++) % cols.length];
      dots.push(r % 2 === c % 2 ? `<circle cx="${cx}" cy="${cy}" r="12" fill="${col}"/>` : `<rect x="${cx - 12}" y="${cy - 12}" width="24" height="24" rx="6" fill="${col}"/>`);
    }
    const sheet = `<rect x="40" y="36" width="120" height="176" rx="4" fill="#fff" stroke="rgba(0,0,0,.12)"/>${p.image_url ? `<clipPath id="${uid}"><rect x="46" y="44" width="108" height="160"/></clipPath><image href="${esc(p.image_url)}" x="46" y="44" width="108" height="160" preserveAspectRatio="xMidYMid meet" clip-path="url(#${uid})"/>` : dots.join('')}`;
    return wrap(`${opt.bare ? '' : hanger}${sheet}`);
  }

  const d = SHAPES[g] || SHAPES.tee;
  const big = g === 'oversized';
  let extra = '';
  if (g === 'hoodie') extra += `<path d="M58 54 Q60 32 100 30 Q140 32 142 54 Q100 80 58 54 Z" fill="${color}" stroke="${edge}"/><path d="M58 54 Q60 32 100 30 Q140 32 142 54 Q100 80 58 54 Z" fill="url(#drape)"/><path d="M68 54 Q72 40 100 39 Q128 40 132 54" fill="none" stroke="${seam}" stroke-width="1.2"/>`;
  let over = `<path d="${g === 'hoodie' ? 'M66 50 Q100 74 134 50' : 'M62 46 Q100 70 138 46'}" fill="none" stroke="${seam}" stroke-width="2"/>`;
  if (g === 'hoodie') over += `<path d="M92 66 V112 M108 66 V112" stroke="${dark ? '#d9d9d9' : '#3a3a3a'}" stroke-width="2" stroke-linecap="round"/><path d="M66 196 H134 L146 244 H54 Z" fill="none" stroke="${seam}" stroke-width="1.5"/>`;
  if (g === 'crewneck' || g === 'hoodie') over += `<path d="M44 248 H156 M10 212 L36 216 M190 212 L164 216" stroke="${seam}" stroke-width="1.5"/>`;
  if (g === 'longsleeve' || g === 'shirt') over += `<path d="M14 202 L37 206 M186 202 L163 206" stroke="${seam}" stroke-width="1.5"/>`;
  if (g === 'polo' || g === 'shirt' || g === 'shirt-short') {
    const cc = dark ? '#1d1d1d' : '#fafafa';
    over += `<path d="M64 46 L100 72 L84 92 L58 56 Z" fill="${cc}" stroke="${seam}" stroke-width="1.4"/><path d="M136 46 L100 72 L116 92 L142 56 Z" fill="${cc}" stroke="${seam}" stroke-width="1.4"/>`;
    const len = g === 'polo' ? 118 : 258;
    over += `<path d="M100 72 V${len}" stroke="${seam}" stroke-width="1.4"/>`;
    for (let y = 92; y < len; y += (g === 'polo' ? 14 : 30)) over += `<circle cx="104" cy="${y}" r="2.4" fill="${dark ? '#cfcfcf' : '#3a3a3a'}"/>`;
  }
  const chestY = big ? 104 : 96;
  let deco = '';
  if (decoOf(p) === 'image') {
    const w = big ? 82 : 70, h = big ? 92 : 80, x = 100 - w / 2;
    deco = (g === 'polo' || g === 'shirt' || g === 'shirt-short')
      ? `<clipPath id="${uid}"><rect x="112" y="${chestY + 6}" width="30" height="30"/></clipPath><image href="${esc(p.image_url)}" x="112" y="${chestY + 6}" width="30" height="30" preserveAspectRatio="xMidYMid meet" clip-path="url(#${uid})"/>`
      : `<clipPath id="${uid}"><rect x="${x}" y="${chestY}" width="${w}" height="${h}"/></clipPath><image href="${esc(p.image_url)}" x="${x}" y="${chestY}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${uid})"/>`;
  } else if (decoOf(p) === 'emb') {
    const cx = 126, cy = chestY + 18;
    deco = `<circle cx="${cx}" cy="${cy}" r="13" fill="none" stroke="${thread}" stroke-width="3" stroke-dasharray="2.2 1.6"/><path d="M${cx - 5} ${cy + 5} L${cx} ${cy - 6} L${cx + 5} ${cy + 5}" fill="none" stroke="${thread}" stroke-width="2.2" stroke-linejoin="round"/>`;
  } else {
    const w = big ? 60 : 50, x = 100 - w / 2, y = chestY + 4, ink = dark ? '#f4f4f4' : '#0b0b0b', base = dark ? '#0b0b0b' : '#f4f4f4';
    deco = `<rect x="${x}" y="${y}" width="${w}" height="${w}" rx="4" fill="${ink}"/><circle cx="${x + w * .62}" cy="${y + w * .4}" r="${w * .17}" fill="${thread}"/><path d="M${x + 7} ${y + w - 9} H${x + w * .55}" stroke="${base}" stroke-width="3" stroke-linecap="round"/><path d="M${x + 7} ${y + w - 16} H${x + w * .38}" stroke="${base}" stroke-width="3" stroke-linecap="round"/>`;
  }
  const body = `${extra}<path d="${d}" fill="${color}" stroke="${edge}" stroke-width="1.2" stroke-linejoin="round"/><path d="${d}" fill="url(#fold)"/><path d="${d}" fill="url(#drape)"/>${over}${deco}`;
  return wrap(opt.bare ? body : `${hanger}${extra ? '' : ''}${body}${bar}`);
}

/* ---------------- Swatches: the colour is data, painted here ---------------- */
function paintSwatches(root) { $$('.sw[data-c]', root || document).forEach(s => { s.style.background = s.dataset.c; }); }
paintSwatches();

/* ---------------- Settings / text ---------------- */
const FAV_DEF = document.getElementById('favicon')?.getAttribute('href');
function setFavicon(url) {
  const l = document.getElementById('favicon'); if (!l) return;
  l.href = url || FAV_DEF; l.removeAttribute('type');
  let t = document.querySelector('link[rel="apple-touch-icon"]');
  if (url) { if (!t) { t = document.createElement('link'); t.rel = 'apple-touch-icon'; document.head.appendChild(t); } t.href = url; }
  else if (t) t.remove();
}
function applySettings() {
  if ($('#wAll')) applyHeroBtns();
  $$('[data-k]').forEach(el => { if (document.activeElement !== el) el.textContent = S[el.dataset.k] ?? DEF[el.dataset.k] ?? ''; });
  document.title = S.name || DEF.name;
  applyHero(); applyBgs();
  let logo = $('#logo');
  if (S.logo_url) {
    if (!logo) { logo = document.createElement('img'); logo.id = 'logo'; $('#wordmark').before(logo); }
    logo.src = S.logo_url; logo.alt = S.name || DEF.name; logo.hidden = false; $('#wordmark').hidden = true;
  } else { if (logo) logo.remove(); $('#wordmark').hidden = false; }
  setFavicon(S.favicon_url || S.logo_url);
  $('#year').textContent = new Date().getFullYear();
  const wa = waLink(`Hola ${S.name}, quiero información sobre sus prendas.`);
  $('#footWa').hidden = !wa; if (wa) $('#footWa').href = wa;
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
  return `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, ''))}</a>`;
}
function renderFacts() {
  const vis = P.filter(p => p.visible);
  const tees = vis.filter(p => /playera/i.test(p.name) && Number(p.price) > 0).map(p => Number(p.price));
  const mins = vis.map(p => p.wholesale_min).filter(Boolean);
  const season = vis.filter(p => p.collection).length;
  FACT_AUTO = [
    { bg: '#0b0b0b', big: tees.length ? fmt(Math.min(...tees)) : '—', small: 'Playeras desde, estampadas o bordadas', icon: 'tag' },
    { bg: '#a74dff', big: mins.length ? `${Math.min(...mins)} pzs` : '—', small: 'Precio de mayoreo desde esta cantidad', icon: 'box' },
    { bg: '#ffffff', big: '2 técnicas', small: 'Bordado a máquina y estampado DTF a todo color', icon: 'needle' },
    { bg: '#1f1f1f', big: String(season).padStart(2, '0'), small: 'Diseños en nuestras colecciones de temporada', icon: 'shirt' }
  ];
  const tiles = factsList();
  $('#facts').innerHTML = tiles.map((t, i) => factHTML(t, i)).join('') + (editing && !preview ? '<button class="fact-add" type="button" id="factAdd">+ Recuadro</button>' : ''); requestAnimationFrame(fitFacts);
}
let FACT_AUTO = [];
const FACT_POS = { big: [7, 9], small: [7, 66], icon: [76, 9] };
function factsList() { return Array.isArray(S.facts) && S.facts.length ? S.facts : FACT_AUTO.map((t, i) => ({ id: 'f' + i, ...t })); }
const FICONS = {
  tag: '<path d="M3 12V4h8l10 10-8 8L3 12Z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4V7Z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  needle: '<path d="M20 4L7 17"/><path d="M17 3l4 4-2 2-4-4 2-2Z"/><path d="M7 17c-2 2-4 1-4 3s3 1 5-1"/>',
  shirt: '<path d="M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3c0 2-2 3-4 3S8 5 8 3Z"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 8L20 18M8.5 16L20 6"/>',
  star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.3l1-6.2L3 9.7l6.2-.9L12 3Z"/>',
  truck: '<path d="M2 6h12v10H2zM14 10h4l3 3v3h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.5-4-8-9-8Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
  sparkle: '<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><path d="M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chat: '<path d="M4 5h16v11H9l-5 4V5Z"/>',
  heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11Z"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21l-4-4Z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8Z"/>'
};
const iconSVG = (name, col) => FICONS[name] ? `<svg viewBox="0 0 24 24" fill="none" stroke="${col || 'currentColor'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FICONS[name]}</svg>` : '';
const inkFor = bg => lum(bg || '#ffffff') < 140 ? '#f4f4f4' : '#0b0b0b';
function fitFacts() {
  for (const tile of $$('#facts .fact.fx, .fx-prev-box .fact.fx')) {
    const big = tile.querySelector('[data-el="big"]'); if (!big) continue;
    big.style.fontSize = '';
    const T = tile.getBoundingClientRect(), ic = tile.querySelector('[data-el="icon"]');
    if (!T.width) continue;
    let fs = parseFloat(getComputedStyle(big).fontSize); const min = fs * .55;
    for (let n = 0; n < 24; n++) {
      const B = big.getBoundingClientRect(); let lim = T.right - 14;
      if (ic) { const I = ic.getBoundingClientRect(); if (I.left > B.left + 8 && I.top < B.bottom && I.bottom > B.top) lim = Math.min(lim, I.left - 10); }
      if (B.right <= lim || fs <= min) break;
      fs = Math.max(min, fs * .94); big.style.fontSize = fs + 'px';
    }
  }
}
let fitRaf = 0;
addEventListener('resize', () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fitFacts); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitFacts());

function factHTML(t, i) {
  const ink = t.ink === 'light' ? '#f4f4f4' : t.ink === 'dark' ? '#0b0b0b' : inkFor(t.bg);
  const pos = (k) => { const p = (t.pos && t.pos[k]) || FACT_POS[k]; return `left:${p[0]}%;top:${p[1]}%`; };
  const icon = t.iconImg ? `<img src="${esc(t.iconImg)}" alt="" draggable="false">` : (t.icon ? iconSVG(t.icon, t.iconColor ? safeColor(t.iconColor, '') : '') : '');
  return `<div class="fact fx" data-fi="${i}" style="background:${safeColor(t.bg, '#ffffff')};color:${ink}">
    <b class="fx-el" data-el="big" style="${pos('big')}">${esc(t.big || '')}</b>
    <span class="fx-el fx-small" data-el="small" style="${pos('small')}">${esc(t.small || '')}</span>
    ${icon ? `<span class="fx-el fx-icon" data-el="icon" style="${pos('icon')};width:${t.iconSize || 44}px;height:${t.iconSize || 44}px">${icon}</span>` : ''}
  </div>`;
}

/* ---------------- Hero: rolling word + card wheel ---------------- */
const COLS = [
  { slug: 'avengers-doomsday', title: 'Avengers Doomsday', word: 'Avengers Doomsday', kicker: 'Edición especial', label: 'Temporada 26', group: '' },
  { slug: 'navidad-3d', title: 'Navidad 3D', word: 'Navidad 3D', kicker: 'Colección navideña', label: 'Navidad 2026', group: 'Navidad', cat: 'Navidad 3D' },
  { slug: 'playeras-navidad', title: 'Playeras Navidad', word: 'Playeras Navidad', kicker: 'Colección navideña', label: 'Navidad 2026', group: 'Navidad', cat: 'Playeras Navidad' }
];
let COL = COLS[0];
const colWord = c => String((S.col_words && S.col_words[c.slug]) || c.word).toUpperCase().slice(0, 24);
const colText = (key, prop) => (S[key] && S[key][COL.slug]) || COL[prop];
const wheel = $('#wheel'), wcards = $('#wheelCards');
const TONES = ['light', 'black', 'white', 'graphite', 'red', 'light', 'gray', 'black', 'white', 'blue', 'graphite', 'light'];
let SL = [], f = 0, curId = null, curKey = null, lastUser = -1e9, hovering = false;
const mod = (a, n) => ((a % n) + n) % n;
const idxOf = () => SL.length ? mod(Math.round(f), SL.length) : 0;
const stepDeg = () => innerWidth < 700 ? 24 : 19;
const radius = () => parseFloat(getComputedStyle(wheel).getPropertyValue('--R')) || 600;

function renderRoll() {
  const w = colWord(COL);
  $('#heroTitle').style.setProperty('--len', Math.max(6, w.length));
  $('#heroKicker').textContent = colText('col_kickers', 'kicker'); $('#heroLabel').textContent = colText('col_labels', 'label');
  $('#rollWord').innerHTML = [...w].map((c, i) => c === ' ' ? `<span class="ch sp" style="--i:${i}"></span>`
    : `<span class="ch" style="--i:${i}"><span class="fc">${esc(c)}</span><span class="fc f1 outline">${esc(c)}</span><span class="fc f2">${esc(c)}</span><span class="fc f3 outline">${esc(c)}</span></span>`).join('');
  $('#heroTitle').setAttribute('aria-label', `${COL.title} · ${S.name || DEF.name}`);
  $('#ringText').textContent = (`${S.name || DEF.name}   +   ${COL.title}   +   `).repeat(2);
}
function renderWheel(keepId) {
  SL = slidesOf(COL).map(s => ({ ...s, p: P.find(x => x.id === s.product_id) || null }));
  wcards.innerHTML = SL.map((s, i) => slideHTML(s, i)).join('');
  const k = keepId ? SL.findIndex(s => s.key === keepId || (s.p && s.p.id === keepId)) : -1;
  f = k >= 0 ? k : 0;
  layoutW(true); selectW(true);
}
function layoutW(instant) {
  const n = SL.length, st = stepDeg(), cards = wcards.children;
  for (let i = 0; i < cards.length; i++) {
    let d = i - f; if (n > 4) d = mod(d + n / 2, n) - n / 2;
    const ang = d * st, a = Math.abs(d), c = cards[i];
    const prev = parseFloat(c.dataset.ang);
    const jump = instant || (!isNaN(prev) && Math.abs(prev - ang) > 120);
    if (jump) c.style.transition = 'none';
    c.style.transform = `rotate(${ang.toFixed(2)}deg)`;
    c.dataset.ang = ang;
    if (jump) { void c.offsetWidth; c.style.transition = ''; }
    c.style.zIndex = String(100 - Math.round(a * 10));
    c.style.setProperty('--act', Math.max(0, 1 - a).toFixed(3));
    c.style.visibility = Math.abs(ang) > 104 ? 'hidden' : '';
    c.classList.toggle('is-active', a < .5);
    c.setAttribute('aria-selected', a < .5 ? 'true' : 'false');
    c.tabIndex = a < .5 ? 0 : -1;
  }
}
function selectW(force) {
  const s = SL[idxOf()], p = s && s.p;
  if (!s) { $('#wName').textContent = editing ? 'Agrega tarjetas con «+ Tarjeta»' : 'Pronto habrá diseños aquí'; $('#wPrice').textContent = ''; $('#wOpen').hidden = true; curKey = null; return; }
  if (!force && s.key === curKey) return;
  curKey = s.key; curId = p ? p.id : null; $('#wOpen').hidden = !p;
  $('#wName').textContent = s.text || (p ? p.name : '');
  if (!p) { $('#wPrice').textContent = ''; return; }
  $('#wPrice').innerHTML = `<span>${esc(priceLabel(p))}</span>${p.wholesale_price && p.wholesale_min ? `<span>Mayoreo ${fmt(p.wholesale_price)} desde ${p.wholesale_min} pzs</span>` : ''}`;
}
// with 4 cards or fewer the wheel does not loop: positions stay between the first and last card
const loops = () => SL.length > 4;
const clampF = () => { if (!loops()) f = Math.max(0, Math.min(SL.length - 1, f)); };
function goTo(i) {
  if (!SL.length) return;
  if (!loops()) { f = i; layoutW(); selectW(); return; }
  const n = SL.length; let delta = mod(i - f, n); if (delta > n / 2) delta -= n;
  f = Math.round(f + delta); layoutW(); selectW();
}
let autoDir = 1;
const stepW = (dir, auto) => {
  if (!SL.length) return;
  if (!loops()) {
    let t = Math.round(f) + dir;
    if (t < 0 || t > SL.length - 1) { if (!auto) return; autoDir = -autoDir; t = Math.round(f) + autoDir; }
    f = Math.max(0, Math.min(SL.length - 1, t));
  } else f = Math.round(f) + dir;
  layoutW(); selectW();
};
const touch = () => { lastUser = performance.now(); };

const drag = { on: false, x: 0, f0: 0, moved: false, id: null, t: 0, lx: 0, v: 0 };
wheel.addEventListener('pointerdown', e => {
  if (e.button !== 0 || !SL.length || e.target.closest('.wheel-pointer')) return;
  Object.assign(drag, { on: true, x: e.clientX, f0: f, moved: false, id: e.pointerId, t: performance.now(), lx: e.clientX, v: 0 }); touch();
});
wheel.addEventListener('pointermove', e => {
  if (!drag.on || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x;
  if (!drag.moved && Math.abs(dx) > 6) { drag.moved = true; wheel.classList.add('dragging'); try { wheel.setPointerCapture(e.pointerId); } catch (_) {} }
  if (!drag.moved) return;
  const now = performance.now(); drag.v = (e.clientX - drag.lx) / Math.max(1, now - drag.t); drag.lx = e.clientX; drag.t = now;
  f = drag.f0 - dx / (radius() * stepDeg() * Math.PI / 180);
  if (!loops()) f = Math.max(-0.35, Math.min(SL.length - 0.65, f));
  layoutW(true);
});
wheel.addEventListener('pointerup', e => {
  if (!drag.on) return; drag.on = false; wheel.classList.remove('dragging'); touch();
  if (drag.moved) { f = Math.round(f - Math.max(-2, Math.min(2, drag.v * 1.5))); clampF(); layoutW(); selectW(); return; }
  const c = e.target.closest('.wcard'); if (!c) return;
  const i = +c.dataset.i;
  if (editing && !preview) { goTo(i); openSlide(i); return; }
  if (i === idxOf()) openCard(SL[i]); else goTo(i);
});
wheel.addEventListener('pointercancel', () => { if (drag.on) { drag.on = false; wheel.classList.remove('dragging'); f = Math.round(f); clampF(); layoutW(); selectW(); } });
wheel.addEventListener('dragstart', e => e.preventDefault());
wheel.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') { stepW(1); touch(); e.preventDefault(); }
  if (e.key === 'ArrowLeft') { stepW(-1); touch(); e.preventDefault(); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.wcard')) { e.preventDefault(); const s = SL[idxOf()]; if (editing && !preview) openSlide(idxOf()); else if (s) openCard(s); }
});
wheel.addEventListener('pointerenter', () => { hovering = true; });
wheel.addEventListener('pointerleave', () => { hovering = false; });
$('#wPrev').addEventListener('click', () => { stepW(-1); touch(); });
$('#wNext').addEventListener('click', () => { stepW(1); touch(); });
$('#wOpen').addEventListener('click', () => { const s = SL[idxOf()]; if (s) openCard(s); });
setInterval(() => {
  if (RM.matches || hovering || drag.on || document.hidden || $('dialog[open]') || editing) return;
  if (performance.now() - lastUser < 9000 || SL.length < 2) return;
  stepW(loops() ? 1 : autoDir, true);
}, 3400);
addEventListener('resize', () => layoutW(true));

/* sizes + colors renderer for the product dialog */
function renderOptions(prefix, p, state) {
  const sizes = sizesOf(p), cols = colorsOf(p);
  if (!state.size || !sizes.includes(state.size)) state.size = sizes.includes('M') ? 'M' : sizes[0];
  $(`#${prefix}Sizes`).innerHTML = sizes.map(s => `<button type="button" class="size" role="radio" aria-checked="${s === state.size}" data-size="${esc(s)}">${esc(s)}</button>`).join('');
  $(`#${prefix}SizesBox`).hidden = sizes.length < 2 && sizes[0] === 'Carta';
  $(`#${prefix}ColorsBox`).hidden = !cols.length;
  $(`#${prefix}Colors`).innerHTML = cols.map((c, i) => `<button type="button" class="cswatch" role="radio" aria-checked="${i === state.color}" aria-label="${esc(c.n)}" title="${esc(c.n)}" data-color="${i}" style="background:${safeColor(c.h)}"></button>`).join('');
  $(`#${prefix}ColorName`).textContent = cols[state.color] ? cols[state.color].n : '';
}

/* ---------------- Catalog ---------------- */
function renderCatalog() {
  const list = P.filter(p => p.visible || (editing && !preview)).sort((a, b) => a.category.localeCompare(b.category) || bySort(a, b));
  const counts = {}; list.forEach(p => counts[p.category] = (counts[p.category] || 0) + 1);
  const cats = ['Todas', ...Object.keys(counts).sort((a, b) => a.localeCompare(b))];
  if (!cats.includes(cat)) cat = 'Todas';
  $('#chips').innerHTML = cats.map(c => `<button class="chip" type="button" aria-pressed="${c === cat}" data-cat="${esc(c)}">${esc(c)}<span class="n">${c === 'Todas' ? list.length : counts[c]}</span></button>`).join('');
  const shown = cat === 'Todas' ? list : list.filter(p => p.category === cat);
  $('#grid').innerHTML = shown.length ? shown.map(card).join('') : `<div class="empty"><p>${editing ? 'Aún no hay prendas. Usa «+ Prenda» para agregar la primera.' : 'No hay prendas en esta categoría.'}</p></div>`;
  $('#catList').innerHTML = Object.keys(counts).map(c => `<option value="${esc(c)}">`).join('');
}
function card(p) {
  const ws = p.wholesale_price && p.wholesale_min ? `<span class="card-ws"><span>Mayoreo ${fmt(p.wholesale_price)}</span><span>${p.wholesale_min}+ pzs</span></span>` : '';
  const action = editing && !preview ? `<button class="btn btn-dark card-add" type="button" data-edit="${p.id}">Editar</button>`
    : `<button class="btn btn-dark card-add" type="button" data-open="${p.id}">${sizesOf(p).length > 1 || colorsOf(p).length > 1 ? 'Elegir' : 'Agregar'}</button>`;
  return `<article class="card">
    <div class="card-visual" data-open="${p.id}" role="button" tabindex="0" aria-label="Ver ${esc(p.name)}">
      ${p.badge ? `<span class="card-badge">${esc(p.badge)}</span>` : ''}${p.collection ? `<span class="card-season">${esc((COLS.find(c => c.slug === p.collection) || {}).title || '')}</span>` : ''}${p.visible ? '' : '<span class="card-hidden">Oculta</span>'}
      ${p.model_url ? `<img class="card-photo" src="${esc(p.model_url)}" alt="${esc(p.name)}" loading="lazy">` : garmentSVG(p)}
    </div>
    <div class="card-body">
      <span class="card-cat">${esc(p.category)}</span>
      <span class="card-name">${esc(p.name)}</span>
      ${ws}
      <div class="card-row"><span class="card-price">${priceLabel(p)}</span>${action}</div>
    </div>
  </article>`;
}
$('#chips').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (!b) return; cat = b.dataset.cat; renderCatalog(); });
$('#grid').addEventListener('click', e => {
  const ed = e.target.closest('[data-edit]'), o = e.target.closest('[data-open]');
  if (ed) return openEditor(ed.dataset.edit);
  if (o) openProduct(o.dataset.open);
});
$('#grid').addEventListener('keydown', e => { const o = e.target.closest('.card-visual'); if (o && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openProduct(o.dataset.open); } });

/* ---------------- Product detail ---------------- */
let cur = null; const pd = { size: null, color: 0 };
let curImg = null;
function openCard(s) {
  const img = s.image || (s.p && s.p.model_url) || null;
  if (s.p) return openProduct(s.p.id, img);
  if (img) { $('#imgView').src = img; $('#imgView').alt = s.text || ''; $('#imgCap').textContent = s.text || ''; $('#dlgImg').showModal(); }
}
function openProduct(id, img) {
  if (editing && !preview) return openEditor(id);
  const p = P.find(x => x.id === id); if (!p) return;
  cur = p; pd.size = null; pd.color = 0; curImg = img || p.model_url || null;
  $('#pdVisual').innerHTML = curImg ? `<img class="pd-photo" src="${esc(curImg)}" alt="${esc(p.name)}">` : garmentSVG(p);
  $('#pdCat').textContent = p.category; $('#pdName').textContent = p.name;
  $('#pdBadge').hidden = !p.badge; $('#pdBadge').textContent = p.badge || '';
  $('#pdDesc').textContent = p.description || '';
  $('#pdPrice').textContent = Number(p.price) > 0 ? fmt(p.price) + ' por pieza' : 'Precio a cotizar';
  $('#pdWs').textContent = p.wholesale_price && p.wholesale_min ? `Mayoreo: ${fmt(p.wholesale_price)} por pieza desde ${p.wholesale_min} piezas` : '';
  $('#pdQty').value = 1; renderOptions('pd', p, pd); pdTotal();
  $('#dlgProduct').showModal();
}
function pdTotal() {
  const q = Math.max(1, parseInt($('#pdQty').value, 10) || 1);
  $('#pdTotal').textContent = cur && Number(cur.price) > 0 ? (() => { const u = unitPrice(cur, q); return `${q} × ${fmt(u)} = ${fmt(u * q)}${u < cur.price ? ' (mayoreo)' : ''}`; })() : '';
  const c = cur && colorsOf(cur)[pd.color];
  const wa = cur && waLink(`Hola ${S.name}, me interesa: ${q} × ${cur.name}${pd.size ? `, talla ${pd.size}` : ''}${c ? `, color ${c.n}` : ''}. ¿Me das más información?`);
  $('#pdWa').hidden = !wa; if (wa) $('#pdWa').href = wa;
}
$('#pdSizes').addEventListener('click', e => { const b = e.target.closest('[data-size]'); if (!b) return; pd.size = b.dataset.size; renderOptions('pd', cur, pd); pdTotal(); });
$('#pdColors').addEventListener('click', e => { const b = e.target.closest('[data-color]'); if (!b) return; pd.color = +b.dataset.color; renderOptions('pd', cur, pd); if (!curImg) $('#pdVisual').innerHTML = garmentSVG(cur, { color: colorsOf(cur)[pd.color].h }); pdTotal(); });
$('#pdQty').addEventListener('input', pdTotal);
$('#pdMinus').addEventListener('click', () => { $('#pdQty').value = Math.max(1, (+$('#pdQty').value || 1) - 1); pdTotal(); });
$('#pdPlus').addEventListener('click', () => { $('#pdQty').value = (+$('#pdQty').value || 0) + 1; pdTotal(); });
$('#pdAdd').addEventListener('click', () => { const q = Math.max(1, parseInt($('#pdQty').value, 10) || 1); addToBag(cur, q, pd.size, colorsOf(cur)[pd.color]); $('#dlgProduct').close(); });

/* ---------------- Bag ---------------- */
const keyOf = b => `${b.id}|${b.size || ''}|${b.cn || ''}`;
function addToBag(p, q, size, color) {
  const item = { id: p.id, q, size: size || '', cn: color ? color.n : '', ch: color ? color.h : '' };
  const it = bag.find(b => keyOf(b) === keyOf(item));
  if (it) it.q += q; else bag.push(item);
  saveBag(); renderBag(); toast(`Agregaste ${p.name}${size ? ' talla ' + size : ''} a tu bolsa`);
}
function bagLines() { return bag.map(b => ({ ...b, p: P.find(x => x.id === b.id) })).filter(b => b.p); }
const qtyOfProduct = id => bag.filter(b => b.id === id).reduce((s, b) => s + b.q, 0);
function renderBag() {
  const L = bagLines(); const n = L.reduce((s, b) => s + b.q, 0);
  $('#bagCount').textContent = n; $('#bagCount').classList.toggle('has', n > 0);
  $('#bagList').innerHTML = L.length ? L.map((b, i) => {
    const tq = qtyOfProduct(b.id), u = unitPrice(b.p, tq), isWs = u < b.p.price;
    const opts = [b.size && `Talla ${b.size}`, b.cn && b.cn].filter(Boolean).join(', ');
    return `<div class="bag-item">
      <div class="bag-thumb">${garmentSVG(b.p, { color: b.ch || undefined })}</div>
      <div><p class="bag-name">${esc(b.p.name)}</p><p class="bag-meta">${esc(opts)}${opts ? '<br>' : ''}${Number(b.p.price) > 0 ? `<span class="${isWs ? 'ws' : ''}">${fmt(u)} c/u${isWs ? ' · mayoreo' : ''}</span>` : 'A cotizar'}</p>
        <button class="bag-rm" type="button" data-rm="${i}">Quitar</button></div>
      <div class="bag-qty"><button class="iconbtn" type="button" data-q="${i}" data-d="-1" aria-label="Quitar una">−</button><span>${b.q}</span><button class="iconbtn" type="button" data-q="${i}" data-d="1" aria-label="Agregar una">+</button></div>
    </div>`;
  }).join('') : `<div class="empty"><p>Tu bolsa está vacía.</p><p class="form-help">Elige un diseño, tu talla y tu color, y agrégalo aquí. Al final envías el pedido por WhatsApp.</p><a class="btn btn-dark" href="#temporada" data-close-bag style="margin-top:14px">Ver la temporada</a></div>`;
  $('#bagFoot').hidden = !L.length;
  const total = L.reduce((s, b) => s + unitPrice(b.p, qtyOfProduct(b.id)) * b.q, 0);
  $('#bagTotal').textContent = fmt(total) + (L.some(b => !(Number(b.p.price) > 0)) ? ' + cotización' : '');
  updateSend();
}
function orderText() {
  const L = bagLines();
  const lines = L.map(b => {
    const u = unitPrice(b.p, qtyOfProduct(b.id)); const opts = [b.size && `talla ${b.size}`, b.cn && `color ${b.cn}`].filter(Boolean).join(', ');
    return `• ${b.q} × ${b.p.name}${opts ? ` (${opts})` : ''}${Number(b.p.price) > 0 ? ` — ${fmt(u)} c/u = ${fmt(u * b.q)}${u < b.p.price ? ' (mayoreo)' : ''}` : ' — a cotizar'}`;
  });
  const total = L.reduce((s, b) => s + unitPrice(b.p, qtyOfProduct(b.id)) * b.q, 0);
  const name = $('#bagName').value.trim(), notes = $('#bagNotes').value.trim();
  return `Hola ${S.name}, quiero hacer este pedido:\n\n${lines.join('\n')}\n\nTotal estimado: ${fmt(total)}${notes ? `\n\nDetalles: ${notes}` : ''}${name ? `\n\nSoy ${name}.` : ''}`;
}
function updateSend() {
  const wa = waLink(orderText()), a = $('#bagSend');
  if (wa) { a.href = wa; a.removeAttribute('aria-disabled'); $('#bagErr').hidden = true; }
  else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); $('#bagErr').hidden = false; $('#bagErr').textContent = isAdmin ? 'Agrega tu número de WhatsApp en «Logo y contacto» para recibir pedidos.' : 'Pronto podrás enviar tu pedido por WhatsApp desde aquí.'; }
}
$('#bagName').addEventListener('input', updateSend);
$('#bagNotes').addEventListener('input', updateSend);
$('#bagList').addEventListener('click', e => {
  if (e.target.closest('[data-close-bag]')) { $('#dlgBag').close(); return; }
  const L = bagLines(); const q = e.target.closest('[data-q]'), rm = e.target.closest('[data-rm]');
  if (q) { const it = bag.find(b => keyOf(b) === keyOf(L[+q.dataset.q])); it.q += +q.dataset.d; if (it.q < 1) bag = bag.filter(b => b !== it); }
  else if (rm) { const k = keyOf(L[+rm.dataset.rm]); bag = bag.filter(b => keyOf(b) !== k); }
  else return;
  saveBag(); renderBag();
});
$('#bagBtn').addEventListener('click', () => { renderBag(); $('#dlgBag').showModal(); });

$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target === d) d.close(); }));

/* ---------------- Data ---------------- */
const norm = x => ({ ...x, price: Number(x.price), wholesale_price: x.wholesale_price == null ? null : Number(x.wholesale_price) });
async function load() {
  const [s, p] = await Promise.all([
    sb.from('web_settings').select('data').eq('id', 1).maybeSingle(),
    sb.from('web_products').select('*').order('sort')
  ]);
  if (s.data && s.data.data) S = { ...DEF, ...s.data.data };
  if (p.error) { $('#grid').innerHTML = '<p class="empty">No pudimos cargar el catálogo. Revisa tu conexión y recarga la página.</p>'; $('#stName').textContent = 'No pudimos cargar la temporada'; }
  P = (p.data || []).map(norm);
  renderAll();
}
function renderAll() { applySettings(); renderRoll(); renderFacts(); renderWheel(curId); renderCatalog(); renderBag(); }

/* ---------------- Collections (hash routes) + nav ---------------- */
function colFromHash() { const x = location.hash.slice(1); return COLS.find(c => c.slug === x) || null; }
function setCollection(c, scroll) {
  const changed = c.slug !== COL.slug; COL = c;
  $$('[data-col]').forEach(a => a.classList.toggle('on', a.dataset.col === c.slug));
  $('#navXmas').classList.toggle('on', c.group === 'Navidad');
  document.title = `${c.title} · ${S.name || DEF.name}`;
  curId = null; renderRoll(); renderWheel();
  if (c.cat && P.some(p => p.category === c.cat)) cat = c.cat; else if (changed) cat = 'Todas';
  renderCatalog();
  if (scroll) $('#temporada').scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth', block: 'start' });
}
const closeXmas = () => { $('#xmasMenu').hidden = true; $('#navXmas').setAttribute('aria-expanded', 'false'); };
addEventListener('hashchange', () => { const c = colFromHash(); if (c) setCollection(c, true); closeXmas(); });
$('#navXmas').addEventListener('click', e => { e.stopPropagation(); const open = $('#xmasMenu').hidden; $('#xmasMenu').hidden = !open; $('#navXmas').setAttribute('aria-expanded', String(open)); });
document.addEventListener('click', e => { if (!e.target.closest('#navXmasWrap')) closeXmas(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeXmas(); });
$('#menuBtn').addEventListener('click', () => $('#dlgMenu').showModal());
$('#dlgMenu').addEventListener('click', e => { if (e.target.closest('a')) $('#dlgMenu').close(); });
$$('[data-col]').forEach(a => a.addEventListener('click', () => { const c = COLS.find(x => x.slug === a.dataset.col); if (c && location.hash === '#' + c.slug) setCollection(c, true); }));

/* ---------------- Admin: auth ---------------- */
async function checkSession() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return setAdmin(false);
  const { data: ok } = await sb.rpc('is_web_admin'); setAdmin(!!ok);
}
function setAdmin(on) {
  isAdmin = on; editing = on && !preview;
  document.body.classList.toggle('editing', editing);
  $('#adminbar').hidden = !on;
  $('#adminLink').textContent = on ? 'Estás en modo edición' : 'Acceso para el taller';
  $$('[data-k]').forEach(el => editing ? bindEditable(el) : unbindEditable(el));
  if (P.length || on) { renderWheel(curId); renderCatalog(); renderFacts(); applySettings(); updateSend(); }
}
$('#adminLink').addEventListener('click', () => { if (!isAdmin) { $('#lgErr').hidden = true; $('#dlgLogin').showModal(); } });
if (location.hash === '#admin') setTimeout(() => !isAdmin && $('#dlgLogin').showModal(), 400);
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('#lgEmail').value.trim(), password = $('#lgPass').value, err = $('#lgErr');
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
$('#aPreview').addEventListener('click', () => { preview = !preview; $('#aPreview').setAttribute('aria-pressed', preview); $('#aPreview').textContent = preview ? 'Volver a editar' : 'Ver como cliente'; setAdmin(true); });

/* ---------------- Admin: inline text ---------------- */
function bindEditable(el) {
  if (!el || el.dataset.bound) return;
  el.dataset.bound = '1'; el.contentEditable = 'plaintext-only';
  if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
  el.addEventListener('keydown', onEditKey); el.addEventListener('blur', onEditBlur); el.addEventListener('click', stopLink);
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
  const k = e.currentTarget.dataset.k, v = e.currentTarget.textContent.replace(/\s+/g, ' ').trim();
  if (!v) { e.currentTarget.textContent = S[k] ?? DEF[k]; return; }
  if (v !== S[k]) await saveSettings({ [k]: v });
}
async function saveSettings(patch) {
  const next = { ...S, ...patch };
  const { error } = await sb.from('web_settings').upsert({ id: 1, data: next, updated_at: new Date().toISOString() });
  if (error) { toast('No se guardó el cambio. Revisa tu conexión e inténtalo otra vez.', true); return false; }
  S = next; applySettings(); renderRoll(); updateSend(); toast('Cambio guardado'); return true;
}

/* ---------------- Admin: images ---------------- */
function shrink(file, max) {
  return new Promise((res, rej) => {
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') return res(file);
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        c.toBlob(b => b ? res(b) : rej(new Error('blob')), 'image/webp', 0.88);
      };
      im.onerror = () => rej(new Error('img')); im.src = fr.result;
    };
    fr.onerror = () => rej(new Error('read')); fr.readAsDataURL(file);
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
const colorsToText = cs => (Array.isArray(cs) ? cs : []).map(c => `${c.n} ${c.h}`).join(', ');
function textToColors(t) {
  return t.split(',').map(s => s.trim()).filter(Boolean).map(s => { const m = s.match(/#[0-9a-f]{6}/i); return m ? { n: s.replace(m[0], '').trim() || m[0], h: m[0].toLowerCase() } : null; }).filter(Boolean);
}
function openEditor(id) {
  const p = id ? P.find(x => x.id === id) : null;
  ed = p ? { ...p } : { id: null, name: 'Nueva prenda', category: cat !== 'Todas' ? cat : 'Diseños DTF personalizado', description: '', price: 0, wholesale_price: null, wholesale_min: null, garment: 'tee', color: '#0b0b0b', image_url: null, model_url: null, sizes: ['S', 'M', 'L', 'XL'], colors: [], in_season: false, collection: (COL && COL.slug) || null, visible: true, badge: '', sort: (Math.max(0, ...P.map(x => x.sort || 0)) + 1) };
  $('#edTitle').textContent = p ? 'Editar prenda' : 'Nueva prenda';
  $('#edName').value = ed.name; $('#edCat').value = ed.category; $('#edDesc').value = ed.description || '';
  $('#edGarment').value = ed.garment; $('#edPrice').value = ed.price || ''; $('#edWs').value = ed.wholesale_price ?? ''; $('#edWsMin').value = ed.wholesale_min ?? '';
  $('#edSizes').value = (ed.sizes || []).join(', '); $('#edColors').value = colorsToText(ed.colors);
  $('#edBadge').value = ed.badge || ''; $('#edSort').value = ed.sort ?? 0;
  $('#edCollection').value = ed.collection || ''; $('#edVisible').checked = !!ed.visible;
  $('#edErr').hidden = true; $('#edConfirm').hidden = true; $('#edDel').hidden = !p;
  renderSwatches(); edImgs(); edPreview();
  if (!$('#dlgEdit').open) $('#dlgEdit').showModal();
}
function readEditor() {
  ed.name = $('#edName').value.trim(); ed.category = $('#edCat').value.trim() || 'Otros';
  ed.description = $('#edDesc').value.trim(); ed.garment = $('#edGarment').value;
  ed.price = Math.max(0, +$('#edPrice').value || 0);
  ed.wholesale_price = $('#edWs').value === '' ? null : Math.max(0, +$('#edWs').value);
  ed.wholesale_min = $('#edWsMin').value === '' ? null : Math.max(0, parseInt($('#edWsMin').value, 10));
  ed.sizes = $('#edSizes').value.split(',').map(s => s.trim()).filter(Boolean);
  ed.colors = textToColors($('#edColors').value);
  ed.badge = $('#edBadge').value.trim(); ed.sort = parseInt($('#edSort').value, 10) || 0;
  ed.collection = $('#edCollection').value || null; ed.visible = $('#edVisible').checked;
}
function edPreview() { const p = { ...ed, name: ed.name || 'Prenda' }; $('#edPreview').innerHTML = p.model_url ? `<img class="pd-photo" src="${esc(p.model_url)}" alt="">` : garmentSVG(p); }
function edImgs() {
  const a = $('#edImg'); a.hidden = !ed.image_url; if (ed.image_url) a.src = ed.image_url; $('#edImgDel').hidden = !ed.image_url;
  const b = $('#edModel'); b.hidden = !ed.model_url; if (ed.model_url) b.src = ed.model_url; $('#edModelDel').hidden = !ed.model_url;
}
function renderSwatches() {
  $('#edSwatches').innerHTML = [...NEUTRALS, ...ACCENTS].map(c => `<button type="button" class="sw" data-c="${c}" style="background:${c}" aria-label="Color ${c}" aria-pressed="${c.toLowerCase() === (ed.color || '').toLowerCase()}"></button>`).join('') +
    `<input type="color" id="edColor" value="${/^#[0-9a-f]{6}$/i.test(ed.color) ? ed.color : '#0b0b0b'}" aria-label="Otro color">`;
}
$('#edSwatches').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; ed.color = b.dataset.c; renderSwatches(); edPreview(); });
$('#edSwatches').addEventListener('input', e => { if (e.target.id === 'edColor') { ed.color = e.target.value; $$('.sw', $('#edSwatches')).forEach(s => s.setAttribute('aria-pressed', 'false')); edPreview(); } });
$('#edForm').addEventListener('input', e => { if (e.target.id !== 'edColor') { readEditor(); edPreview(); } });
async function pickUpload(e, key, folder, max) {
  const fl = e.target.files[0]; if (!fl) return;
  toast('Subiendo imagen…');
  try { ed[key] = await upload(fl, folder, max); edImgs(); edPreview(); toast('Imagen lista. Guarda la prenda para publicarla.'); }
  catch (err) { toast('No se pudo subir la imagen. Prueba con un JPG o PNG de menos de 5 MB.', true); }
  e.target.value = '';
}
$('#edFile').addEventListener('change', e => pickUpload(e, 'image_url', 'products', 1400));
$('#edModelFile').addEventListener('change', e => pickUpload(e, 'model_url', 'models', 1600));
$('#edImgDel').addEventListener('click', () => { ed.image_url = null; edImgs(); edPreview(); });
$('#edModelDel').addEventListener('click', () => { ed.model_url = null; edImgs(); edPreview(); });
$('#edForm').addEventListener('submit', async e => {
  e.preventDefault(); readEditor();
  if (!ed.name) { $('#edErr').hidden = false; $('#edErr').textContent = 'Escribe un nombre para la prenda.'; $('#edName').focus(); return; }
  const row = { name: ed.name, category: ed.category, description: ed.description, price: ed.price, wholesale_price: ed.wholesale_price, wholesale_min: ed.wholesale_min, garment: ed.garment, color: ed.color, image_url: ed.image_url, model_url: ed.model_url, sizes: ed.sizes, colors: ed.colors, collection: ed.collection, visible: ed.visible, badge: ed.badge, sort: ed.sort, updated_at: new Date().toISOString() };
  $('#edSave').textContent = 'Guardando…';
  const { data, error } = await (ed.id ? sb.from('web_products').update(row).eq('id', ed.id).select().single() : sb.from('web_products').insert(row).select().single());
  $('#edSave').textContent = 'Guardar prenda';
  if (error) { $('#edErr').hidden = false; $('#edErr').textContent = 'No se guardó. Revisa tu conexión e inténtalo otra vez.'; return; }
  const n = norm(data); const i = P.findIndex(x => x.id === n.id); if (i >= 0) P[i] = n; else P.push(n);
  $('#dlgEdit').close(); renderFacts(); renderWheel(n.id); renderCatalog(); toast(`Guardaste «${n.name}»`);
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


/* ---------------- Hero look (editable) ---------------- */
const FONTS = [
  { n: 'Clash Display', css: '"Clash Display", "Kanit", sans-serif', w: 600 },
  { n: 'Kanit', css: '"Kanit", sans-serif', w: 600, g: 'Kanit:wght@600' },
  { n: 'Anton', css: '"Anton", Impact, sans-serif', w: 400, g: 'Anton' },
  { n: 'Bebas Neue', css: '"Bebas Neue", Impact, sans-serif', w: 400, g: 'Bebas+Neue' },
  { n: 'Archivo Black', css: '"Archivo Black", sans-serif', w: 400, g: 'Archivo+Black' },
  { n: 'Unbounded', css: '"Unbounded", sans-serif', w: 700, g: 'Unbounded:wght@700' },
  { n: 'Syne', css: '"Syne", sans-serif', w: 800, g: 'Syne:wght@800' },
  { n: 'Space Grotesk', css: '"Space Grotesk", sans-serif', w: 700, g: 'Space+Grotesk:wght@700' },
  { n: 'Playfair Display', css: '"Playfair Display", serif', w: 800, g: 'Playfair+Display:wght@800' }
];
const HERO_DEF = { show: true, font: 'Clash Display', size: 100, roll: true, red: true, redColor: '#ff2525', cross: true, mark: true, ring: true, arrows: true };
const heroCfg = () => ({ ...HERO_DEF, ...(S.hero || {}) });
const loadedFonts = new Set();
function loadFont(f) {
  if (!f.g || loadedFonts.has(f.g)) return; loadedFonts.add(f.g);
  const l = document.createElement('link'); l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?family=${f.g}&display=swap`; document.head.appendChild(l);
}
function applyHero(cfg) {
  const c = cfg || heroCfg(), hero = $('#temporada'), t = $('#heroTitle');
  const font = FONTS.find(x => x.n === c.font) || FONTS[0]; loadFont(font);
  t.style.fontFamily = font.css; t.style.fontWeight = font.w; t.style.setProperty('--tsize', (c.size || 100) / 100);
  t.classList.toggle('no-roll', !c.roll);
  hero.style.setProperty('--hero-red', c.redColor || HERO_DEF.redColor);
  const hide = []; if (!c.show) hide.push('head'); if (!c.red) hide.push('red'); if (!c.cross) hide.push('cross'); if (!c.mark) hide.push('mark'); if (!c.ring) hide.push('ring'); if (!c.arrows) hide.push('arrows');
  hero.dataset.hide = hide.join(' ');
}

/* ---------------- Section backgrounds (editable) ---------------- */
const SECS = { page: ['body', 'light'], header: ['.top', 'light'], hero: ['#temporada', 'light'], facts: ['#datos', 'light'], catalog: ['#catalogo', 'light'], howto: ['#pedir', 'dark'], footer: ['#contacto', 'dark'] };
const FLIP_TO_DARK = { '--black': '#f4f4f4', '--white': '#161616', '--muted-on-dark': '#5f5f5f', '--gray-dark': '#b5b5b5', '--line': '#3a3a3a', '--light': '#262626', '--graphite': '#e9e9e9' };
const FLIP_TO_LIGHT = { '--white': '#0b0b0b', '--muted-on-dark': '#5f5f5f', '--graphite': '#e2e2e2', '--graphite-2': '#d0d0d0', '--gray': '#6b6b6b' };
const BG_DEF = { page: '#f4f4f4', header: '#f4f4f4', hero: '#e9e9e9', facts: '#f4f4f4', catalog: '#f4f4f4', howto: '#0b0b0b', footer: '#0b0b0b' };
const rgba = (hex, a) => { const n = parseInt(String(hex).slice(1), 16); return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; };
const ROOT_TOK = {}, OWN_BG = new Set(['header', 'hero', 'howto', 'footer']); // sections that paint their own ground
function restoreTokens(el) {
  const cs = getComputedStyle(document.documentElement);
  for (const v of new Set([...Object.keys(FLIP_TO_DARK), ...Object.keys(FLIP_TO_LIGHT)])) {
    if (!(v in ROOT_TOK)) ROOT_TOK[v] = cs.getPropertyValue(v).trim();
    if (ROOT_TOK[v]) el.style.setProperty(v, ROOT_TOK[v]);
  }
}
function applyBgs(map, imgs, fx) {
  const bg = map || S.bg || {}, bi = imgs || S.bgimg || {}, ef = fx || S.bgfx || {};
  let pageFlip = false;
  document.body.classList.toggle('hdr-see', !!(ef.header && ef.header.alpha < 100));
  for (const [k, [sel, tone]] of Object.entries(SECS)) {
    const el = $(sel); if (!el) continue;
    for (const v of [...Object.keys(FLIP_TO_DARK), ...Object.keys(FLIP_TO_LIGHT)]) el.style.removeProperty(v);
    for (const v of ['background', 'background-image', 'background-size', 'background-position', 'background-repeat', 'color', 'backdrop-filter', '-webkit-backdrop-filter']) el.style.removeProperty(v);
    const e2 = ef[k] || {}, alpha = e2.alpha == null ? 100 : e2.alpha;
    if (e2.blur) { el.style.backdropFilter = 'blur(14px)'; el.style.webkitBackdropFilter = 'blur(14px)'; }
    let col = bg[k]; const im = bi[k] && bi[k].url ? bi[k] : null;
    if (!col && !im && alpha >= 100) continue;
    if (alpha < 100) col = rgba(/^#[0-9a-f]{6}$/i.test(col || '') ? col : BG_DEF[k], alpha / 100);
    if (col) el.style.background = col;
    if (im) {
      const shade = im.dim ? (im.ink === 'dark' ? 'linear-gradient(rgba(255,255,255,.55), rgba(255,255,255,.55)), ' : 'linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.5)), ') : '';
      el.style.backgroundImage = `${shade}url("${String(im.url).replace(/"/g, '%22')}")`;
      el.style.backgroundSize = im.fit === 'contain' ? 'contain' : 'cover';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.backgroundPosition = 'center';
    }
    const base = bg[k] || BG_DEF[k];
    const now = im ? (im.ink === 'dark' ? 'light' : 'dark') : (lum(base) < 140 ? 'dark' : 'light');
    if (now !== tone) for (const [v, x] of Object.entries(now === 'dark' ? FLIP_TO_DARK : FLIP_TO_LIGHT)) el.style.setProperty(v, x);
    else if (k !== 'page' && pageFlip) restoreTokens(el);
    if (k === 'page') { el.style.color = now === 'dark' ? '#f4f4f4' : '#0b0b0b'; pageFlip = now !== tone; }
  }
  // sections left at their default colors must not inherit a flipped page palette
  if (pageFlip) for (const [k, [sel]] of Object.entries(SECS)) {
    if (!OWN_BG.has(k) || bg[k] || (bi[k] && bi[k].url) || (ef[k] && ef[k].alpha < 100)) continue;
    const el = $(sel); if (el) restoreTokens(el);
  }
}

/* ---------------- Admin: hero editor ---------------- */
let hrDraft = null;
function openHero() {
  const c = heroCfg(); hrDraft = { ...c };
  $('#hrCol').textContent = `Estás editando la portada de «${COL.title}». El título y los textos son de esta colección; la tipografía y los elementos aplican a todas.`;
  $('#hrFont').innerHTML = FONTS.map(f => `<option value="${esc(f.n)}">${esc(f.n)}</option>`).join('');
  $('#hrShowHead').checked = c.show; $('#hrWord').value = colWord(COL);
  $('#hrKicker').value = colText('col_kickers', 'kicker'); $('#hrLabel').value = colText('col_labels', 'label'); $('#hrLeft').value = S.eyebrow || DEF.eyebrow;
  $('#hrFont').value = c.font; $('#hrSize').value = c.size; $('#hrSizeVal').textContent = c.size + '%';
  $('#hrRoll').checked = c.roll; $('#hrRed').checked = c.red; $('#hrCross').checked = c.cross; $('#hrMark').checked = c.mark; $('#hrRing').checked = c.ring; $('#hrArrows').checked = c.arrows;
  $('#hrRedColor').value = /^#[0-9a-f]{6}$/i.test(c.redColor) ? c.redColor : '#ff2525';
  markSw('#hrRedSw', c.redColor);
  hbDraft = hbCfg(); hbFill(hbDraft);
  $('#dlgHero').showModal();
}
function markSw(box, col) { $$(`${box} .sw`).forEach(s => s.setAttribute('aria-pressed', String((s.dataset.c || '').toLowerCase() === String(col || '').toLowerCase()))); }
function readHero() {
  Object.assign(hrDraft, { show: $('#hrShowHead').checked, font: $('#hrFont').value, size: +$('#hrSize').value, roll: $('#hrRoll').checked, red: $('#hrRed').checked, cross: $('#hrCross').checked, mark: $('#hrMark').checked, ring: $('#hrRing').checked, arrows: $('#hrArrows').checked });
  $('#hrSizeVal').textContent = hrDraft.size + '%';
  applyHero(hrDraft);
  // live text preview
  const w = ($('#hrWord').value.trim() || COL.word).toUpperCase().slice(0, 24);
  const keep = S.col_words; S.col_words = { ...(S.col_words || {}), [COL.slug]: w }; renderRoll(); S.col_words = keep;
  $('#heroKicker').textContent = $('#hrKicker').value; $('#heroLabel').textContent = $('#hrLabel').value;
  $$('[data-k="eyebrow"]').forEach(e => e.textContent = $('#hrLeft').value);
}
$('#hrForm').addEventListener('input', e => { if (e.target.id === 'hrRedColor') { hrDraft.redColor = e.target.value; markSw('#hrRedSw', ''); } readHero(); });
$('#hrForm').addEventListener('change', readHero);
$('#hrRedSw').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; hrDraft.redColor = b.dataset.c; markSw('#hrRedSw', b.dataset.c); readHero(); });
$('#hrReset').addEventListener('click', () => { hrDraft = { ...HERO_DEF }; $('#hrWord').value = COL.word.toUpperCase(); $('#hrKicker').value = COL.kicker; $('#hrLabel').value = COL.label; $('#hrLeft').value = DEF.eyebrow;
  $('#hrShowHead').checked = true; $('#hrFont').value = HERO_DEF.font; $('#hrSize').value = 100; $('#hrRoll').checked = $('#hrRed').checked = $('#hrCross').checked = $('#hrMark').checked = $('#hrRing').checked = $('#hrArrows').checked = true; markSw('#hrRedSw', HERO_DEF.redColor); readHero();
  hbDraft = { a: { ...HB_DEF.a }, b: { ...HB_DEF.b } }; hbFill(hbDraft); applyHeroBtns(hbDraft); });
$('#hrForm').addEventListener('submit', async e => {
  e.preventDefault(); readHero();
  const ok = await saveSettings({
    hero: hrDraft,
    col_words: { ...(S.col_words || {}), [COL.slug]: ($('#hrWord').value.trim() || COL.word).slice(0, 24) },
    col_kickers: { ...(S.col_kickers || {}), [COL.slug]: $('#hrKicker').value.trim() || COL.kicker },
    col_labels: { ...(S.col_labels || {}), [COL.slug]: $('#hrLabel').value.trim() || COL.label },
    eyebrow: $('#hrLeft').value.trim() || DEF.eyebrow,
    hero_btns: hbDraft || hbCfg()
  });
  if (ok) { $('#dlgHero').close(); renderRoll(); }
});
$('#dlgHero').addEventListener('close', () => { applySettings(); renderRoll(); });
$('#aHero').addEventListener('click', openHero);
$('#temporada').addEventListener('click', e => { if (editing && !preview && e.target.closest('.hero-top, .hero-titlebox, .hero-meta') && !e.target.closest('.tri')) { e.preventDefault(); openHero(); } }, true);

/* ---------------- Hero buttons (text and colour, editable) ---------------- */
const HB_DEF = { a: { text: 'Elegir talla y color', bg: '' }, b: { text: 'Ver todos los modelos', color: '', show: true } };
let hbDraft = null;
function hbCfg() { const s = S.hero_btns || {}; return { a: { ...HB_DEF.a, ...(s.a || {}) }, b: { ...HB_DEF.b, ...(s.b || {}) } }; }
function heroIsDark() { const im = S.bgimg && S.bgimg.hero; if (im && im.url) return im.ink !== 'dark'; return lum((S.bg && S.bg.hero) || '#e9e9e9') < 140; }
function applyHeroBtns(cfg) {
  const c = cfg || hbCfg(), A = $('#wOpen'), B = $('#wAll');
  A.textContent = c.a.text || HB_DEF.a.text;
  A.classList.toggle('btn-pick', !!c.a.bg); A.classList.toggle('btn-dark', !c.a.bg);
  if (c.a.bg) { A.style.setProperty('--pick-bg', c.a.bg); A.style.setProperty('--pick-ink', lum(c.a.bg) < 150 ? '#f4f4f4' : '#0b0b0b'); }
  else { A.style.removeProperty('--pick-bg'); A.style.removeProperty('--pick-ink'); }
  B.textContent = c.b.text || HB_DEF.b.text;
  B.hidden = c.b.show === false;
  B.style.setProperty('--line-c', c.b.color || (heroIsDark() ? '#14d600' : '#006dff'));
}
function goAllModels() {
  let c = 'Todas';
  const mine = P.filter(p => p.visible && p.collection === COL.slug);
  if (COL.cat && P.some(p => p.visible && p.category === COL.cat)) c = COL.cat;
  else if (mine.length) { const n = {}; mine.forEach(p => n[p.category] = (n[p.category] || 0) + 1); c = Object.keys(n).sort((x, y) => n[y] - n[x])[0]; }
  cat = c; renderCatalog();
  const el = document.getElementById('catalogo'); if (el) el.scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth', block: 'start' });
}
$('#wAll').addEventListener('click', goAllModels);
function hbFill(c) {
  $('#hbAText').value = c.a.text; $('#hbBText').value = c.b.text; $('#hbBShow').checked = c.b.show !== false;
  markSw('#hbASw', c.a.bg); markSw('#hbBSw', c.b.color);
  $('#hbAColor').value = /^#[0-9a-f]{6}$/i.test(c.a.bg) ? c.a.bg : '#0b0b0b';
  $('#hbBColor').value = /^#[0-9a-f]{6}$/i.test(c.b.color) ? c.b.color : '#14d600';
}
function hbRead() {
  hbDraft.a.text = $('#hbAText').value.trim() || HB_DEF.a.text;
  hbDraft.b.text = $('#hbBText').value.trim() || HB_DEF.b.text;
  hbDraft.b.show = $('#hbBShow').checked;
  applyHeroBtns(hbDraft);
}
$('#hbASw').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; hbDraft.a.bg = b.dataset.c; markSw('#hbASw', b.dataset.c); hbRead(); });
$('#hbBSw').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; hbDraft.b.color = b.dataset.c; markSw('#hbBSw', b.dataset.c); hbRead(); });
$('#hbAColor').addEventListener('input', e => { hbDraft.a.bg = e.target.value; markSw('#hbASw', ''); hbRead(); });
$('#hbBColor').addEventListener('input', e => { hbDraft.b.color = e.target.value; markSw('#hbBSw', ''); hbRead(); });
$('#hbAAuto').addEventListener('click', () => { hbDraft.a.bg = ''; markSw('#hbASw', ''); hbRead(); });
$('#hbBAuto').addEventListener('click', () => { hbDraft.b.color = ''; markSw('#hbBSw', ''); hbRead(); });
['#hbAText', '#hbBText', '#hbBShow'].forEach(s => $(s).addEventListener('input', () => hbDraft && hbRead()));
$('#hbBShow').addEventListener('change', () => hbDraft && hbRead());

/* ---------------- Admin: backgrounds editor ---------------- */
let bgDraft = {}, imgDraft = {};
function bgImgControls(r) {
  if (r.querySelector('.bgimg')) return;
  const k = r.dataset.sec, d = document.createElement('div');
  d.className = 'bgimg';
  d.innerHTML = `<div class="photo-row"><img alt="" hidden><label class="btn btn-sm btn-outline" for="bgf-${k}">Poner imagen de fondo</label><input id="bgf-${k}" type="file" accept="image/*" hidden><button type="button" class="btn btn-sm btn-ghost bgimg-del" hidden>Quitar imagen</button></div>
    <div class="bgimg-opts" hidden>
      <label class="bgimg-o">Letras <select class="bgimg-ink"><option value="light">claras (imagen oscura)</option><option value="dark">oscuras (imagen clara)</option></select></label>
      <label class="bgimg-o">Ajuste <select class="bgimg-fit"><option value="cover">Cubrir toda la sección</option><option value="contain">Mostrar completa</option></select></label>
      <label class="check bgimg-o"><input type="checkbox" class="bgimg-dim"> Suavizar la imagen para que el texto se lea mejor</label>
    </div>
    <label class="bgfx-o">Opacidad del fondo <input type="range" class="bgfx-alpha" min="0" max="100" step="5"> <span class="bgfx-val"></span></label>
    <label class="check bgfx-o"><input type="checkbox" class="bgfx-blur"> Desenfocar lo que pasa por detrás</label>`;
  r.appendChild(d);
}
let fxDraft = {};
function bgImgRefresh(r) {
  const k = r.dataset.sec, im = imgDraft[k], box = r.querySelector('.bgimg');
  const fx = fxDraft[k] || {}, a = fx.alpha == null ? 100 : fx.alpha;
  box.querySelector('.bgfx-alpha').value = a; box.querySelector('.bgfx-val').textContent = a + '%'; box.querySelector('.bgfx-blur').checked = !!fx.blur;
  const pic = box.querySelector('img'); pic.hidden = !im; if (im) pic.src = im.url;
  box.querySelector('.bgimg-del').hidden = !im; box.querySelector('.bgimg-opts').hidden = !im;
  if (im) { box.querySelector('.bgimg-ink').value = im.ink || 'light'; box.querySelector('.bgimg-fit').value = im.fit || 'cover'; box.querySelector('.bgimg-dim').checked = !!im.dim; }
}
function openBg() {
  bgDraft = { ...(S.bg || {}) }; imgDraft = JSON.parse(JSON.stringify(S.bgimg || {})); fxDraft = JSON.parse(JSON.stringify(S.bgfx || {}));
  $$('#bgForm .bgrow').forEach(r => { const k = r.dataset.sec; bgImgControls(r); bgImgRefresh(r); markSw(`.bgrow[data-sec="${k}"]`, bgDraft[k]); r.querySelector('input[type=color]').value = /^#[0-9a-f]{6}$/i.test(bgDraft[k] || '') ? bgDraft[k] : '#f4f4f4'; });
  $('#dlgBg').showModal();
}
const fxUpdate = e => {
  const r = e.target.closest('.bgrow'); if (!r) return false; const k = r.dataset.sec;
  if (e.target.classList.contains('bgfx-alpha')) { fxDraft[k] = { ...(fxDraft[k] || {}), alpha: +e.target.value }; r.querySelector('.bgfx-val').textContent = e.target.value + '%'; }
  else if (e.target.classList.contains('bgfx-blur')) fxDraft[k] = { ...(fxDraft[k] || {}), blur: e.target.checked };
  else return false;
  applyBgs(bgDraft, imgDraft, fxDraft); return true;
};
$('#bgForm').addEventListener('input', fxUpdate);
$('#bgForm').addEventListener('change', async e => {
  if (fxUpdate(e)) return;
  const r = e.target.closest('.bgrow'); if (!r) return; const k = r.dataset.sec;
  if (e.target.type === 'file') {
    const fl = e.target.files[0]; if (!fl) return; toast('Subiendo imagen…');
    try { const url = await upload(fl, 'backgrounds', 2200); imgDraft[k] = { url, ink: (imgDraft[k] && imgDraft[k].ink) || 'light', fit: 'cover', dim: true }; bgImgRefresh(r); applyBgs(bgDraft, imgDraft, fxDraft); toast('Imagen lista. Toca «Guardar fondos» para publicarla.'); }
    catch (err) { toast('No se pudo subir la imagen. Prueba con un JPG o PNG de menos de 5 MB.', true); }
    e.target.value = ''; return;
  }
  const im = imgDraft[k]; if (!im) return;
  if (e.target.classList.contains('bgimg-ink')) im.ink = e.target.value;
  if (e.target.classList.contains('bgimg-fit')) im.fit = e.target.value;
  if (e.target.classList.contains('bgimg-dim')) im.dim = e.target.checked;
  applyBgs(bgDraft, imgDraft, fxDraft);
});
$('#bgForm').addEventListener('click', e => {
  const r = e.target.closest('.bgrow'); if (!r) return; const k = r.dataset.sec;
  const b = e.target.closest('[data-c]'); if (b) { bgDraft[k] = b.dataset.c; markSw(`.bgrow[data-sec="${k}"]`, b.dataset.c); applyBgs(bgDraft, imgDraft, fxDraft); }
  if (e.target.closest('.bg-reset')) { delete bgDraft[k]; delete imgDraft[k]; delete fxDraft[k]; markSw(`.bgrow[data-sec="${k}"]`, ''); bgImgRefresh(r); applyBgs(bgDraft, imgDraft, fxDraft); }
  if (e.target.closest('.bgimg-del')) { delete imgDraft[k]; bgImgRefresh(r); applyBgs(bgDraft, imgDraft, fxDraft); }
});
$('#bgForm').addEventListener('input', e => { const r = e.target.closest('.bgrow'); if (!r || e.target.type !== 'color') return; bgDraft[r.dataset.sec] = e.target.value; markSw(`.bgrow[data-sec="${r.dataset.sec}"]`, ''); applyBgs(bgDraft, imgDraft, fxDraft); });
$('#bgReset').addEventListener('click', () => { bgDraft = {}; imgDraft = {}; fxDraft = {}; $$('#bgForm .bgrow').forEach(r => { markSw(`.bgrow[data-sec="${r.dataset.sec}"]`, ''); bgImgRefresh(r); }); applyBgs(bgDraft, imgDraft, fxDraft); });
$('#bgForm').addEventListener('submit', async e => { e.preventDefault(); if (await saveSettings({ bg: bgDraft, bgimg: imgDraft, bgfx: fxDraft })) $('#dlgBg').close(); });
$('#dlgBg').addEventListener('close', () => applyBgs());
$('#aBg').addEventListener('click', openBg);


/* ---------------- Wheel cards (independent, editable) ---------------- */
const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function slidesOf(c) {
  const saved = S.slides && S.slides[c.slug];
  if (Array.isArray(saved)) return saved.filter(s => s && s.key);
  // default: one card per product of the collection (no repeats)
  return P.filter(p => p.collection === c.slug && isApparel(p) && p.visible).sort(bySort).map(p => ({ key: 'p-' + p.id, product_id: p.id }));
}
function slideHTML(s, i, solo) {
  const p = s.p, img = s.image || (p && p.model_url);
  const vis = img ? `<span class="wcard-vis photo"><img src="${esc(img)}" alt="" loading="lazy" draggable="false"></span>` : (p ? `<span class="wcard-vis">${garmentSVG(p)}</span>` : '<span class="wcard-vis"></span>');
  const tone = s.bg ? '' : TONES[i % TONES.length];
  const ink = s.bg ? (lum(s.bg) < 140 ? 'light' : 'dark') : '';
  const text = s.text || (p ? p.name : 'Tarjeta sin producto');
  const price = p ? priceLabel(p) : '';
  const inner = `<span class="wcard-in"${s.bg ? ` style="background:${safeColor(s.bg, '#f4f4f4')}"` : ''}>${vis}</span>`;
  return solo ? `<span class="wcard solo" data-tone="${tone}" data-ink="${ink}">${inner}</span>`
    : `<button class="wcard" type="button" role="option" data-i="${i}" data-tone="${tone}" data-ink="${ink}" aria-label="${esc(text)}${price ? ', ' + price : ''}">${inner}</button>`;
}
let slIdx = -1, slDraft = null, slList = null;
function editableSlides() { return slidesOf(COL).map(s => ({ ...s })); }
function openSlide(i, isNew) {
  slList = editableSlides();
  if (isNew) { slList.splice(Math.min(slList.length, i + 1), 0, { key: uid(), product_id: null }); i = Math.min(slList.length - 1, i + 1); }
  slIdx = i; slDraft = { ...slList[i] };
  const opts = P.filter(p => p.visible || editing).sort((a, b) => (a.collection === COL.slug ? -1 : 0) - (b.collection === COL.slug ? -1 : 0) || bySort(a, b));
  $('#slProduct').innerHTML = '<option value="">Ninguno (solo imagen)</option>' + opts.map(p => `<option value="${p.id}">${esc(p.name)}${p.collection === COL.slug ? '' : ' · ' + esc(p.category)}</option>`).join('');
  $('#slProduct').value = slDraft.product_id || '';
  $('#slText').value = slDraft.text || '';
  $('#slErr').hidden = true; $('#slConfirm').hidden = true;
  slRefresh(); $('#dlgSlide').showModal();
}
function slRefresh() {
  $('#slPos').textContent = `Colección «${COL.title}» · tarjeta ${slIdx + 1} de ${slList.length}`;
  const p = P.find(x => x.id === slDraft.product_id) || null;
  $('#slPreview').innerHTML = slideHTML({ ...slDraft, p }, slIdx, true);
  const im = $('#slImg'); im.hidden = !slDraft.image; if (slDraft.image) im.src = slDraft.image; $('#slImgDel').hidden = !slDraft.image;
  markSw('#slBg', slDraft.bg || ''); $('#slBgColor').value = /^#[0-9a-f]{6}$/i.test(slDraft.bg || '') ? slDraft.bg : '#f4f4f4';
  $('#slLeft').disabled = slIdx <= 0; $('#slRight').disabled = slIdx >= slList.length - 1;
}
async function saveSlides(list, keepKey) {
  const ok = await saveSettings({ slides: { ...(S.slides || {}), [COL.slug]: list.map(({ key, product_id, image, bg, text }) => ({ key, product_id: product_id || null, image: image || null, bg: bg || null, text: text || '' })) } });
  if (ok) renderWheel(keepKey);
  return ok;
}
$('#slProduct').addEventListener('change', () => { slDraft.product_id = $('#slProduct').value || null; slRefresh(); });
$('#slText').addEventListener('input', () => { slDraft.text = $('#slText').value.trim(); slRefresh(); });
$('#slBg').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { slDraft.bg = b.dataset.c; slRefresh(); } if (e.target.closest('#slBgAuto')) { slDraft.bg = null; slRefresh(); } });
$('#slBgColor').addEventListener('input', e => { slDraft.bg = e.target.value; slRefresh(); });
$('#slFile').addEventListener('change', async e => {
  const fl = e.target.files[0]; if (!fl) return; toast('Subiendo imagen…');
  try { slDraft.image = await upload(fl, 'slides', 1400); slRefresh(); toast('Imagen lista. Guarda la tarjeta para publicarla.'); }
  catch (err) { toast('No se pudo subir la imagen. Prueba con un JPG o PNG de menos de 5 MB.', true); }
  e.target.value = '';
});
$('#slImgDel').addEventListener('click', () => { slDraft.image = null; slRefresh(); });
const slMove = d => { const t = slIdx + d; if (t < 0 || t >= slList.length) return; slList[slIdx] = slDraft; [slList[slIdx], slList[t]] = [slList[t], slList[slIdx]]; slIdx = t; slRefresh(); };
$('#slLeft').addEventListener('click', () => slMove(-1));
$('#slRight').addEventListener('click', () => slMove(1));
$('#slForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!slDraft.product_id && !slDraft.image) { $('#slErr').hidden = false; $('#slErr').textContent = 'Elige un producto o sube una imagen para la tarjeta.'; return; }
  slList[slIdx] = slDraft;
  if (await saveSlides(slList, slDraft.key)) { $('#dlgSlide').close(); toast('Tarjeta guardada'); }
});
$('#slDel').addEventListener('click', () => { $('#slConfirm').hidden = false; $('#slDelYes').focus(); });
$('#slDelNo').addEventListener('click', () => { $('#slConfirm').hidden = true; });
$('#slDelYes').addEventListener('click', async () => {
  const list = slList.filter((_, i) => i !== slIdx);
  const next = list[Math.min(slIdx, list.length - 1)];
  if (await saveSlides(list, next && next.key)) { $('#dlgSlide').close(); toast('Tarjeta quitada'); }
});
$('#aSlide').addEventListener('click', () => openSlide(SL.length ? idxOf() : -1, true));


/* ---------------- Admin: facts tiles editor (colors, texts, icons, free placement) ---------------- */
let fxList = null, fxIdx = -1, ftDraft = null;
const factsEditable = () => factsList().map(t => JSON.parse(JSON.stringify(t)));
async function saveFacts(list) { const ok = await saveSettings({ facts: list }); if (ok) renderFacts(); return ok; }
// drag elements inside a tile (edit mode only); a click without movement opens the editor
const fdrag = { on: false };
$('#facts').addEventListener('pointerdown', e => {
  if (!editing || preview) return;
  const el = e.target.closest('.fx-el'), tile = e.target.closest('.fact'); if (!tile) return;
  const r = tile.getBoundingClientRect();
  Object.assign(fdrag, { on: true, el, tile, r, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId,
    ox: el ? el.offsetLeft : 0, oy: el ? el.offsetTop : 0 });
  if (el) { try { tile.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); }
});
$('#facts').addEventListener('pointermove', e => {
  if (!fdrag.on || !fdrag.el || e.pointerId !== fdrag.id) return;
  const dx = e.clientX - fdrag.x, dy = e.clientY - fdrag.y;
  if (!fdrag.moved && Math.hypot(dx, dy) < 4) return;
  fdrag.moved = true;
  const { r, el } = fdrag;
  const x = Math.max(0, Math.min(r.width - el.offsetWidth, fdrag.ox + dx)), y = Math.max(0, Math.min(r.height - el.offsetHeight, fdrag.oy + dy));
  el.style.left = (x / r.width * 100).toFixed(2) + '%'; el.style.top = (y / r.height * 100).toFixed(2) + '%';
});
$('#facts').addEventListener('pointerup', async e => {
  if (!fdrag.on) return; fdrag.on = false;
  const i = +fdrag.tile.dataset.fi;
  if (fdrag.moved && fdrag.el) {
    const list = factsEditable(), t = list[i];
    t.pos = { ...(t.pos || {}), [fdrag.el.dataset.el]: [parseFloat(fdrag.el.style.left), parseFloat(fdrag.el.style.top)] };
    await saveFacts(list); return;
  }
  openFact(i);
});
$('#facts').addEventListener('click', e => { if (e.target.closest('#factAdd')) { e.stopPropagation(); openFact(-1); } });

function openFact(i) {
  fxList = factsEditable();
  if (i < 0) { fxList.push({ id: 'f' + Date.now().toString(36), bg: '#f4f4f4', big: 'Nuevo', small: 'Escribe aquí un dato de tu taller', icon: 'star' }); i = fxList.length - 1; }
  fxIdx = i; ftDraft = { ...fxList[i] };
  $('#fxBig').value = ftDraft.big || ''; $('#fxSmall').value = ftDraft.small || '';
  $('#fxInk').value = ftDraft.ink || 'auto'; $('#fxIconSize').value = ftDraft.iconSize || 44;
  $('#fxIconColor').value = /^#[0-9a-f]{6}$/i.test(ftDraft.iconColor || '') ? ftDraft.iconColor : '#ff2525';
  $('#fxIcons').innerHTML = '<button type="button" class="fx-ic" data-ic="" aria-label="Sin icono">∅</button>' + Object.keys(FICONS).map(k => `<button type="button" class="fx-ic" data-ic="${k}" aria-label="Icono ${k}">${iconSVG(k)}</button>`).join('');
  $('#fxPos').textContent = `Recuadro ${i + 1} de ${fxList.length}. Para moverlos, arrastra el número, el texto o el icono directo en la página.`;
  $('#fxConfirm').hidden = true; fxRefresh(); $('#dlgFact').showModal();
}
function fxRefresh() {
  markSw('#fxBg', ftDraft.bg || ''); $('#fxBgColor').value = /^#[0-9a-f]{6}$/i.test(ftDraft.bg || '') ? ftDraft.bg : '#ffffff';
  $$('#fxIcons .fx-ic').forEach(b => b.setAttribute('aria-pressed', String(!ftDraft.iconImg && (b.dataset.ic || '') === (ftDraft.icon || ''))));
  const im = $('#fxIconImg'); im.hidden = !ftDraft.iconImg; if (ftDraft.iconImg) im.src = ftDraft.iconImg; $('#fxIconImgDel').hidden = !ftDraft.iconImg;
  $('#fxSizeVal').textContent = (ftDraft.iconSize || 44) + ' px';
  $('#fxPreview').innerHTML = factHTML(ftDraft, 0);
  $('#fxLeft').disabled = fxIdx <= 0; $('#fxRight').disabled = fxIdx >= fxList.length - 1;
}
$('#fxForm').addEventListener('input', e => {
  if (e.target.id === 'fxBgColor') ftDraft.bg = e.target.value;
  if (e.target.id === 'fxBig') ftDraft.big = e.target.value;
  if (e.target.id === 'fxSmall') ftDraft.small = e.target.value;
  if (e.target.id === 'fxIconSize') ftDraft.iconSize = +e.target.value;
  if (e.target.id === 'fxIconColor') ftDraft.iconColor = e.target.value;
  if (e.target.id === 'fxInk') ftDraft.ink = e.target.value === 'auto' ? null : e.target.value;
  fxRefresh();
});
$('#fxForm').addEventListener('change', e => { if (e.target.id === 'fxInk') { ftDraft.ink = e.target.value === 'auto' ? null : e.target.value; fxRefresh(); } });
$('#fxBg').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { ftDraft.bg = b.dataset.c; fxRefresh(); } });
$('#fxIcons').addEventListener('click', e => { const b = e.target.closest('.fx-ic'); if (!b) return; ftDraft.icon = b.dataset.ic || null; ftDraft.iconImg = null; fxRefresh(); });
$('#fxIconAuto').addEventListener('click', () => { ftDraft.iconColor = null; fxRefresh(); });
$('#fxIconFile').addEventListener('change', async e => {
  const fl = e.target.files[0]; if (!fl) return; toast('Subiendo icono…');
  try { ftDraft.iconImg = await upload(fl, 'icons', 400); fxRefresh(); toast('Icono listo. Guarda el recuadro.'); }
  catch (err) { toast('No se pudo subir el icono. Prueba con un PNG o SVG pequeño.', true); }
  e.target.value = '';
});
$('#fxIconImgDel').addEventListener('click', () => { ftDraft.iconImg = null; fxRefresh(); });
const fxMove = d => { const t = fxIdx + d; if (t < 0 || t >= fxList.length) return; fxList[fxIdx] = ftDraft; [fxList[fxIdx], fxList[t]] = [fxList[t], fxList[fxIdx]]; fxIdx = t; fxRefresh(); };
$('#fxLeft').addEventListener('click', () => fxMove(-1));
$('#fxRight').addEventListener('click', () => fxMove(1));
$('#fxResetPos').addEventListener('click', () => { ftDraft.pos = null; fxRefresh(); });
$('#fxForm').addEventListener('submit', async e => { e.preventDefault(); fxList[fxIdx] = ftDraft; if (await saveFacts(fxList)) { $('#dlgFact').close(); toast('Recuadro guardado'); } });
$('#fxDel').addEventListener('click', () => { $('#fxConfirm').hidden = false; });
$('#fxDelNo').addEventListener('click', () => { $('#fxConfirm').hidden = true; });
$('#fxDelYes').addEventListener('click', async () => { fxList.splice(fxIdx, 1); if (await saveFacts(fxList)) { $('#dlgFact').close(); toast('Recuadro quitado'); } });

/* ---------------- Admin: page settings ---------------- */
let pgLogo = '', pgFav = '';
$('#aPage').addEventListener('click', () => {
  pgLogo = S.logo_url || ''; pgFav = S.favicon_url || '';
  $('#pgName').value = S.name || ''; $('#pgWa').value = S.whatsapp || ''; $('#pgIg').value = S.instagram || ''; $('#pgFb').value = S.facebook || '';
  $('#pgTk').value = S.tiktok || ''; $('#pgEmail').value = S.email || ''; $('#pgLoc').value = S.location || ''; $('#pgHours').value = S.hours || '';
  $('#pgErr').hidden = true; pgLogoShow(); pgFavShow(); $('#dlgPage').showModal();
});
function pgLogoShow() { const i = $('#pgLogo'); i.hidden = !pgLogo; if (pgLogo) i.src = pgLogo; $('#pgLogoDel').hidden = !pgLogo; }
$('#pgFile').addEventListener('change', async e => {
  const fl = e.target.files[0]; if (!fl) return; toast('Subiendo logo…');
  try { pgLogo = await upload(fl, 'logo', 800); pgLogoShow(); toast('Logo listo. Guarda los cambios para publicarlo.'); }
  catch (err) { toast('No se pudo subir el logo. Prueba con un PNG o JPG de menos de 5 MB.', true); }
  e.target.value = '';
});
$('#pgLogoDel').addEventListener('click', () => { pgLogo = ''; pgLogoShow(); });
function pgFavShow() { const i = $('#pgFav'); i.hidden = !pgFav; if (pgFav) i.src = pgFav; $('#pgFavDel').hidden = !pgFav; }
$('#pgFavFile').addEventListener('change', async e => {
  const fl = e.target.files[0]; if (!fl) return; toast('Subiendo icono…');
  try { pgFav = await upload(fl, 'logo', 256); pgFavShow(); toast('Icono listo. Guarda los cambios para publicarlo.'); }
  catch (err) { toast('No se pudo subir el icono. Prueba con un PNG o JPG de menos de 5 MB.', true); }
  e.target.value = '';
});
$('#pgFavDel').addEventListener('click', () => { pgFav = ''; pgFavShow(); });
const waBad = () => { const d = $('#pgWa').value.replace(/\D/g, ''); return d && d.length !== 10 && d.length !== 12; };
$('#pgWa').addEventListener('blur', () => { $('#pgErr').hidden = !waBad(); $('#pgErr').textContent = 'El número de WhatsApp debe tener 10 dígitos (o 12 con el 52 de México).'; });
$('#pgForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (waBad()) { $('#pgErr').hidden = false; $('#pgErr').textContent = 'El número de WhatsApp debe tener 10 dígitos (o 12 con el 52 de México).'; $('#pgWa').focus(); return; }
  const ok = await saveSettings({ logo_url: pgLogo, favicon_url: pgFav, name: $('#pgName').value.trim() || DEF.name, whatsapp: $('#pgWa').value.trim(), instagram: $('#pgIg').value.trim(), facebook: $('#pgFb').value.trim(), tiktok: $('#pgTk').value.trim(), email: $('#pgEmail').value.trim(), location: $('#pgLoc').value.trim(), hours: $('#pgHours').value.trim() });
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
        const { error: e3 } = await sb.from('web_products').insert({ ...base, source_id: d.id, garment: g, on_rack: g !== 'sheet', in_season: false, sizes: g === 'sheet' ? ['Carta'] : ['S', 'M', 'L', 'XL', 'XXL'], sort: ++k, color: NEUTRALS[hash(d.id) % NEUTRALS.length], description: '' }); if (!e3) nuevos++;
      }
    }
    await load(); setAdmin(true);
    toast(nuevos || act ? `Importé ${nuevos} prenda(s) nueva(s) y actualicé ${act}.` : 'Tu página ya tiene todo lo del dashboard.');
  } catch (err) { toast('No pude leer tu dashboard. Vuelve a entrar e inténtalo otra vez.', true); }
  finally { btn.textContent = 'Importar del dashboard'; }
});

/* ---------------- Boot ---------------- */
RM.addEventListener?.('change', () => layoutW(true));
COL = colFromHash() || COLS[0];
renderAll();
load().then(() => { setCollection(COL, false); return checkSession(); });
sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && isAdmin) setAdmin(false); });
})();
