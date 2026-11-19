// ════════════════════════════════════════════════════════════════
//  ARTEMIS — Relais Smoobu (Cloudflare Worker)
//
//  Le site ne peut pas appeler l'API Smoobu directement (Smoobu l'interdit
//  depuis un navigateur, et la clé doit rester secrète). Ce relais :
//    1. vérifie que la personne est connectée à ARTEMIS (jeton Firebase)
//       et que son e-mail fait partie des personnes autorisées ;
//    2. signe la requête vers Smoobu (HMAC-SHA256, clé + secret) ;
//    3. renvoie au site une version allégée des réservations.
//
//  Réglages (Cloudflare › Worker › Settings › Variables and Secrets) :
//    SMOOBU_API_KEY      (Secret)  clé API Smoobu
//    SMOOBU_API_SECRET   (Secret)  secret associé
//    FIREBASE_PROJECT_ID (Texte)   artemis-sci
//    ALLOWED_ORIGINS     (Texte)   https://medenzo1.github.io,http://localhost:8765
//    ALLOWED_EMAILS      (Texte)   e-mails autorisés, séparés par des virgules
//
//  Routes : GET /apartments · GET /reservations?from=AAAA-MM-JJ&to=AAAA-MM-JJ · GET /health
// ════════════════════════════════════════════════════════════════

const SMOOBU = 'https://login.smoobu.com';
const GOOGLE_JWK = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const CACHE_SECONDS = 120;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const allowed = list(env.ALLOWED_ORIGINS);
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || '',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

    try {
      if (request.method !== 'GET') return reply(405, { error: 'Méthode non autorisée' });
      const url = new URL(request.url);
      if (url.pathname === '/health') {
        return reply(200, { ok: true, configured: !!(env.SMOOBU_API_KEY && env.SMOOBU_API_SECRET && env.FIREBASE_PROJECT_ID && env.ALLOWED_EMAILS) });
      }
      if (origin && !allowed.includes(origin)) return reply(403, { error: 'Origine non autorisée' });

      // 1. Qui appelle ?
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      if (!token) return reply(401, { error: 'Connexion ARTEMIS requise' });
      let user;
      try { user = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID, ctx); }
      catch (e) { return reply(401, { error: 'Session invalide ou expirée', detail: String(e.message || e) }); }
      const emails = list(env.ALLOWED_EMAILS).map(e => e.toLowerCase());
      if (!user.email || !emails.includes(String(user.email).toLowerCase())) return reply(403, { error: 'Compte non autorisé pour Smoobu' });
      if (!env.SMOOBU_API_KEY || !env.SMOOBU_API_SECRET) return reply(500, { error: 'Clé Smoobu non configurée dans Cloudflare' });

      // 2. Quoi ?
      if (url.pathname === '/apartments') {
        const data = await cached(ctx, 'apartments', () => smoobu(env, '/api/apartments', {}));
        return reply(200, { apartments: (data.apartments || []).map(a => ({ id: a.id, name: a.name })) });
      }
      if (url.pathname === '/reservations') {
        const from = url.searchParams.get('from'), to = url.searchParams.get('to');
        const re = /^\d{4}-\d{2}-\d{2}$/;
        if (!re.test(from || '') || !re.test(to || '') || from > to) return reply(400, { error: 'Paramètres from/to invalides (AAAA-MM-JJ)' });
        if ((Date.parse(to) - Date.parse(from)) / 864e5 > 400) return reply(400, { error: 'Période trop longue (400 jours maximum)' });
        const bookings = await cached(ctx, 'res:' + from + ':' + to, () => allReservations(env, from, to));
        return reply(200, { from, to, count: bookings.length, reservations: bookings });
      }
      return reply(404, { error: 'Route inconnue' });
    } catch (e) {
      const status = e.status && e.status >= 400 && e.status < 600 ? (e.status === 401 ? 502 : e.status) : 500;
      return reply(status, { error: e.message || 'Erreur interne', smoobuStatus: e.status || null });
    }
  },
};

// ── Smoobu ──────────────────────────────────────────────────────────
async function allReservations(env, from, to) {
  const out = [];
  let page = 1, pages = 1;
  do {
    const data = await smoobu(env, '/api/reservations', { from, to, page: String(page), pageSize: '100' });
    pages = Math.min(+data.page_count || 1, 30);
    (data.bookings || []).forEach(b => {
      if (b.type === 'cancellation') return;
      out.push({
        id: b.id,
        ref: b['reference-id'] || '',
        type: b.type || '',
        blocked: !!b['is-blocked-booking'],
        arrival: b.arrival,
        departure: b.departure,
        apartment: b.apartment ? { id: b.apartment.id, name: b.apartment.name } : null,
        channel: b.channel ? b.channel.name || '' : '',
        guest: b['guest-name'] || '',
        adults: +b.adults || 0,
        children: +b.children || 0,
        price: b.price != null ? +b.price : null,
        paid: b['price-paid'] === 'Yes',
        checkIn: b['check-in'] || '',
        checkOut: b['check-out'] || '',
        notice: b.notice || '',
        created: b['created-at'] || '',
      });
    });
    page++;
  } while (page <= pages);
  return out;
}

// Requête signée (HMAC-SHA256) : METHOD \n path \n query triée \n timestamp \n nonce \n sha256(corps) \n clé
async function smoobu(env, path, params) {
  const query = Object.keys(params).sort().map(k => rfc3986(k) + '=' + rfc3986(params[k])).join('&');
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const nonce = crypto.randomUUID();
  const bodyHash = await sha256Hex('');
  const canonical = ['GET', path, query, timestamp, nonce, bodyHash, env.SMOOBU_API_KEY].join('\n');
  const signature = await hmacBase64(env.SMOOBU_API_SECRET, canonical);
  const res = await fetch(SMOOBU + path + (query ? '?' + query : ''), {
    headers: { 'X-API-Key': env.SMOOBU_API_KEY, 'X-Timestamp': timestamp, 'X-Nonce': nonce, 'X-Signature': signature, 'Accept': 'application/json' },
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 300); } catch (e) {}
    const err = new Error('Smoobu a répondu ' + res.status + (detail ? ' : ' + detail : ''));
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Petit cache (2 min) pour ne pas solliciter Smoobu à chaque clic
async function cached(ctx, key, produce) {
  const cache = caches.default;
  const req = new Request('https://cache.artemis/' + encodeURIComponent(key));
  const hit = await cache.match(req);
  if (hit) return hit.json();
  const data = await produce();
  const res = new Response(JSON.stringify(data), { headers: { 'Cache-Control': 'max-age=' + CACHE_SECONDS, 'Content-Type': 'application/json' } });
  if (ctx && ctx.waitUntil) ctx.waitUntil(cache.put(req, res)); else await cache.put(req, res);
  return data;
}

// ── Vérification du jeton Firebase (RS256, clés publiques Google) ──
let _jwks = null, _jwksExp = 0;
async function googleKeys() {
  if (_jwks && Date.now() < _jwksExp) return _jwks;
  const res = await fetch(GOOGLE_JWK);
  if (!res.ok) throw new Error('Clés Google indisponibles');
  const m = /max-age=(\d+)/.exec(res.headers.get('Cache-Control') || '');
  _jwks = (await res.json()).keys || [];
  _jwksExp = Date.now() + (m ? +m[1] : 3600) * 1000;
  return _jwks;
}
async function verifyFirebaseToken(token, projectId, ctx) {
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID manquant');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Jeton mal formé');
  const header = JSON.parse(b64urlText(parts[0]));
  const payload = JSON.parse(b64urlText(parts[1]));
  if (header.alg !== 'RS256') throw new Error('Algorithme inattendu');
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw new Error('Audience invalide');
  if (payload.iss !== 'https://securetoken.google.com/' + projectId) throw new Error('Émetteur invalide');
  if (!payload.sub) throw new Error('Utilisateur absent');
  if (!(payload.exp > now - 60)) throw new Error('Jeton expiré');
  if (!(payload.iat <= now + 300)) throw new Error('Jeton daté du futur');
  const jwk = (await googleKeys()).find(k => k.kid === header.kid);
  if (!jwk) throw new Error('Clé de signature inconnue');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok) throw new Error('Signature invalide');
  return { uid: payload.sub, email: payload.email || '' };
}

// ── Utilitaires ──
function list(v) { return String(v || '').split(',').map(s => s.trim()).filter(Boolean); }
function rfc3986(s) { return encodeURIComponent(String(s)).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase()); }
function b64urlBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlText(s) { return new TextDecoder().decode(b64urlBytes(s)); }
async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hmacBase64(secret, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
  let bin = ''; sig.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}
