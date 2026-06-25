require('dotenv').config();
const express    = require('express');
const helmet     = require('helmet');
const path       = require('path');
const fs         = require('fs');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const cookieParser = require('cookie-parser');
const rateLimit  = require('express-rate-limit');

const IS_PROD = process.env.NODE_ENV === 'production';

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET   = process.env.JWT_SECRET || 'kenzproject_fallback_secret';
const JWT_EXPIRES  = '24h';
const USERS_PATH   = path.join(__dirname, 'data', 'users.json');

// ── Cache ──────────────────────────────────────────────────────────────────
const priceCache  = { data: {}, ts: 0 };
const globalCache = { data: null, ts: 0 };
const PRICE_CACHE_TTL  = 5  * 1000;
const GLOBAL_CACHE_TTL = 60 * 1000;

// ── Yahoo session ──────────────────────────────────────────────────────────
let yhSession = { crumb: null, cookie: null, ts: 0 };
const SESSION_TTL = 12 * 60 * 60 * 1000;
const YH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function getYahooSession() {
  if (yhSession.crumb && Date.now() - yhSession.ts < SESSION_TTL) return yhSession;
  const r1 = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': YH_UA }, redirect: 'follow' });
  const rawCookie = r1.headers.get('set-cookie') || '';
  const cookieStr = rawCookie.split(',').map(c => c.trim().split(';')[0]).filter(c => c.includes('=')).join('; ');
  const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': YH_UA, 'Cookie': cookieStr }
  });
  const crumb = (await r2.text()).trim();
  yhSession = { crumb, cookie: cookieStr, ts: Date.now() };
  console.log('[Session] Diperbarui:', crumb ? 'OK' : 'GAGAL');
  return yhSession;
}

async function fetchYahooQuotes(symbols) {
  const session = await getYahooSession();
  const url = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=' + symbols.join(',') +
    '&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,' +
    'regularMarketVolume,regularMarketDayHigh,regularMarketDayLow&crumb=' +
    encodeURIComponent(session.crumb);
  const resp = await fetch(url, {
    headers: { 'User-Agent': YH_UA, 'Cookie': session.cookie, 'Accept': 'application/json' }
  });
  if (resp.status === 401) { yhSession.ts = 0; throw new Error('Sesi berakhir'); }
  if (!resp.ok) throw new Error('Gagal mengambil data');
  const json = await resp.json();
  return (json.quoteResponse && json.quoteResponse.result) || [];
}

// ── Users helper ────────────────────────────────────────────────────────────
function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8')); }
  catch { return []; }
}
function writeUsers(users) {
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
}

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'", "'unsafe-inline'", "s3.tradingview.com", "*.tradingview.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:      ["'self'", "'unsafe-inline'", "*.tradingview.com"],
      imgSrc:        ["'self'", "data:", "*.tradingview.com"],
      frameSrc:      ["*.tradingview.com"],
      connectSrc:    ["'self'", "*.tradingview.com"],
      fontSrc:       ["'self'", "https:", "data:", "*.tradingview.com"],
    },
  },
}));
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());

// Rate limiting — blokir brute force login (max 10 percobaan / 15 menit per IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
  skipSuccessfulRequests: true,
});

// Auth middleware
function authRequired(roles) {
  return function(req, res, next) {
    const token = req.cookies && req.cookies.kenz_token;
    if (!token) return res.status(401).json({ error: 'Tidak terautentikasi' });
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (roles && !roles.includes(payload.role))
        return res.status(403).json({ error: 'Akses ditolak' });
      req.user = payload;
      next();
    } catch {
      res.clearCookie('kenz_token');
      return res.status(401).json({ error: 'Sesi tidak valid' });
    }
  };
}

// Page guard middleware — redirect to /login if not authenticated
function pageGuard(roles) {
  return function(req, res, next) {
    const token = req.cookies && req.cookies.kenz_token;
    if (!token) return res.redirect('/login');
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (roles && !roles.includes(payload.role)) return res.redirect('/login');
      req.user = payload;
      next();
    } catch {
      res.clearCookie('kenz_token');
      return res.redirect('/login');
    }
  };
}

// ── Public: static assets (css, js) but NOT html pages ─────────────────────
app.use('/style.css', express.static(path.join(__dirname, 'public', 'style.css')));

// ── Auth routes ─────────────────────────────────────────────────────────────
app.get('/login', (req, res) => {
  // Already logged in → redirect
  const token = req.cookies && req.cookies.kenz_token;
  if (token) {
    try {
      const p = jwt.verify(token, JWT_SECRET);
      return res.redirect(p.role === 'developer' ? '/developer' : p.role === 'admin' ? '/admin' : '/');
    } catch {}
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username dan password wajib diisi' });
  const users = readUsers();
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Username atau password salah' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Username atau password salah' });
  const token = jwt.sign({ id: user.id, username: user.username, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.cookie('kenz_token', token, { httpOnly: true, sameSite: 'strict', secure: IS_PROD, maxAge: 24 * 60 * 60 * 1000 });
  res.json({ ok: true, role: user.role, name: user.name });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('kenz_token');
  res.json({ ok: true });
});

app.get('/api/auth/me', authRequired(), (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, name: req.user.name, role: req.user.role });
});

// ── Protected pages ──────────────────────────────────────────────────────────
app.get('/', pageGuard(['user','admin','developer']), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', pageGuard(['admin','developer']), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/developer', pageGuard(['developer']), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'developer.html'));
});

// Demo publik — tanpa login, hanya /api/prices & /api/global yang diizinkan via flag
app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Admin API: user management ───────────────────────────────────────────────
app.get('/api/users', authRequired(['admin','developer']), (req, res) => {
  const users = readUsers().map(u => ({ id: u.id, username: u.username, name: u.name, role: u.role }));
  res.json(users);
});

app.post('/api/users', authRequired(['admin','developer']), async (req, res) => {
  const { username, password, name, role } = req.body || {};
  if (!username || !password || !name || !role) return res.status(400).json({ error: 'Semua field wajib diisi' });
  if (!['user','admin','developer'].includes(role)) return res.status(400).json({ error: 'Role tidak valid' });
  const users = readUsers();
  if (users.find(u => u.username === username)) return res.status(409).json({ error: 'Username sudah digunakan' });
  const id = String(Date.now());
  const hashed = await bcrypt.hash(password, 10);
  users.push({ id, username, password: hashed, name, role });
  writeUsers(users);
  res.json({ ok: true, id });
});

app.put('/api/users/:id', authRequired(['admin','developer']), async (req, res) => {
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User tidak ditemukan' });
  // Developer-only can change own/other developer roles
  if (users[idx].role === 'developer' && req.user.role !== 'developer')
    return res.status(403).json({ error: 'Tidak bisa edit akun developer' });
  const { name, role, password } = req.body || {};
  if (name) users[idx].name = name;
  if (role) {
    if (!['user','admin','developer'].includes(role))
      return res.status(400).json({ error: 'Role tidak valid' });
    // Hanya developer yang boleh set role developer
    if (role === 'developer' && req.user.role !== 'developer')
      return res.status(403).json({ error: 'Hanya developer yang dapat menetapkan role developer' });
    users[idx].role = role;
  }
  if (password) users[idx].password = await bcrypt.hash(password, 10);
  writeUsers(users);
  res.json({ ok: true });
});

app.delete('/api/users/:id', authRequired(['admin','developer']), (req, res) => {
  let users = readUsers();
  const target = users.find(u => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'User tidak ditemukan' });
  if (target.role === 'developer' && req.user.role !== 'developer')
    return res.status(403).json({ error: 'Tidak bisa hapus akun developer' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Tidak bisa hapus akun sendiri' });
  users = users.filter(u => u.id !== req.params.id);
  writeUsers(users);
  res.json({ ok: true });
});

// ── Developer API: system info ────────────────────────────────────────────────
app.get('/api/dev/system', authRequired(['developer']), (req, res) => {
  res.json({
    uptime: Math.floor(process.uptime()),
    memory: process.memoryUsage(),
    nodeVersion: process.version,
    priceCache: { size: Object.keys(priceCache.data).length, age: Date.now() - priceCache.ts },
    globalCache: { hasData: !!globalCache.data, age: Date.now() - globalCache.ts },
    yhSession: { active: !!(yhSession.crumb), age: Date.now() - yhSession.ts },
    users: readUsers().length,
  });
});

app.post('/api/dev/cache/clear', authRequired(['developer']), (req, res) => {
  priceCache.data = {}; priceCache.ts = 0;
  globalCache.data = null; globalCache.ts = 0;
  yhSession.ts = 0;
  res.json({ ok: true, message: 'Cache dan session berhasil direset' });
});

// ── IDX Stocks list ──────────────────────────────────────────────────────────
app.get('/api/idx-stocks', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(__dirname, 'data', 'idx-stocks.json'));
});

// ── Price & Global API (protected) ───────────────────────────────────────────
app.get('/api/prices', async (req, res) => {
  const tickers = (req.query.tickers || '').split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
  if (!tickers.length) return res.status(400).json({ error: 'Parameter tickers wajib diisi' });
  const now = Date.now();
  if (tickers.every(t => priceCache.data[t]) && now - priceCache.ts < PRICE_CACHE_TTL) {
    const cached = {};
    tickers.forEach(t => { cached[t] = priceCache.data[t]; });
    return res.json({ prices: cached });
  }
  try {
    const yhSymbols = tickers.map(t => t.startsWith('^') ? t : t + '.JK');
    const quotes = await fetchYahooQuotes(yhSymbols);
    const results = {};
    quotes.forEach(q => {
      const ticker = q.symbol.startsWith('^') ? q.symbol : q.symbol.replace('.JK', '');
      results[ticker] = {
        last: q.regularMarketPrice || 0,
        change: q.regularMarketChange || 0,
        changePct: q.regularMarketChangePercent || 0,
        volume: q.regularMarketVolume || 0,
        high: q.regularMarketDayHigh || 0,
        low: q.regularMarketDayLow || 0,
      };
    });
    tickers.forEach(t => { if (!results[t]) results[t] = { error: 'Tidak ditemukan' }; });
    Object.assign(priceCache.data, results);
    priceCache.ts = now;
    res.json({ prices: results });
  } catch (err) {
    console.error('[prices]', err.message);
    res.status(500).json({ error: 'Gagal mengambil data harga' });
  }
});

const GLOBAL_SYMBOLS = [
  { symbol: '^DJI',     name: 'Dow Jones' },
  { symbol: '^IXIC',    name: 'Nasdaq' },
  { symbol: '^GSPC',    name: 'S&P 500' },
  { symbol: '^N225',    name: 'Nikkei 225' },
  { symbol: '^HSI',     name: 'Hang Seng' },
  { symbol: '^FTSE',    name: 'FTSE 100' },
  { symbol: '^GDAXI',   name: 'DAX' },
  { symbol: '^JKSE',    name: 'IHSG' },
  { symbol: 'USDIDR=X', name: 'USD/IDR' },
];

app.get('/api/global', async (req, res) => {
  const now = Date.now();
  if (globalCache.data && now - globalCache.ts < GLOBAL_CACHE_TTL)
    return res.json({ data: globalCache.data });
  try {
    const quotes = await fetchYahooQuotes(GLOBAL_SYMBOLS.map(s => s.symbol));
    const results = [];
    quotes.forEach(q => {
      const meta = GLOBAL_SYMBOLS.find(s => s.symbol === q.symbol);
      if (!meta) return;
      results.push({ symbol: q.symbol, name: meta.name, price: q.regularMarketPrice || 0,
        change: q.regularMarketChange || 0, changePct: q.regularMarketChangePercent || 0 });
    });
    globalCache.data = results; globalCache.ts = now;
    res.json({ data: results });
  } catch (err) {
    console.error('[global]', err.message);
    res.status(500).json({ error: 'Gagal mengambil data global' });
  }
});

const CRYPTO_SYMBOLS = [
  { symbol: 'BTC-USD',  name: 'Bitcoin',  short: 'BTC'  },
  { symbol: 'ETH-USD',  name: 'Ethereum', short: 'ETH'  },
  { symbol: 'BNB-USD',  name: 'BNB',      short: 'BNB'  },
  { symbol: 'SOL-USD',  name: 'Solana',   short: 'SOL'  },
  { symbol: 'XRP-USD',  name: 'XRP',      short: 'XRP'  },
  { symbol: 'ADA-USD',  name: 'Cardano',  short: 'ADA'  },
  { symbol: 'DOGE-USD', name: 'Dogecoin', short: 'DOGE' },
  { symbol: 'AVAX-USD', name: 'Avalanche',short: 'AVAX' },
];

const cryptoCache = { data: null, ts: 0 };
const CRYPTO_CACHE_TTL = 30 * 1000;

app.get('/api/crypto', async (req, res) => {
  const now = Date.now();
  if (cryptoCache.data && now - cryptoCache.ts < CRYPTO_CACHE_TTL)
    return res.json({ data: cryptoCache.data });
  try {
    const quotes = await fetchYahooQuotes(CRYPTO_SYMBOLS.map(s => s.symbol));
    const results = [];
    quotes.forEach(q => {
      const meta = CRYPTO_SYMBOLS.find(s => s.symbol === q.symbol);
      if (!meta) return;
      results.push({ symbol: q.symbol, name: meta.name, short: meta.short,
        price: q.regularMarketPrice || 0,
        change: q.regularMarketChange || 0,
        changePct: q.regularMarketChangePercent || 0 });
    });
    cryptoCache.data = results; cryptoCache.ts = now;
    res.json({ data: results });
  } catch (err) {
    console.error('[crypto]', err.message);
    res.status(500).json({ error: 'Gagal mengambil data crypto' });
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('Trading Dashboard berjalan di http://localhost:' + PORT);
  getYahooSession().catch(e => console.warn('[Session] Gagal init:', e.message));
});
