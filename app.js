/* Bordec Studio — catálogo con estudio de temporada (modelo + pila en perspectiva) y modo de edición */
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
const THREADS = ['#ff2525', '#006dff', '#a74dff', '#14d600'];
const NEUTRALS = ['#0b0b0b', '#1f1f1f', '#3a3a3a', '#5c5c5c', '#9b9b9b', '#d6d6d6', '#f4f4f4', '#ffffff'];
const ACCENTS = ['#ff2525', '#006dff', '#a74dff', '#14d600'];

const DEF = {
  name: 'Bordec Studio', logo_url: '', eyebrow: 'Taller de bordado y DTF',
  hero_title: 'Ropa con puntada propia.',
  hero_text: 'Playeras, sudaderas, polos y uniformes con bordado o estampado DTF. Elige un diseño de la temporada, tu talla y tu color.',
  season_word: 'Temporada 26',
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
  const color = opt.color || p.color || '#0b0b0b';
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

/* Stylised mannequin wearing the garment */
function modelSVG(p, color) {
  const arm = `<path d="M100 176 C90 250 86 350 88 452 L113 456 C117 372 121 286 130 204 Z" fill="url(#skin)"/><ellipse cx="100" cy="474" rx="12" ry="22" fill="url(#skin)"/>`;
  const garment = isApparel(p) ? `<g transform="translate(75 92) scale(1.25)">${garmentSVG(p, { bare: true, color })}</g>`
    : `<g transform="translate(110 210) scale(.9)">${garmentSVG(p, { bare: true })}</g>`;
  return `<svg class="fig-in" viewBox="0 0 400 850" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Modelo con ${esc(p.name)}">
    <g>${arm}</g><g transform="translate(400 0) scale(-1 1)">${arm}</g>
    <path d="M136 396 H200 V470 L195 810 H156 Z" fill="#0b0b0b" stroke="#3a3a3a" stroke-width="1.5"/>
    <path d="M200 396 H264 L244 810 H205 L200 470 Z" fill="#0b0b0b" stroke="#3a3a3a" stroke-width="1.5"/>
    <path d="M178 480 L176 800 M222 480 L226 800" stroke="#262626" stroke-width="2"/>
    <rect x="146" y="804" width="58" height="26" rx="12" fill="#f4f4f4"/><rect x="146" y="824" width="58" height="8" rx="4" fill="#9b9b9b"/>
    <rect x="198" y="804" width="58" height="26" rx="12" fill="#f4f4f4"/><rect x="198" y="824" width="58" height="8" rx="4" fill="#9b9b9b"/>
    ${garment}
    <path d="M183 112 H217 V160 Q200 172 183 160 Z" fill="url(#skin)"/>
    <ellipse cx="200" cy="70" rx="38" ry="48" fill="url(#headShade)"/>
  </svg>`;
}

/* ---------------- Settings / text ---------------- */
function applySettings() {
  $$('[data-k]').forEach(el => { if (document.activeElement !== el) el.textContent = S[el.dataset.k] ?? DEF[el.dataset.k] ?? ''; });
  document.title = S.name || DEF.name;
  const logo = $('#logo');
  if (S.logo_url) { logo.src = S.logo_url; logo.alt = S.name; logo.hidden = false; $('#wordmark').hidden = true; }
  else { logo.hidden = true; $('#wordmark').hidden = false; }
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
  const season = vis.filter(p => p.in_season && isApparel(p)).length;
  $('#facts').innerHTML = [
    ['dark', tees.length ? fmt(Math.min(...tees)) : '—', 'Playeras desde, estampadas o bordadas'],
    ['purple', mins.length ? `${Math.min(...mins)} pzs` : '—', 'Precio de mayoreo desde esta cantidad'],
    ['', '2 técnicas', 'Bordado a máquina y estampado DTF a todo color'],
    ['graphite', String(season).padStart(2, '0'), 'Diseños en la temporada actual']
  ].map(([c, b, s]) => `<div class="fact ${c}"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join('');
}

/* ---------------- Studio: deck + model + panel ---------------- */
const deck = $('#deck');
let SL = [];             // season list
let f = 0;               // continuous deck position
let curId = null;
const st = { size: null, color: 0, qty: 1 };
const mod = (a, n) => ((a % n) + n) % n;
const idxOf = () => SL.length ? mod(Math.round(f), SL.length) : 0;

function renderStudio(keepId) {
  SL = P.filter(p => p.in_season && isApparel(p) && (p.visible || (editing && !preview))).sort(bySort);
  if (!SL.length) SL = P.filter(p => isApparel(p) && p.visible).sort(bySort).slice(0, 8);
  deck.innerHTML = SL.map((p, i) => `<button class="dcard" type="button" role="option" data-i="${i}" aria-label="${esc(p.name)}, ${priceLabel(p)}">
      <span class="dcard-vis">${garmentSVG(p)}</span>
      <span class="dcard-info"><span class="dcard-name">${esc(p.name)}</span><span class="dcard-price">${priceLabel(p)}</span></span>
    </button>`).join('');
  const k = keepId ? SL.findIndex(p => p.id === keepId) : -1;
  f = k >= 0 ? k : 0;
  $('#stOf').textContent = '/ ' + String(SL.length).padStart(2, '0');
  layout();
  select(true);
}
function layout() {
  const n = SL.length, cards = deck.children, mobile = innerWidth < 700;
  for (let i = 0; i < cards.length; i++) {
    let d = i - f; if (n > 4) d = mod(d + n / 2, n) - n / 2;
    const a = Math.abs(d), s = Math.sign(d);
    const y = s * (Math.min(a, 1) * (mobile ? 64 : 60) + Math.max(a - 1, 0) * (mobile ? 40 : 38));
    const rot = s * Math.min(a, 2.4) * (mobile ? 24 : 26);
    const sc = 1 - Math.min(a, 3) * .07;
    const op = a > 2.6 ? 0 : a > 1.8 ? 1 - (a - 1.8) * 1.25 : 1;
    const c = cards[i];
    c.style.transform = `translateY(${y.toFixed(2)}%) translateZ(${(-a * 60).toFixed(1)}px) rotateX(${rot.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
    c.style.opacity = op.toFixed(3);
    c.style.filter = RM.matches || a < .5 ? 'none' : `blur(${Math.min(a, 2) * 1.4}px)`;
    c.style.zIndex = String(100 - Math.round(a * 10));
    c.style.pointerEvents = op < .2 ? 'none' : '';
    c.tabIndex = a < .5 ? 0 : -1;
    c.classList.toggle('is-active', a < .5);
    c.setAttribute('aria-selected', a < .5 ? 'true' : 'false');
  }
}
function goTo(i) {
  if (!SL.length) return;
  const n = SL.length; let delta = mod(i - f, n); if (delta > n / 2) delta -= n;
  f = Math.round(f + delta); layout(); select();
}
const step = dir => { f = Math.round(f) + dir; layout(); select(); };

function select(force) {
  const p = SL[idxOf()]; if (!p) { $('#stName').textContent = 'Pronto habrá diseños aquí'; return; }
  if (!force && p.id === curId) return;
  curId = p.id; st.size = null; st.color = 0;
  const inBag = bag.find(b => b.id === p.id); st.qty = 1;
  $('#stIdx').textContent = String(idxOf() + 1).padStart(2, '0');
  $('#stCat').textContent = p.category;
  $('#stName').textContent = p.name;
  $('#stPrice').textContent = priceLabel(p);
  $('#stWs').textContent = p.wholesale_price && p.wholesale_min ? `Mayoreo ${fmt(p.wholesale_price)} c/u desde ${p.wholesale_min} pzs` : '';
  $('#stQty').value = st.qty;
  renderOptions('st', p, st);
  drawModel(p);
  stTotals();
  void inBag;
}
function drawModel(p) {
  const fig = $('#stageFig'), col = colorsOf(p)[st.color];
  if (p.model_url) {
    fig.innerHTML = `<img class="fig-in" src="${esc(p.model_url)}" alt="Modelo con ${esc(p.name)}">`;
    $('#stageNote').hidden = true;
  } else {
    fig.innerHTML = modelSVG(p, col ? col.h : p.color);
    $('#stageNote').hidden = false;
  }
}
/* sizes + colors renderer shared by the studio panel and the product dialog */
function renderOptions(prefix, p, state) {
  const sizes = sizesOf(p), cols = colorsOf(p);
  if (!state.size || !sizes.includes(state.size)) state.size = sizes.includes('M') ? 'M' : sizes[0];
  $(`#${prefix}Sizes`).innerHTML = sizes.map(s => `<button type="button" class="size" role="radio" aria-checked="${s === state.size}" data-size="${esc(s)}">${esc(s)}</button>`).join('');
  $(`#${prefix}SizesBox`).hidden = sizes.length < 2 && sizes[0] === 'Carta';
  $(`#${prefix}ColorsBox`).hidden = !cols.length;
  $(`#${prefix}Colors`).innerHTML = cols.map((c, i) => `<button type="button" class="cswatch" role="radio" aria-checked="${i === state.color}" aria-label="${esc(c.n)}" title="${esc(c.n)}" data-color="${i}" style="background:${c.h}"></button>`).join('');
  $(`#${prefix}ColorName`).textContent = cols[state.color] ? cols[state.color].n : '';
}
function stTotals() {
  const p = SL[idxOf()]; if (!p) return;
  const q = st.qty = Math.max(1, parseInt($('#stQty').value, 10) || 1);
  if (Number(p.price) > 0) { const u = unitPrice(p, q); $('#stTotal').textContent = `${q} × ${fmt(u)} = ${fmt(u * q)}${u < p.price ? ' · mayoreo' : ''}`; }
  else $('#stTotal').textContent = 'Precio a cotizar';
  const c = colorsOf(p)[st.color];
  const wa = waLink(`Hola ${S.name}, me interesa: ${q} × ${p.name}${st.size ? `, talla ${st.size}` : ''}${c ? `, color ${c.n}` : ''}. ¿Me das más información?`);
  const a = $('#stWa'); if (wa) { a.href = wa; a.removeAttribute('aria-disabled'); } else { a.href = '#contacto'; }
}
$('#stSizes').addEventListener('click', e => { const b = e.target.closest('[data-size]'); if (!b) return; st.size = b.dataset.size; renderOptions('st', SL[idxOf()], st); stTotals(); });
$('#stColors').addEventListener('click', e => { const b = e.target.closest('[data-color]'); if (!b) return; st.color = +b.dataset.color; const p = SL[idxOf()]; renderOptions('st', p, st); drawModel(p); stTotals(); });
$('#stQty').addEventListener('input', stTotals);
$('#stMinus').addEventListener('click', () => { $('#stQty').value = Math.max(1, (+$('#stQty').value || 1) - 1); stTotals(); });
$('#stPlus').addEventListener('click', () => { $('#stQty').value = (+$('#stQty').value || 0) + 1; stTotals(); });
$('#stAdd').addEventListener('click', () => { const p = SL[idxOf()]; if (p) addToBag(p, st.qty, st.size, colorsOf(p)[st.color]); });
$('#stWa').addEventListener('click', e => { if (!waNumber()) { e.preventDefault(); toast(isAdmin ? 'Agrega tu WhatsApp en «Logo y contacto».' : 'Pronto podrás pedir por WhatsApp desde aquí.', true); } });

/* deck interaction: drag, click, wheel, keys */
const drag = { on: false, y: 0, f0: 0, moved: false, id: null, t: 0, ly: 0, v: 0 };
const stepPx = () => (deck.firstElementChild ? deck.firstElementChild.offsetHeight : 280) * .6;
deck.addEventListener('pointerdown', e => {
  if (e.button !== 0 || !SL.length) return;
  Object.assign(drag, { on: true, y: e.clientY, f0: f, moved: false, id: e.pointerId, t: performance.now(), ly: e.clientY, v: 0 });
});
deck.addEventListener('pointermove', e => {
  if (!drag.on || e.pointerId !== drag.id) return;
  const dy = e.clientY - drag.y;
  if (!drag.moved && Math.abs(dy) > 6) { drag.moved = true; deck.classList.add('dragging'); try { deck.setPointerCapture(e.pointerId); } catch (_) {} }
  if (!drag.moved) return;
  const now = performance.now(); drag.v = (e.clientY - drag.ly) / Math.max(1, now - drag.t); drag.ly = e.clientY; drag.t = now;
  f = drag.f0 - dy / stepPx(); layout();
});
const endDrag = e => {
  if (!drag.on) return; drag.on = false; deck.classList.remove('dragging');
  if (drag.moved) { f = Math.round(f - Math.max(-1.5, Math.min(1.5, drag.v * 1.2))); layout(); select(); }
  else { const c = e && e.target.closest && e.target.closest('.dcard'); if (c) { const i = +c.dataset.i; if (i === idxOf()) { $('#stAdd').focus({ preventScroll: true }); } goTo(i); } }
};
deck.addEventListener('pointerup', endDrag);
deck.addEventListener('pointercancel', () => { if (drag.on) { drag.on = false; deck.classList.remove('dragging'); f = Math.round(f); layout(); select(); } });
let wheelAcc = 0, wheelLock = 0;
deck.addEventListener('wheel', e => {
  if (!SL.length) return; e.preventDefault();
  const now = performance.now(); wheelAcc += e.deltaY;
  if (now > wheelLock && Math.abs(wheelAcc) > 30) { step(Math.sign(wheelAcc)); wheelAcc = 0; wheelLock = now + 280; }
}, { passive: false });
deck.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { step(1); e.preventDefault(); }
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.dcard')) { e.preventDefault(); goTo(+e.target.closest('.dcard').dataset.i); }
});
$('#deckPrev').addEventListener('click', () => step(-1));
$('#deckNext').addEventListener('click', () => step(1));
addEventListener('resize', () => layout());

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
  const ws = p.wholesale_price && p.wholesale_min ? `<span class="card-ws">Mayoreo ${fmt(p.wholesale_price)} · ${p.wholesale_min}+ pzs</span>` : '';
  const action = editing && !preview ? `<button class="btn btn-dark card-add" type="button" data-edit="${p.id}">Editar</button>`
    : `<button class="btn btn-dark card-add" type="button" data-open="${p.id}">${sizesOf(p).length > 1 || colorsOf(p).length > 1 ? 'Elegir' : 'Agregar'}</button>`;
  return `<article class="card">
    <div class="card-visual" data-open="${p.id}" role="button" tabindex="0" aria-label="Ver ${esc(p.name)}">
      ${p.badge ? `<span class="card-badge">${esc(p.badge)}</span>` : ''}${p.in_season ? '<span class="card-season">Temporada</span>' : ''}${p.visible ? '' : '<span class="card-hidden">Oculta</span>'}
      ${garmentSVG(p)}
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
function openProduct(id) {
  if (editing && !preview) return openEditor(id);
  const p = P.find(x => x.id === id); if (!p) return;
  const si = SL.findIndex(x => x.id === id);
  if (si >= 0) { goTo(si); $('#temporada').scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth', block: 'start' }); return; }
  cur = p; pd.size = null; pd.color = 0;
  $('#pdVisual').innerHTML = garmentSVG(p);
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
$('#pdColors').addEventListener('click', e => { const b = e.target.closest('[data-color]'); if (!b) return; pd.color = +b.dataset.color; renderOptions('pd', cur, pd); $('#pdVisual').innerHTML = garmentSVG(cur, { color: colorsOf(cur)[pd.color].h }); pdTotal(); });
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
    const opts = [b.size && `Talla ${b.size}`, b.cn && b.cn].filter(Boolean).join(' · ');
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
function renderAll() { applySettings(); renderFacts(); renderStudio(curId); renderCatalog(); renderBag(); }

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
  if (P.length || on) { renderStudio(curId); renderCatalog(); applySettings(); updateSend(); }
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
  S = next; applySettings(); updateSend(); stTotals(); toast('Cambio guardado'); return true;
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
  ed = p ? { ...p } : { id: null, name: 'Nueva prenda', category: cat !== 'Todas' ? cat : 'Diseños DTF personalizado', description: '', price: 0, wholesale_price: null, wholesale_min: null, garment: 'tee', color: '#0b0b0b', image_url: null, model_url: null, sizes: ['S', 'M', 'L', 'XL'], colors: [], in_season: true, visible: true, badge: '', sort: (Math.max(0, ...P.map(x => x.sort || 0)) + 1) };
  $('#edTitle').textContent = p ? 'Editar prenda' : 'Nueva prenda';
  $('#edName').value = ed.name; $('#edCat').value = ed.category; $('#edDesc').value = ed.description || '';
  $('#edGarment').value = ed.garment; $('#edPrice').value = ed.price || ''; $('#edWs').value = ed.wholesale_price ?? ''; $('#edWsMin').value = ed.wholesale_min ?? '';
  $('#edSizes').value = (ed.sizes || []).join(', '); $('#edColors').value = colorsToText(ed.colors);
  $('#edBadge').value = ed.badge || ''; $('#edSort').value = ed.sort ?? 0;
  $('#edSeason').checked = !!ed.in_season; $('#edVisible').checked = !!ed.visible;
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
  ed.in_season = $('#edSeason').checked; ed.visible = $('#edVisible').checked;
}
function edPreview() { const p = { ...ed, name: ed.name || 'Prenda' }; $('#edPreview').innerHTML = p.model_url ? `<img src="${esc(p.model_url)}" alt="">` : (isApparel(p) ? modelSVG(p, p.color) : garmentSVG(p)); }
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
  const row = { name: ed.name, category: ed.category, description: ed.description, price: ed.price, wholesale_price: ed.wholesale_price, wholesale_min: ed.wholesale_min, garment: ed.garment, color: ed.color, image_url: ed.image_url, model_url: ed.model_url, sizes: ed.sizes, colors: ed.colors, in_season: ed.in_season, visible: ed.visible, badge: ed.badge, sort: ed.sort, updated_at: new Date().toISOString() };
  $('#edSave').textContent = 'Guardando…';
  const { data, error } = await (ed.id ? sb.from('web_products').update(row).eq('id', ed.id).select().single() : sb.from('web_products').insert(row).select().single());
  $('#edSave').textContent = 'Guardar prenda';
  if (error) { $('#edErr').hidden = false; $('#edErr').textContent = 'No se guardó. Revisa tu conexión e inténtalo otra vez.'; return; }
  const n = norm(data); const i = P.findIndex(x => x.id === n.id); if (i >= 0) P[i] = n; else P.push(n);
  $('#dlgEdit').close(); renderFacts(); renderStudio(n.id); renderCatalog(); toast(`Guardaste «${n.name}»`);
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
$('#stage').addEventListener('click', () => { if (editing && !preview && curId) openEditor(curId); });

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
  const fl = e.target.files[0]; if (!fl) return; toast('Subiendo logo…');
  try { pgLogo = await upload(fl, 'logo', 800); pgLogoShow(); toast('Logo listo. Guarda los cambios para publicarlo.'); }
  catch (err) { toast('No se pudo subir el logo. Prueba con un PNG o JPG de menos de 5 MB.', true); }
  e.target.value = '';
});
$('#pgLogoDel').addEventListener('click', () => { pgLogo = ''; pgLogoShow(); });
const waBad = () => { const d = $('#pgWa').value.replace(/\D/g, ''); return d && d.length !== 10 && d.length !== 12; };
$('#pgWa').addEventListener('blur', () => { $('#pgErr').hidden = !waBad(); $('#pgErr').textContent = 'El número de WhatsApp debe tener 10 dígitos (o 12 con el 52 de México).'; });
$('#pgForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (waBad()) { $('#pgErr').hidden = false; $('#pgErr').textContent = 'El número de WhatsApp debe tener 10 dígitos (o 12 con el 52 de México).'; $('#pgWa').focus(); return; }
  const ok = await saveSettings({ logo_url: pgLogo, name: $('#pgName').value.trim() || DEF.name, whatsapp: $('#pgWa').value.trim(), instagram: $('#pgIg').value.trim(), facebook: $('#pgFb').value.trim(), tiktok: $('#pgTk').value.trim(), email: $('#pgEmail').value.trim(), location: $('#pgLoc').value.trim(), hours: $('#pgHours').value.trim() });
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
RM.addEventListener?.('change', layout);
renderAll();
load().then(checkSession);
sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && isAdmin) setAdmin(false); });
})();
