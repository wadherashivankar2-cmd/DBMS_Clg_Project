# Database Schema & Technical Specification

## 1. Table Groups & Purpose

### Group A: Identity, RBAC & Core Entities
- `roles`: System RBAC roles (`ADMIN`, `OWNER`, `RENTER`, `INSPECTOR`).
- `users`: Registered platform actors, contact emails, phone numbers, identity verification status.
- `user_roles`: Many-to-many junction between users and granted roles.
- `categories`: Hierarchical asset classifications and base deposit requirements.

### Group B: Physical Assets & Commercial Listings
- `assets`: Concrete physical equipment instances, serial numbers, current lifecycle states (`DRAFT`, `PENDING_INSPECTION`, `AVAILABLE`, `RENTED`, `MAINTENANCE`, `DECOMMISSIONED`), owner references.
- `listings`: Commercial offers attached to assets, including `daily_price`, `deposit_amount`, and active availability windows.

### Group C: Bookings & Temporal State
- `bookings`: Rental reservations with temporal validity ranges (`tsrange(start_time, end_time)`), status tracking (`REQUESTED`, `RESERVED`, `ACTIVE`, `RETURNED`, `COMPLETED`, `CANCELLED`, `DISPUTED`), and financial totals.
- `booking_events`: Append-only event history tracking all state changes, actors, and metadata payloads.

### Group D: Inspections, Custody & Evidence
- `inspections`: Pre-rental and post-rental physical assessments, inspector records, and overall physical grading.
- `inspection_evidence`: Tamper-evident photo and document attachments with verified SHA-256 content hashes.
- `custody_logs`: Timestamped chain of custody handovers between owners, renters, and transport agents.

### Group E: Maintenance & Disputes
- `maintenance_records`: Scheduled maintenance, damage repairs, costs, and downtime windows.
- `disputes`: Conflict arbitrations for damages, late returns, or deposit claims.

### Group F: Double-Entry Financial Ledger
- `ledger_accounts`: Financial balance sheet accounts (Asset, Liability, Equity, Revenue, Expense).
- `ledger_transactions`: Journal entries grouping multiple debit and credit line items.
- `ledger_entries`: Append-only debit and credit entries enforcing strict balance.

### Group G: Audit & Scoring
- `audit_logs`: Append-only system-wide audit trail.
- `trust_scores`: Dynamic reputation score cache for users.
- `asset_health_scores`: Mechanical and condition scores for physical assets.

---

## 2. Constraints & Protections

| Table | Constraint Name | Enforcement & Protection |
| :--- | :--- | :--- |
| `bookings` | `no_overlapping_active_bookings` | PostgreSQL `EXCLUDE USING gist (asset_id WITH =, rental_period WITH &&)` ensures no two active (`RESERVED`, `ACTIVE`) bookings can ever overlap in time for the same asset. |
| `bookings` | `valid_rental_period` | Ensures `upper(rental_period) > lower(rental_period)`. |
| `listings` | `positive_daily_price` | `daily_price >= 0` prevents negative rental pricing. |
| `listings` | `positive_deposit` | `deposit_amount >= 0` prevents negative security deposits. |
| `trust_scores` | `valid_score_range` | Check constraint enforcing `0 <= score <= 100`. |
| `asset_health_scores`| `valid_health_score_range` | Check constraint enforcing `0 <= score <= 100`. |
| `inspection_evidence`| `valid_sha256_hash` | Regexp check constraint enforcing 64 lowercase hexadecimal characters (`^[a-f0-9]{64}$`). |
| `disputes` | `unique_active_dispute_per_booking`| Partial unique index preventing multiple concurrent open disputes for the same booking. |
| `users` | `users_email_key` | Unique constraint enforcing single account per email. |

---

## 3. Database Indexes

| Table | Index Name | Purpose / Query Optimization |
| :--- | :--- | :--- |
| `bookings` | `idx_bookings_asset_period_gist` | Supports the GiST temporal exclusion constraint for instant overlap detection. |
| `bookings` | `idx_bookings_user_id` | Fast lookup for user booking history and profile views. |
| `assets` | `idx_assets_owner_id` | Accelerates asset management dashboards for equipment owners. |
| `assets` | `idx_assets_lifecycle_state` | Filters available vs rented inventory during search queries. |
| `listings` | `idx_listings_asset_id` | Joins catalog listings to physical equipment items. |
| `inspections` | `idx_inspections_booking_id` | Fetches check-in/check-out inspection records for a rental agreement. |
| `custody_logs` | `idx_custody_logs_booking_id` | Retrieves complete custody handover lineage for any rental contract. |
| `ledger_entries`| `idx_ledger_entries_tx_id` | Optimizes transaction balancing calculations and financial audit exports. |
| `audit_logs` | `idx_audit_logs_created_at` | Provides sequential log ordering for time-range audit searches. |

---

## 4. Trigger Functions & Invariants

1. **`prevent_mutation` Trigger:**
   - Attached to: `audit_logs`, `booking_events`, `ledger_entries`.
   - Behavior: Raises a database exception on any `UPDATE` or `DELETE` statement, ensuring absolute immutability.
2. **`enforce_ledger_balance` Trigger:**
   - Attached to: `ledger_transactions`.
   - Behavior: Constraint trigger deferred to `COMMIT` verifying that `SUM(debit) == SUM(credit)` for every transaction.
3. **`enforce_allowed_transitions` Trigger:**
   - Attached to: `assets` (`lifecycle_state`) and `bookings` (`status`).
   - Behavior: Validates state transitions against predefined directed graphs; aborts unauthorized state changes.

---

## 5. Append-Only Tables
The following tables are strictly append-only:
- `audit_logs`
- `booking_events`
- `ledger_entries`

Direct mutations or deletions are rejected at the database engine level via triggers.

---

## 6. How to Reset & Seed Database
```bash
# Complete teardown, re-migration, and seed:
npm run db:reset

# Run individual migrations:
npm run db:migrate

# Seed data only:
npm run db:seed

# Verify all invariants and constraints:
npm run db:test
```
