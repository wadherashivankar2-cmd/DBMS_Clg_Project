# Phase 2 Engineering Handoff Document

## 1. What is Done (Phase 1)
- **Database Engine & Invariant Protections**:
  - Full set of 10 PostgreSQL migration scripts applied and validated in numerical order.
  - Invariants tested and passing (12/12) via `npm run db:test`.
  - GiST temporal exclusion constraints for double-booking prevention.
  - Immutability triggers on append-only logs (`audit_logs`, `booking_events`, `ledger_entries`).
  - Balanced double-entry financial ledger constraint trigger.
  - Automated migration runner (`npm run db:migrate`) and reset pipeline (`npm run db:reset`).
  - Comprehensive seed script (`npm run db:seed`) creating seeded roles, users, assets, categories, and listings.
- **NestJS Core API**:
  - Scaffolding with global prefix `/api/v1`, CORS, global exception filtering, and request-id tracing.
  - Live health probe endpoint at `GET /api/v1/health` verifying database pool connectivity.
  - Interactive Swagger OpenAPI documentation at `GET /api/docs` and spec at `/api/docs-json`.
  - Dev authentication guard (`DevAuthGuard`) reading `x-user-id` and role authorization (`RolesGuard`).
  - Stubbed controllers for all 17 planned domain modules returning 501 Not Implemented.
- **Next.js Web Frontend**:
  - Clean Next.js 16 App Router application in `apps/web`.
  - Cluster status dashboard showing live API and PostgreSQL health status.
  - Dark-mode responsive styling with Tailwind CSS.

---

## 2. What is Not Done (Phase 2+ Scope)
- **Core Business Logic**: Real implementations for the 17 stubbed controllers (Auth, Users, Assets, Bookings, Inspections, etc.).
- **JWT & Session Auth**: Phase 5 replacement of `DevAuthGuard` with complete JWT verification.
- **S3 / MinIO Integration**: Direct upload and presigned URL generation for `inspection_evidence`.
- **Frontend Pages**: Booking workflows, asset exploration, and owner inventory dashboard.

---

## 3. Seeded Dev Credentials & UUIDs

Default dev user password for seeded accounts: `password123`

| Role | Email | User ID (`x-user-id` Header) |
| :--- | :--- | :--- |
| **ADMIN** | `admin@platform.local` | `88dba24d-e71c-4029-b6d1-27a851f423d0` |
| **INSPECTOR**| `inspector@platform.local` | `d583f91f-4328-44c9-a128-a2ae1b0eb304` |
| **OWNER** | `owner1@platform.local` | `b20382bb-1e8f-4f98-9882-d1e5a151eff0` |
| **OWNER** | `owner2@platform.local` | `81dbb725-1f55-4390-852e-17b5f30094f5` |
| **RENTER** | `renter1@platform.local` | `a6be6570-2873-454a-8e0e-6e8b05ff0459` |
| **RENTER** | `renter2@platform.local` | `a3c6cc03-6db4-44b9-8013-f406715f1b6e` |

---

## 4. How to Run and Test
```bash
# 1. Start database container
npm run db:up

# 2. Run reset & test suite
npm run db:reset
npm run db:test

# 3. Start API (Port 4000)
npm run dev:api

# 4. Start Web (Port 3000)
npm run dev:web

# 5. Quick endpoint tests:
# Health check:
curl http://localhost:4000/api/v1/health

# Unauthenticated request (returns 401):
curl -i http://localhost:4000/api/v1/bookings

# Authenticated stub request with renter header (returns 501):
curl -i -H "x-user-id: a6be6570-2873-454a-8e0e-6e8b05ff0459" http://localhost:4000/api/v1/bookings
```

---

## 5. Architectural Decisions & Shortcuts
- **DevAuthGuard**: Uses mock `x-user-id` header in development to test role authorization without needing a full OAuth/JWT issuer in Phase 1.
- **Direct SQL / PG Pool**: Used `pg.Pool` directly instead of an ORM (TypeORM/Prisma) to ensure full control over advanced PostgreSQL features (`tsrange`, GiST exclusion constraints, and transactional balance triggers).
- **Stubs**: All 17 planned controllers exist in `apps/api/src/modules/stubs.controllers.ts` to allow frontend and API contract work to proceed immediately in parallel.

---

## 6. Known Issues & Operational Considerations
- Port 4000 or 3000 may remain in use if a previous process is killed abruptly. Use PowerShell `Stop-Process` or `netstat -ano` to free the ports if needed.
- PostgreSQL container must remain running for API and tests.

---

## 7. Needed from Next Owner (Phase 2 Goals)
- Implement Phase 2 module handlers (Auth registration/login, Asset CRUD, Listing management, and initial Booking reservation workflows).
- Add integration tests verifying booking creation and overlap conflict handling via the REST API.
