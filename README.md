# PGGateway

SNAP-native payment transaction ledger + Fraud Detection System (FDS) untuk Penyedia
Jasa Pembayaran (PJP) di Indonesia. Mencatat setiap transaksi (QRIS, transfer, Virtual
Account) ke dalam ledger append-only yang auditable, dengan deteksi fraud near-real-time.

## Struktur

| Path | Isi |
|------|-----|
| `backend/` | Spring Boot (Java 21). T1: ingest mirror SNAP → canonical event → event store |
| `frontend/` | React + Vite + TypeScript + Tailwind. Portal operator multi-tenant |
| `docker-compose.yml` | Dev lokal: CockroachDB (3-node), Kafka (KRaft), Redis, + Prometheus/Grafana |
| `infra/` | Konfigurasi service |

## Menjalankan secara lokal

```bash
# Infra (CockroachDB Console: http://localhost:8080)
docker compose up -d
# atau dengan observability:
docker compose --profile observability up -d

# Backend  -> http://localhost:8081
cd backend && mvn spring-boot:run

# Frontend -> http://localhost:5173
cd frontend && npm install && npm run dev
```

Backend default-nya menyemai data transaksi sintetis saat start, jadi feed di dashboard
langsung berisi. POST mirror callback: `POST /api/ingest/mirror`. Daftar transaksi:
`GET /api/transactions`.

## Status

**T1 — ingest core:** mirror adapter (normalisasi SNAP → canonical event), event store
append-only dengan dedup idempotency, sequence per-partisi, serialisasi per-akun, dan
gap-detection. Tercakup unit test.

Frontend: app shell multi-tenant + 3 layar (Dashboard, FDS Alert Detail, Reconciliation)
dengan state empty/loading/error.

Berikutnya: event store durable (Kafka + CockroachDB), projeksi ledger, FDS, rekonsiliasi.
