# Mülk Kira Takip Sistemi

Docker tabanlı, mobil uyumlu mülk ve kira yönetim uygulaması.

## Hızlı Başlangıç

```bash
# 1. .env dosyasını oluştur
cp .env.example .env
# .env içindeki JWT_SECRET değerini değiştirin!

# 2. Başlat
docker compose up -d --build

# 3. Tarayıcıdan aç
http://localhost
```

`docker compose up` sırasında `migrate` servisi, yeniden kullanılan local PostgreSQL volume'larında eksik kalan `007`–`013` migration dosyalarını backend ayağa kalkmadan önce idempotent olarak uygular.

**Varsayılan giriş:**
- E-posta: `admin@kiratakip.local`
- Şifre: `Admin123!`


> İlk girişten sonra şifrenizi değiştirin: Ayarlar → Şifre Değiştir

---

## Mimari

```
nginx (:80)
├── /api/v1/*  →  backend (Node.js/Express :3000)
│                   └── PostgreSQL (:5432)
└── /*         →  frontend (React/Vite/Tailwind)
```

## API Uç Noktaları (Android Entegrasyonu)

Base URL: `http://<ip>/api/v1`

| Metod | Uç Nokta | Açıklama |
|-------|----------|----------|
| POST | `/auth/login` | JWT token al |
| GET | `/auth/me` | Oturum bilgisi |
| GET | `/properties` | Mülk listesi |
| POST | `/properties` | Mülk ekle |
| PUT | `/properties/:id` | Mülk güncelle |
| GET | `/tenants` | Kiracı listesi |
| POST | `/tenants` | Kiracı ekle |
| GET | `/contracts` | Sözleşme listesi |
| POST | `/contracts` | Sözleşme oluştur |
| GET | `/payments` | Ödeme listesi |
| PUT | `/payments/:id/mark-paid` | Tahsil et |
| POST | `/payments/generate-monthly` | Aylık tahakkuk |
| GET | `/expenses` | Gider listesi |
| POST | `/expenses` | Gider ekle |
| GET | `/maintenance` | Bakım talepleri |
| POST | `/maintenance` | Talep oluştur |
| GET | `/reports/dashboard` | Dashboard özeti |
| GET | `/reports/income-expense` | Gelir/gider raporu |
| GET | `/reports/profitability` | Karlılık raporu |

Tüm isteklerde (login hariç): `Authorization: Bearer <token>` header'ı gerekli.

## Modüller

- **Mülkler** – Bina/daire/ticari hiyerarşi, durum takibi
- **Kiracılar** – TC, iletişim, Findeks, acil kişi
- **Sözleşmeler** – Tarih, kira, TÜFE/sabit artış, tahliye taahhütnamesi
- **Ödemeler** – Otomatik aylık tahakkuk, gecikme takibi, tek tıkla tahsilat
- **Giderler** – Kategori bazlı kayıt (vergi, DASK, tadilat…)
- **Bakım** – Arıza talebi, öncelik, atama
- **Raporlar** – Gelir/gider grafiği, mülk bazlı karlılık

## Geliştirme Ortamı

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```
