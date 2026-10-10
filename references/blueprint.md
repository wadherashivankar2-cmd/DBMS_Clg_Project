# Project Blueprint: Phase 1 scope only

> `{{APP_NAME}}` is a placeholder. The final product name is not decided. Keep it in ONE config constant and never hard-code it.

This file is the trimmed blueprint for Phase 1 (Foundation). It contains the domain, data model, rules and architecture that the foundation must implement. Sections about later work (observability console, security hardening, search, notifications, outbox, testing campaigns, deployment pipeline, demo, team plan) are intentionally removed. Original section numbers are kept, so gaps in numbering are expected.

Phase 1 delivers only: repository and Docker environment, full PostgreSQL schema (tables, constraints, indexes, triggers), seed data, schema tests, NestJS and Next.js scaffolds with a dev-auth stub, and documentation. It does not deliver real authentication, booking logic, payments, uploads or business endpoints.

## Overview
A database-first rental infrastructure for high-value physical assets between untrusted parties. PostgreSQL is the source of truth. Primary language TypeScript, primary database PostgreSQL, 4 members, zero budget, fully self-hostable.

# 1. Executive Vision
{{APP_NAME}} is not simply a rental marketplace.
It is a database-first rental infrastructure designed around one fundamental problem:
How can two strangers safely exchange custody of a valuable physical asset while maintaining a verifiable record of its condition, ownership, availability, financial state, and custody history?

Traditional rental systems often model an asset as AVAILABLE -> RENTED -> AVAILABLE. {{APP_NAME}} instead models the complete lifecycle:
LISTED -> VERIFIED -> AVAILABLE -> RESERVED -> INSPECTION_PENDING -> ACTIVE_CUSTODY -> RETURN_INSPECTION -> SETTLED / DISPUTED -> AVAILABLE / MAINTENANCE / REPAIR / SOLD

The system maintains an Asset Passport containing historical identity, condition, custody, maintenance, utilization, disputes, ownership and verification events.
The database is treated as the source of truth.

# 2. Core Problem
{{APP_NAME}} addresses five major problems in peer-to-peer and equipment rental systems.

2.1 Asset Identity Fraud
A renter may receive an asset whose serial number differs, a component has been swapped, an accessory is missing, an internal component has been replaced, or physical condition differs from the listing.

2.2 Pre-existing Damage Disputes
After returning an asset, both parties may claim that damage was already present. {{APP_NAME}} establishes a recorded baseline before custody begins.

2.3 Double Booking
Two users may attempt to reserve the same asset during overlapping periods. Application-level availability checks alone are insufficient under concurrency.

2.4 Financial State Inconsistency
Naive balance updates create problems around partial failures, duplicate requests, refunds and disputes. {{APP_NAME}} therefore uses an append-only double-entry financial ledger.

2.5 Silent Mutation
Important historical facts must not simply be overwritten. The system records who changed what, when, why, previous value, new value and related entity.

# 3. Five Core Principles
1. Database-Enforced Correctness - Critical invariants are enforced by PostgreSQL rather than trusted exclusively to application code.
2. Immutable History - Important lifecycle events are append-only.
3. Deterministic State Machines - Assets, bookings, inspections, disputes and financial records follow explicitly defined state transitions.
4. Evidence-Based Trust - Condition and custody claims are supported by inspection records, structured measurements and cryptographic hashes.
5. Explainability - Every important score or decision should be explainable.

# 4. Rentable Asset Domain
Initial categories:
- Electronics - laptops, tablets, monitors, projectors, gaming consoles, networking equipment
- Cameras - cameras, lenses, tripods, gimbals, lighting equipment
- Vehicles - bicycles, motorcycles, scooters, cars
- Tools - drills, saws, welding equipment, construction equipment, power tools
- Fashion - dresses, costumes, suits, traditional clothing
- Musical / Event - guitars, keyboards, microphones, speakers, amplifiers, lighting
- Games / Recreation - board games, sports equipment, camping equipment

The architecture must allow future categories without changing the core rental engine.

# 5. Application Roles
Renter - search assets, request bookings, complete verification, participate in handover, return assets, report disputes, review assets/owners.
Owner - register assets, create listings, submit verification, define pricing and deposit, manage maintenance, inspect returned assets, initiate buyout.
Inspector / Operations - verification, inspection approval, dispute review, maintenance verification and evidence review.
Administrator - database explorer, query console, index monitor, audit logs, transaction monitor, system metrics, dispute management and user moderation.

# 6. Asset Passport
Every asset receives a globally unique Asset ID.
The passport contains:
- Identity: Asset ID, category, manufacturer, model, serial number/registration where applicable, acquisition date and owner.
- Current State: lifecycle state, custody, location, condition score, health score and reliability score.
- Utilization: total rental count, rental hours/days and utilization percentage.
- Maintenance: last maintenance, next maintenance, maintenance history and repair history.
- Trust: owner reputation, renter history and dispute history.
- Evidence: inspection records, photo hashes, manifests and verification events.
- Timeline: every significant lifecycle event.

# 7. Asset Timeline
The timeline is append-only. Example events include:
- ASSET_CREATED
- OWNER_VERIFICATION_COMPLETED
- INITIAL_INSPECTION_COMPLETED
- LISTING_PUBLISHED
- BOOKING_CREATED
- HANDOVER_VERIFIED
- CUSTODY_TRANSFERRED
- RETURN_INITIATED
- RETURN_INSPECTION_COMPLETED
- SETTLEMENT_COMPLETED

Historical events cannot be edited through normal application operations.

# 8. Trusted Handover Protocol
Stage 1 - Baseline Inspection
The owner/inspector records serial number, visible damage, component checklist, accessory checklist, battery health where applicable, operating hours/runtime where applicable, physical condition, functional tests and photographs.
The inspection produces a structured baseline that becomes the reference state for return comparison.

# 9. Eight-Point Manifest
A generic asset may use:
1. Identity / Serial Number
2. Physical Exterior
3. Major Components
4. Accessories
5. Functional Test
6. Wear / Cosmetic Condition
7. Runtime / Usage Metrics
8. Evidence / Photography

Category-specific inspection templates extend these fields. For example, laptops can record battery health, screen, keyboard, ports and storage health; cameras can record body, sensor, lens, shutter count, battery and accessories.

# 10. Photo Evidence
The original image is stored in object storage. The application calculates SHA-256(image_bytes). The database stores evidence_id, asset_id, inspection_id, object_key, sha256_hash, captured_at and uploaded_by.
Important limitation: a hash provides integrity evidence, not proof that the photograph itself is truthful.

# 11. Mutual Handover Verification
Handover requires owner verification + renter verification + manifest confirmation + OTP confirmation.
The system generates a short-lived handover challenge. Both parties confirm the same transaction.
OTP values must never be stored in plaintext. Store only a secure hash/derived verification value with expiry and attempt limits.

# 12. Security Claim Boundary
The application must NOT claim that cryptography proves an asset was physically unchanged.
Correct claim: Cryptographically binds inspection evidence and recorded state to a specific inspection event.

# 13. Return Inspection
The return process repeats the baseline inspection. The system compares baseline state against return state for every measurable inspection attribute.
Example:
Screen: 5 -> 5
Keyboard: 5 -> 4
Body: 5 -> 3
Battery: 4 -> 4

# 14. Condition Delta Engine
For measurable attributes:
Delta = SUM (Weight * |Baseline - Return|)
The resulting weighted delta determines whether the return is NORMAL or DISPUTE_REVIEW_REQUIRED.
The threshold must be configurable by asset category.

# 15. Settlement Engine
- Normal Return: Delta <= Threshold -> Settlement transaction -> Deposit released -> Ledger entries -> Booking SETTLED.
- Disputed Return: Delta > Threshold -> Deposit FROZEN -> DISPUTE_CREATED -> Evidence Review -> RESOLVED.

The system does not decide legal liability. It determines that the recorded return condition exceeds the configured automatic-settlement threshold.

# 16. Deterministic Booking Engine
PostgreSQL is the authoritative concurrency layer.
Use tstzrange for booking windows and a GiST exclusion constraint to prevent overlapping bookings for the same asset.

Example SQL:
CREATE EXTENSION IF NOT EXISTS btree_gist;

CONSTRAINT no_overlapping_rentals
EXCLUDE USING gist (
  asset_id WITH =,
  booking_window WITH &&
)
WHERE (
  lifecycle_state IN (
    'RESERVED',
    'INSPECTION_PENDING',
    'ACTIVE_CUSTODY'
  )
);

The application may perform an availability check for UX, but PostgreSQL remains the final authority. Exclusion violations must be translated into an HTTP 409 conflict.

# 17. Double-Entry Financial Ledger
Never use a mutable wallet balance as the financial source of truth.
Use ledger_transaction and ledger_entries.
Example:
- DEBIT - Renter Deposit Account - INR 5,000
- CREDIT - Platform Escrow - INR 5,000
The transaction must balance: SUM(debits) = SUM(credits).

# 18. Financial States
Support:
- DEPOSIT_HELD
- DEPOSIT_RELEASED
- DEPOSIT_PARTIALLY_DEDUCTED
- DEPOSIT_FROZEN
- RENTAL_PAYMENT
- PLATFORM_FEE
- OWNER_SETTLEMENT
- REFUND
Every financial event creates immutable ledger entries.

# 19. Simulated Payments
Use a SIMULATED PAYMENT GATEWAY for the academic project.
Model payment authorization, capture, refund, deposit and settlement without requiring real money or a paid payment provider.

# 20. Buyout System
Owners may enable BUYOUT_AVAILABLE with a buyout_price.
Flow: RENTED -> BUYOUT_REQUESTED -> OWNER_ACCEPTED -> SALE_SETTLEMENT -> SOLD.
Once sold, future rental bookings are prohibited while historical rental records remain intact.

# 21. Owner Trust Score
Build an explainable score from successful rentals, cancellation rate, inspection accuracy, dispute rate, maintenance compliance, verified assets and return issues.
Display both the score and contributing factors. Do not expose sensitive/internal scoring data unnecessarily.

# 22. Renter Reliability Score
Use completed rentals, late returns, damage incidents, cancellation behaviour, dispute history and verification history. The score must be accompanied by contributing factors.

# 23. Asset Health Score
Health is a derived metric.
Example:
Condition * 0.30
Maintenance * 0.25
Reliability * 0.20
Usage * 0.15
Inspection * 0.10
Store the inputs and calculation version so changes are explainable and reproducible.

# 24. Database Architecture
Core relational entities:
- users
- roles
- user_roles
- user_verifications
- asset_categories
- asset_category_fields
- assets
- asset_specifications
- asset_ownership
- asset_locations
- listings
- pricing_rules
- bookings
- booking_events
- inspections
- inspection_templates
- inspection_items
- inspection_evidence
- handover_records
- custody_events
- maintenance_records
- repair_records
- condition_snapshots
- condition_deltas
- damage_reports
- disputes
- dispute_events
- trust_scores
- asset_health_scores
- ledger_transactions
- ledger_entries
- reviews
- notifications
- audit_logs
- outbox_events

# 25. Category-Specific Data
Avoid a separate table for every asset category. Use a normalized core plus controlled flexible attributes.
Core asset identity, lifecycle and ownership remain relational. Category definitions control allowed flexible specifications using PostgreSQL JSONB.
The rental engine remains category-independent.

# 26. Database Integrity
Use:
- Primary keys, Foreign keys, Unique constraints
- CHECK constraints: price >= 0, deposit >= 0, score BETWEEN 0 AND 100, end_time > start_time
- NOT NULL constraints
- Exclusion constraints
- Triggers/functions where appropriate
- Explicit transactions

# 27. Database Transactions
Critical workflows must be atomic.
Example booking transaction:
BEGIN
  create booking
  create booking event
  create audit event
  create payment authorization
COMMIT
If a critical operation fails, ROLLBACK.

# 28. State Machine Enforcement
The backend must not permit arbitrary state changes.
Example:
AVAILABLE -> RESERVED -> INSPECTION_PENDING / CANCELLED -> ACTIVE_CUSTODY / CANCELLED -> RETURN_INSPECTION -> SETTLED / DISPUTED
Invalid transitions must be rejected.

# 29. Immutable Audit System
Audit records contain:
audit_id, actor_id, action, entity_type, entity_id, timestamp, request_id, security metadata, before_state, after_state, and metadata.
Audit records are append-only.

# 37. API Architecture
REST initially under /api/v1/...:
/auth, /users, /assets, /categories, /listings, /bookings, /inspections, /handover, /returns, /maintenance, /disputes, /trust, /health, /payments, /ledger, /audit, /admin/db.

# 38. Technology Stack
- Frontend: Next.js, TypeScript, React, Tailwind CSS, shadcn/ui, React Hook Form, Zod, TanStack Query.
- Backend: NestJS, TypeScript, REST, OpenAPI/Swagger.
- Database: PostgreSQL (GiST, btree_gist, tstzrange, exclusion constraints, triggers, functions, transactions, indexes, JSONB, pg_stat_statements).
- Self-hosted infrastructure: Docker, Docker Compose, optional MinIO and optional Redis.
- Testing / DevOps: Vitest/Jest, Supertest, Playwright, k6, automated migrations, CI checks.

# 39. Database Access Strategy
Typed database access layer with numbered SQL migrations under version control.
Explicit SQL for exclusion constraints, transactions, ledger queries, audits, and query plans.
Every schema change must be reproducible from a clean database.

# 40. Development Environment
Local via Docker Compose: frontend, backend, postgres. Documented clean setup process.

# 42. Testing Strategy
- Unit tests: condition delta, trust score, health score, state transitions, pricing, ledger calculations.
- Integration tests: booking, inspection, handover, return, settlement, dispute, buyout.
- Database tests: FK violations, CHECK violations, duplicate records, invalid transitions, overlapping bookings.

# 51. Architecture
Modular monolith:
Next.js UI (TypeScript) -> HTTPS / REST -> NestJS API (TypeScript) -> PostgreSQL.
PostgreSQL remains authoritative for constraints, transactions, ledger, audit, and analytics.

# 52. Why Not Microservices?
Four developers, three months, zero-cost constraint. Microservices introduce distributed transactions, network failure modes, deployment complexity, and observability overhead without sufficient benefit.

# 60. Final Technology Stack
- Language: TypeScript
- Frontend: Next.js, React, Tailwind CSS, shadcn/ui, TanStack Query, Zod
- Backend: NestJS, REST, OpenAPI
- Database: PostgreSQL 16
- Storage / Cache (optional): Local disk / MinIO, Redis
- DevOps: Docker, Docker Compose, GitHub Actions

# 61. Final Project Philosophy
A database-first transactional infrastructure for managing the lifecycle, custody, condition, availability, and financial settlement of physical assets between untrusted parties.
Core criteria: Correctness, Trust, Observability, Polished Product.
