# Architectural and Design Decisions (ADR)

This document records architectural, schema, and operational decisions, deviations, and rationale made during the lifecycle of the project.

---

## ADR 001: Project Layout and Documentation Consolidation
- **Status**: Accepted
- **Context**: The Phase 1 brief specified documentation under `docs/`, but user instructions mandated placing all documentation within `references/` and deleting empty leftover directories (`docs/`, `database/`, `scripts/`, `src/`).
- **Decision**: All documentation is placed in `references/` instead of `docs/`. Empty leftover directories were removed.
- **Reason**: Adhere to user constraints while preserving the documentation specifications.
- **Consequences**: All file paths for ADRs, requirements, schema docs, diagrams, and progress reporting reference `references/`.

---

## ADR 002: Why PostgreSQL as the Authoritative Source of Truth
- **Status**: Accepted
- **Context**: High-value asset rentals require strict transactional consistency, concurrency control, range overlap prevention, append-only guarantees, and financial audit trails.
- **Decision**: Use PostgreSQL 16 as the central source of truth, enforcing business-critical invariants directly at the database engine level via constraints, exclusion indexes, triggers, and transactions.
- **Reason**: Application-layer checks are vulnerable to race conditions under concurrent requests. Database-level enforcement guarantees correctness regardless of how many application instances or threads access the data.
- **Consequences**: Relies on specific PostgreSQL extensions (`btree_gist`, `citext`, `pg_stat_statements`). Invariants cannot be bypassed by application bugs.

---

## ADR 003: Why Modular Monolith over Microservices
- **Status**: Accepted
- **Context**: The project is designed for a team of 4 engineers with zero budget, running on local development machines using Docker Compose.
- **Decision**: Adopt a modular monolith architecture with a single NestJS backend service and a single Next.js frontend application communicating with a unified PostgreSQL database.
- **Reason**: Microservices introduce distributed transactions (2PC/Saga), network latency, inter-service authentication overhead, complex deployment choreography, and debugging friction without business necessity for this scale.
- **Consequences**: Fast local iterations, trivial end-to-end testing, atomic transactions across domains (e.g. booking creation + escrow hold), zero distributed tracing overhead.

---

## ADR 004: Why GiST Exclusion Constraint for Double-Booking Prevention
- **Status**: Accepted
- **Context**: Concurrent reservation attempts for the same asset over intersecting time intervals must never result in double bookings.
- **Decision**: Model rental intervals using PostgreSQL `tstzrange` and enforce temporal uniqueness using a GiST exclusion constraint (`EXCLUDE USING gist (asset_id WITH =, booking_window WITH &&) WHERE (lifecycle_state IN ('RESERVED', 'INSPECTION_PENDING', 'ACTIVE_CUSTODY'))`).
- **Reason**: Traditional `SELECT ... WHERE NOT EXISTS ... INSERT` checks fail under race conditions unless serializable isolation or table-level locks are used (which bottleneck throughput). The GiST exclusion constraint utilizes index-level locking in PostgreSQL, guaranteeing mathematical exclusivity with standard `READ COMMITTED` transactions.
- **Consequences**: Requires the `btree_gist` extension; booking windows must strictly be non-empty valid `tstzrange` structures. Conflicts automatically raise error code `23P01`.

---

## ADR 005: Why Double-Entry Financial Ledger
- **Status**: Accepted
- **Context**: Handling user security deposits, rental payments, platform fees, damages deductions, and refunds using mutable "balance" columns in a user table leads to race conditions, silent rounding errors, and un-auditable balance mutations.
- **Decision**: Implement an append-only double-entry financial ledger consisting of `ledger_accounts`, `ledger_transactions`, and `ledger_entries`.
- **Reason**: In double-entry accounting, money cannot be created or destroyed arbitrarily; every debit is balanced by an equivalent credit (`SUM(debit) == SUM(credit)`). Historical balances can be audited by summing entries up to any point in time.
- **Consequences**: Ledger tables are append-only (mutation blocked by triggers). Account balances are calculated dynamically from entry aggregates.

---

## ADR 006: Why JSONB for Category-Specific Flexible Attributes
- **Status**: Accepted
- **Context**: The rental platform supports diverse asset categories (electronics, cameras, vehicles, tools, fashion, etc.), each requiring distinct attributes (e.g., lens mount, battery cycles, fuel type, clothing size).
- **Decision**: Maintain a normalized core `assets` table with relational identity, lifecycle, and ownership, paired with an `attributes jsonb` column whose schema is governed by `asset_category_fields`.
- **Reason**: Creating separate database tables per category causes schema explosion, joins across dozens of category tables, and migration complexity when adding new categories. Entity-Attribute-Value (EAV) tables degrade query performance. PostgreSQL JSONB provides flexible attribute storage with indexing capability (`GIN (attributes)`).
- **Consequences**: Application validates category attributes against `asset_category_fields` prior to insertion. Specialized queries can leverage GIN containment operators (`@>`).

---

## ADR 007: Why Plain SQL Migrations and TypeScript Runner
- **Status**: Accepted
- **Context**: Schema evolution must be transparent, predictable, reproducible from scratch, and cleanly version-controlled without hidden ORM abstractions.
- **Decision**: Write migrations as plain sequentially numbered `.sql` files (`001_*.sql` to `010_*.sql`) executed by a lightweight TypeScript runner (`db/migrate.ts`) that tracks applied scripts in `schema_migrations`.
- **Reason**: Heavy ORM migration tools often struggle with advanced PostgreSQL features (GiST exclusion constraints, range types, deferrable constraint triggers, specialized GIN indexes, trigger procedures). Plain SQL provides complete fidelity and total control over database DDL.
- **Consequences**: Developers write explicit SQL DDL. Each migration is executed inside a transaction block (`BEGIN; ... COMMIT;`).

---

## ADR 008: Why Redis and MinIO Are Optional Services
- **Status**: Accepted
- **Context**: Development environments must boot reliably on any workstation with minimal memory footprint and zero external dependencies.
- **Decision**: Isolate Redis (cache) and MinIO (S3 object storage) behind Docker Compose profiles (`profiles: ["cache"]` and `profiles: ["storage"]`). Core Phase 1 database, API, and web services function without them.
- **Reason**: Phase 1 focuses on relational data modeling, schema integrity, and core contract scaffolds. Forcing local Object Storage and Redis by default consumes unnecessary developer RAM and slows initial spin-up.
- **Consequences**: Evidence metadata stores SHA-256 hashes and object keys in PostgreSQL. Physical object payload storage and distributed caching can be activated seamlessly in later phases.
