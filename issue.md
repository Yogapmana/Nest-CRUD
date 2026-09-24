# Issues & Fitur yang Bisa Ditambahkan

## 🔐 Authentication & Authorization
- [ ] **JWT Auth** — Login/Register endpoint, validasi token
- [ ] **Refresh Token** — Rotasi token agar session aman
- [ ] **Role-based Access Control (RBAC)** — Admin vs User, guard per role
- [ ] **Password Reset** — Lupa password via email (token reset)
- [ ] **Account Lockout** — Lock akun setelah X kali login gagal

## 📝 Validasi & Input
- [ ] **Validasi update** — unique email saat update (cek conflict)
- [ ] **Rate Limiting** — Batasi request per IP (cth: `@nestjs/throttler`)
- [ ] **Sanitasi input** — Bersihkan HTML/script dari input user

## 🗄️ Database & Data
- [ ] **Migration** — Ganti `synchronize: true` ke TypeORM migration (wajib untuk production)
- [ ] **Soft Delete** — Tandai hapus (`deleted_at`) alih-alih delete permanen
- [ ] **Pagination** — `GET /users?page=1&limit=10`
- [ ] **Sorting & Filtering** — `GET /users?sort=name&order=asc&q=john`
- [ ] **Seed Data** — Script isi data awal untuk development

## 📡 API
- [ ] **Swagger/OpenAPI** — Auto-generate dokumentasi API (`@nestjs/swagger`)
- [ ] **Versioning API** — `/api/v1/users`
- [ ] **Global Exception Filter** — Format error response konsisten
- [ ] **Response Interceptor** — Bentuk response seragam (`{ data, meta }`)
- [ ] **Helmet** — Security headers (`helmet`)
- [ ] **CORS** — Konfigurasi CORS untuk frontend
- [ ] **Compression** — Kompresi response (`compression`)

## 🧪 Testing
- [ ] **Test database isolation** — Setup/teardown per test suite
- [ ] **Test coverage threshold** — Minimum coverage di CI
- [ ] **Integration test** — Test dengan database testcontainer

## 🚀 DevOps & Tooling
- [ ] **Dockerfile** — Containerize aplikasi
- [ ] **docker-compose** — App + Postgres + Redis dalam satu stack
- [ ] **CI/CD** — GitHub Actions (lint, test, build, deploy)
- [ ] **Environment config** — Validasi env var saat startup (`joi`/`zod`)
- [ ] **Logging** — Structured logging (`pino`/`winston`)
- [ ] **Health Check** — `GET /health` untuk monitoring

## 👤 Fitur User
- [ ] **Upload Avatar** — Simpan file gambar (local/S3)
- [ ] **Email Verification** — Verifikasi email saat register
- [ ] **User Profile** — Endpoint update profil sendiri
- [ ] **Change Password** — Ganti password (wajib password lama)
- [ ] **List Users (Admin)** — Admin-only dengan pagination

## ⚡ Performance
- [ ] **Caching** — Cache response populer (`@nestjs/cache-manager` + Redis)
- [ ] **Database Index** — Index kolom yang sering di-query
- [ ] **Connection Pool** — Optimasi pool TypeORM

## 📦 Fitur Lanjutan (opsional)
- [ ] **Audit Log** — Catat siapa ubah apa dan kapan
- [ ] **Webhook** — Notifikasi event (user created, updated, dll)
- [ ] **Export CSV/Excel** — Export data users
- [ ] **Dark/Light API docs** — Swagger UI tema kustom
