# 📈 BEI Trading Dashboard

**Real-time Indonesian Stock Exchange (IDX) trading analysis dashboard** built with Node.js + Express and vanilla HTML/CSS/JS.

> Developed by **KenzProject**

---

## Fitur Utama

### Market Data
- **Harga Real-time** — 200+ saham IDX diperbarui setiap 5 detik via server-side proxy
- **IHSG Live** — auto-update harga dan perubahan poin/persen secara real-time
- **Indeks Global** — Dow Jones, Nasdaq, S&P 500, Nikkei, Hang Seng, DAX, FTSE 100 di ticker tape
- **Crypto Ticker** — BTC, ETH, BNB, SOL, XRP, ADA, DOGE, AVAX dengan harga live
- **USD/IDR** — kurs real-time di stats bar
- **Animasi Angka** — harga berputar smooth (odometer effect) saat nilai berubah

### Analisis Saham
- **4 Card Saham** — masing-masing dengan ticker picker dari 200+ saham IDX
- **Verdict Otomatis** — GO TRADE / SKIP / TIPIS / SL HIT / BELUM ENTRY berdasarkan posisi harga vs level
- **R:R Calculator** — kalkulasi Risk:Reward TP1 & TP2 otomatis
- **Auto-Suggest Level** — entry, SL, TP1, TP2 di-generate otomatis berdasarkan tick size IDX
- **Mode Auto/Manual** — toggle harga live atau input manual per card
- **Analisis Naratif** — penjelasan posisi + rekomendasi aksi per saham
- **Chart TradingView** — modal popup candlestick chart per saham (RSI + MACD)

### Sesi Bursa
- **Countdown Real-time** — hitung mundur ke sesi berikutnya (Pre-open → Sesi 1 → Istirahat → Sesi 2 → ATC)
- **Badge Sesi** — status IDX, NYSE, TSE (Buka/Tutup) dengan tooltip jadwal lengkap
- **Deteksi Hari** — hari kerja vs weekend, perbedaan jadwal Jumat

### Drawer Sidebar
Semua fitur di bawah diakses via panel slide-in di kanan layar:

#### Portfolio Tracker
- Tambah/hapus posisi dengan harga beli, lot, tanggal
- Harga live per posisi diperbarui tiap 5 detik
- Kalkulasi P&L (nominal + persentase) per posisi dan total
- Flash hijau/merah saat harga berubah

#### Portfolio Analytics
- Win Rate dari riwayat analisis
- Distribusi verdict (GO / SKIP / TIPIS / SL / WAIT) dengan bar chart
- Average R:R dari semua analisis tersimpan
- Top 5 saham terbanyak dianalisis
- Performa terbaik & terburuk di portfolio

#### Riwayat Analisis + Trade Journal
- Simpan snapshot analisis lengkap (harga, level, verdict semua slot)
- **Trade Journal** — field alasan masuk (setup teknikal) dan catatan psikologi
- Expand detail per entry untuk melihat semua saham + journal
- Hapus per item atau hapus semua

#### Custom Price Alert
- Tambah alert harga (≥ di atas / ≤ di bawah) per ticker
- Notifikasi in-app (toast) + browser notification saat harga tercapai
- Badge counter di tombol notifikasi header
- Alert auto-check tiap 5 detik dari harga live

#### Kalkulator Trading (5 Seksi)
1. **Position Sizing** — lot optimal berdasarkan modal, risk %, entry, SL
2. **Break Even / Averaging** — harga rata-rata, total modal, P&L di target jual
3. **Fibonacci & Pivot Point** — level pivot klasik (R1–R3, S1–S3) + retrace Fibonacci (0%–100%)
4. **Risk of Ruin** — RoR%, Edge/trade, Kelly %, EV 10 trade
5. **Compound Simulator** — proyeksi modal 12 bulan berdasarkan win rate, R:R, risk/trade

#### Pengaturan Akun
- Info user yang sedang login
- Ganti password

### Screener & Heatmap
- **Top 5 Gainers & Losers** IDX dari 100+ saham pantauan, auto-refresh tiap 60 detik
- **Heatmap Sektor** — visual performa rata-rata per sektor IDX (warna merah–hijau)
- Tombol +WL (tambah ke watchlist) dan +C (tambah ke card) dari screener

### Watchlist
- Tambah saham via search (ticker atau nama)
- Harga, perubahan%, dan sektor ditampilkan real-time
- Flash animasi saat harga berubah

### Notifikasi Harga
- Alert saat harga menyentuh SL, zona Entry, TP1, atau TP2
- Toast notifikasi in-app (kiri bawah)
- Browser push notification (jika diizinkan)

---

## Role & Akses

| Role | Dashboard | Admin Panel | Developer Panel |
|------|-----------|-------------|-----------------|
| **User** | ✅ | ❌ | ❌ |
| **Admin** | ✅ | ✅ | ❌ |
| **Developer** | ✅ | ✅ | ✅ |

**Developer Panel** — System info, cache manager, manajemen user penuh  
**Admin Panel** — Tambah/edit/hapus user  
**Demo** — Akses publik `/demo` tanpa login, 1 card, 2x percobaan analisis

---

## Instalasi

### Prasyarat
- Node.js v18+
- npm

### Langkah

```bash
# Clone repository
git clone https://github.com/Btarakenzo/trading-dashboard.git
cd trading-dashboard

# Install dependencies
npm install

# Salin dan isi file environment
cp .env.example .env
```

Edit `.env`:
```env
PORT=3000
JWT_SECRET=ganti_dengan_secret_key_yang_kuat
```

Buat file `data/users.json` berdasarkan contoh:
```bash
cp data/users.example.json data/users.json
```

Isi password dengan bcrypt hash. Contoh generate hash via Node.js:
```js
const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('PasswordAnda', 10));
```

### Jalankan

```bash
# Development
npm run dev

# Production (dengan PM2)
npm install -g pm2
pm2 start ecosystem.config.js
```

Buka browser: `http://localhost:3000`  
Demo publik: `http://localhost:3000/demo`

---

## Struktur Project

```
trading-dashboard/
├── server.js              # Express server + auth + API proxy
├── ecosystem.config.js    # PM2 production config
├── package.json
├── .env                   # (tidak di-commit) PORT, JWT_SECRET
├── data/
│   ├── users.json         # (tidak di-commit) data user + password hash
│   └── users.example.json # contoh struktur users.json
└── public/
    ├── index.html         # Dashboard utama — semua fitur dalam satu file
    ├── login.html         # Halaman login
    ├── admin.html         # Admin panel
    ├── developer.html     # Developer panel
    └── style.css          # Global stylesheet
```

---

## API Endpoints

| Method | Endpoint | Akses | Keterangan |
|--------|----------|-------|------------|
| `POST` | `/api/auth/login` | Publik | Login, set JWT cookie |
| `POST` | `/api/auth/logout` | Publik | Hapus cookie |
| `GET` | `/api/auth/me` | Login | Info user aktif |
| `POST` | `/api/auth/change-password` | Login | Ganti password |
| `GET` | `/api/prices?tickers=BBCA,TLKM` | Publik | Harga saham IDX real-time |
| `GET` | `/api/global` | Publik | Indeks global + USD/IDR |
| `GET` | `/api/crypto` | Publik | Harga 8 crypto utama |
| `GET` | `/api/idx-stocks` | Publik | Daftar 200+ saham IDX |
| `GET` | `/api/users` | Admin/Dev | Daftar semua user |
| `POST` | `/api/users` | Admin/Dev | Tambah user baru |
| `PUT` | `/api/users/:id` | Admin/Dev | Edit user |
| `DELETE` | `/api/users/:id` | Admin/Dev | Hapus user |
| `GET` | `/api/dev/system` | Developer | Info server & cache |
| `POST` | `/api/dev/cache/clear` | Developer | Reset cache & session |

---

## Penyimpanan Data Lokal (localStorage)

Semua data pengguna tersimpan di browser (tidak di server):

| Key | Isi |
|-----|-----|
| `td-slot-0` s/d `td-slot-3` | Konfigurasi card saham (ticker, level, mode) |
| `kenz_portfolio` | Daftar posisi portfolio |
| `kenz_watchlist` | Daftar ticker watchlist |
| `kenz_history` | Riwayat analisis + trade journal (maks 30 entry) |
| `kenz_alerts` | Custom price alert |
| `kenz_notif` | Status notifikasi aktif/nonaktif |

---

## Jam Sesi Bursa (WIB)

| Bursa | Sesi | Waktu WIB |
|-------|------|-----------|
| **IDX** | Pre-Opening | 08:45 – 09:00 |
| | Sesi 1 | 09:00 – 11:30 |
| | Istirahat | 11:30 – 13:30 |
| | Sesi 2 (Sen–Kam) | 13:30 – 15:00 |
| | ATC (Sen–Kam) | 15:00 – 15:15 |
| | Sesi 2 (Jumat) | 13:30 – 15:15 |
| | ATC (Jumat) | 15:15 – 15:30 |
| **NYSE** | Pre-Market | 16:00 – 21:30 |
| | Reguler | 21:30 – 04:00 |
| | After-Hours | 04:00 – 08:00 |
| **TSE** | Sesi 1 | 07:00 – 09:30 |
| | Istirahat | 09:30 – 10:30 |
| | Sesi 2 | 10:30 – 13:30 |

---

## Keamanan

- **JWT** disimpan di `httpOnly` cookie (tidak bisa diakses JavaScript)
- **bcrypt** untuk hashing password (cost factor 10)
- **Rate limiting** — max 10 percobaan login gagal per 15 menit per IP
- **Helmet.js** — security headers lengkap (CSP, HSTS, X-Frame-Options, dll)
- **Role protection** — setiap endpoint & halaman divalidasi server-side
- **Body limit** — request body dibatasi 20kb
- File sensitif (`.env`, `users.json`) tidak di-commit ke repository

---

## Tech Stack

- **Backend** — Node.js, Express 5, Helmet, express-rate-limit
- **Auth** — JWT (jsonwebtoken), bcryptjs, cookie-parser
- **Frontend** — Vanilla HTML/CSS/JS (no framework, single-file dashboard)
- **Chart** — TradingView Widget (embed, no API key needed)
- **Data** — Yahoo Finance unofficial API (server-side proxy, cached)
- **Process Manager** — PM2 (production)

---

## License

ISC © 2026 [KenzProject](https://github.com/Btarakenzo)
