# API Route Contract: {{APP_NAME}}

This document details the planned REST API endpoints across all modules conforming to the modular monolith architecture.
Base URL prefix: `/api/v1`
Interactive OpenAPI/Swagger documentation is served at `/api/docs`.

---

## Route Specification Table

| Method | Path | Role | Phase | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Public | Phase 1 | Database connection and API runtime health check |
| `POST` | `/api/v1/auth/register` | Public | Phase 2 | Register new user account with credentials |
| `POST` | `/api/v1/auth/login` | Public | Phase 2 | Authenticate credentials and issue session/JWT token |
| `POST` | `/api/v1/auth/refresh` | Public | Phase 2 | Refresh expired access tokens |
| `POST` | `/api/v1/auth/logout` | Authenticated | Phase 2 | Invalidate current user session |
| `GET` | `/api/v1/users/me` | Authenticated | Phase 2 | Get currently authenticated user profile |
| `PATCH` | `/api/v1/users/me` | Authenticated | Phase 2 | Update user personal profile details |
| `POST` | `/api/v1/users/verify` | Authenticated | Phase 2 | Submit identity verification request |
| `GET` | `/api/v1/users/:id` | ADMIN | Phase 2 | Retrieve user profile by UUID |
| `GET` | `/api/v1/categories` | Public | Phase 2 | List all asset taxonomy categories |
| `GET` | `/api/v1/categories/:id/fields` | Public | Phase 2 | Retrieve dynamic specification field schema for category |
| `POST` | `/api/v1/categories` | ADMIN | Phase 2 | Create new asset category definition |
| `GET` | `/api/v1/assets` | Public | Phase 2 | Search and filter physical assets |
| `POST` | `/api/v1/assets` | OWNER | Phase 2 | Register a physical asset into the platform |
| `GET` | `/api/v1/assets/:id` | Public | Phase 2 | Retrieve complete Asset Passport |
| `PATCH` | `/api/v1/assets/:id` | OWNER | Phase 2 | Update mutable asset properties |
| `GET` | `/api/v1/assets/:id/timeline` | Public | Phase 2 | Retrieve append-only asset lifecycle events |
| `GET` | `/api/v1/listings` | Public | Phase 2 | Search active marketplace listings |
| `POST` | `/api/v1/listings` | OWNER | Phase 2 | Create a rental listing for an available asset |
| `GET` | `/api/v1/listings/:id` | Public | Phase 2 | Get listing details, pricing, and terms |
| `PATCH` | `/api/v1/listings/:id` | OWNER | Phase 2 | Modify listing pricing or availability status |
| `POST` | `/api/v1/listings/:id/rules` | OWNER | Phase 2 | Add dynamic duration/weekend pricing rule |
| `POST` | `/api/v1/bookings` | RENTER | Phase 2 | Request an asset rental reservation |
| `GET` | `/api/v1/bookings` | Authenticated | Phase 2 | List bookings for current user (renter or owner) |
| `GET` | `/api/v1/bookings/:id` | Authenticated | Phase 2 | Get specific booking contract details |
| `POST` | `/api/v1/bookings/:id/cancel` | Authenticated | Phase 2 | Cancel booking prior to handover |
| `POST` | `/api/v1/inspections` | INSPECTOR | Phase 2 | Create an inspection checklist (baseline or return) |
| `GET` | `/api/v1/inspections/:id` | Authenticated | Phase 2 | Retrieve inspection scores and items |
| `POST` | `/api/v1/inspections/:id/submit` | INSPECTOR | Phase 2 | Submit completed 8-point checklist |
| `POST` | `/api/v1/inspections/:id/evidence` | INSPECTOR | Phase 2 | Attach cryptographic photo evidence hash |
| `POST` | `/api/v1/handover/initiate` | OWNER | Phase 2 | Initiate mutual pickup/return handover protocol |
| `POST` | `/api/v1/handover/confirm-otp` | RENTER | Phase 2 | Verify short-lived handover OTP challenge |
| `GET` | `/api/v1/handover/:bookingId/status` | Authenticated | Phase 2 | Query handover confirmation status |
| `POST` | `/api/v1/returns/initiate` | RENTER | Phase 2 | Initiate physical asset return |
| `POST` | `/api/v1/returns/calculate-delta` | INSPECTOR | Phase 2 | Compute mathematical condition delta |
| `POST` | `/api/v1/returns/settle` | INSPECTOR | Phase 2 | Execute automatic settlement or freeze deposit |
| `POST` | `/api/v1/maintenance` | OWNER | Phase 2 | Log routine or inspection-driven maintenance |
| `GET` | `/api/v1/maintenance/asset/:id` | Public | Phase 2 | View asset maintenance service history |
| `POST` | `/api/v1/disputes` | Authenticated | Phase 2 | Open formal dispute case on booking |
| `GET` | `/api/v1/disputes/:id` | Authenticated | Phase 2 | Get dispute case notes, events, and evidence |
| `POST` | `/api/v1/disputes/:id/resolve` | ADMIN | Phase 2 | Issue binding administrative dispute resolution |
| `GET` | `/api/v1/trust/user/:id` | Public | Phase 2 | Get explainable user trust score breakdown |
| `GET` | `/api/v1/health/asset/:id` | Public | Phase 2 | Get multi-factor asset health score |
| `POST` | `/api/v1/payments/authorize` | RENTER | Phase 3 | Authorize simulated rental deposit and fee |
| `POST` | `/api/v1/payments/capture` | ADMIN | Phase 3 | Capture authorized rental charges |
| `GET` | `/api/v1/ledger/accounts/me` | Authenticated | Phase 3 | Get user ledger account summaries |
| `GET` | `/api/v1/ledger/transactions` | ADMIN | Phase 3 | Review double-entry transaction journal |
| `GET` | `/api/v1/audit/logs` | ADMIN | Phase 3 | Query append-only administrative audit log |
| `GET` | `/api/v1/admin-db/stats` | ADMIN | Phase 3 | Inspect pg_stat_statements query execution stats |
| `GET` | `/api/v1/admin-db/indexes` | ADMIN | Phase 3 | Inspect PostgreSQL index utilization metrics |
