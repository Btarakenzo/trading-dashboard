# 📈 BEI Trading Dashboard

**Real-time Indonesian Stock Exchange (IDX) trading analysis dashboard** built with Node.js + Express and vanilla HTML/CSS/JS.

> Developed by **KenzProject**

---

## Fitur Utama

- **Harga Real-time** — 200+ saham IDX diperbarui setiap 5 detik
- **Analisis per Saham** — R:R ratio, verdict (GO TRADE / SKIP / TIPIS / SL HIT), auto-suggest level Entry/SL/TP berdasarkan tick size IDX
- **IHSG & Indeks Global** — Dow Jones, Nasdaq, S&P 500, Nikkei, Hang Seng, DAX, FTSE, USD/IDR real-time
- **Jam Sesi Bursa** — IDX, NYSE, TSE dengan tooltip jadwal lengkap (WIB)
- **Mode Auto/Manual** — toggle harga otomatis atau input manual per card
- **Ringkasan Analisis** — modal popup dengan salin laporan ke clipboard
- **Demo Publik** — akses `/demo` tanpa login, terbatas 2x percobaan analisis
- **Sistem Login Multi-Role** — Developer, Admin, User dengan proteksi JWT

---

## Role & Akses

| Role | Dashboard | Admin Panel | Developer Panel |
|------|-----------|-------------|-----------------|
| **User** | ✅ | ❌ | ❌ |
| **Admin** | ✅ | ✅ | ❌ |
| **Developer** | ✅ | ✅ | ✅ |

**Developer Panel** — System info, cache manager, manajemen user penuh  
**Admin Panel** — Tambah/edit/hapus user  
**Demo** — Akses publik tanpa login, 1 card, 2x percobaan

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
    ├── index.html         # Dashboard utama (user)
    ├── login.html         # Halaman login
    ├── admin.html         # Admin panel
    ├── developer.html     # Developer panel
    └── style.css          # Global stylesheet
```

---

## API Endpoints

| Method | Endpoint | Akses | Keterangan |
|--------|----------|-------|------------|
| `POST` | `/api/auth/login` | Publik | Login, return JWT cookie |
| `POST` | `/api/auth/logout` | Publik | Hapus cookie |
| `GET` | `/api/auth/me` | Login | Info user aktif |
| `GET` | `/api/prices?tickers=BBCA,TLKM` | Publik | Harga saham IDX real-time |
| `GET` | `/api/global` | Publik | Indeks global + USD/IDR |
| `GET` | `/api/users` | Admin/Dev | Daftar semua user |
| `POST` | `/api/users` | Admin/Dev | Tambah user baru |
| `PUT` | `/api/users/:id` | Admin/Dev | Edit user |
| `DELETE` | `/api/users/:id` | Admin/Dev | Hapus user |
| `GET` | `/api/dev/system` | Developer | Info server & cache |
| `POST` | `/api/dev/cache/clear` | Developer | Reset cache & session |

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

## Jam Sesi Bursa (WIB)

| Bursa | Sesi | Waktu WIB |
|-------|------|-----------|
| **IDX** | Pre-Opening | 08:45 – 09:00 |
| | Sesi 1 | 09:00 – 11:30 |
| | Istirahat | 11:30 – 13:30 |
| | Sesi 2 (Sen–Kam) | 13:30 – 15:00 |
| | Sesi 2 (Jumat) | 13:30 – 15:15 |
| **NYSE** | Pre-Market | 16:00 – 21:30 |
| | Reguler | 21:30 – 04:00 |
| | After-Hours | 04:00 – 08:00 |
| **TSE** | Sesi 1 | 07:00 – 09:30 |
| | Istirahat | 09:30 – 10:30 |
| | Sesi 2 | 10:30 – 13:30 |

---

## Tech Stack

- **Backend** — Node.js, Express 5, Helmet, express-rate-limit
- **Auth** — JWT (jsonwebtoken), bcryptjs, cookie-parser
- **Frontend** — Vanilla HTML/CSS/JS (no framework)
- **Data** — Yahoo Finance unofficial API (server-side proxy)
- **Process Manager** — PM2 (production)

---

## License

ISC © 2026 [KenzProject](https://github.com/Btarakenzo)
