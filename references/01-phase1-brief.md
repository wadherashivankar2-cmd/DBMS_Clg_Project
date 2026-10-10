# PHASE 1 (Foundation) execution brief

You are an AI coding agent. Execute this file step by step, in order. Do not start Phase 2 work. After each step run its Verify commands, fix failures, then report what you did and the verify output before moving on. If something is ambiguous, pick the simplest free option and record the choice in docs/DECISIONS.md.

## 0. Project in one paragraph
A database-first rental platform for high-value assets (cameras, laptops, tools, vehicles, etc.). Strangers rent assets; the system records the asset's condition before and after, prevents double booking, keeps an append-only double-entry money ledger, and keeps an immutable audit trail. PostgreSQL is the source of truth for correctness (constraints, transactions, ledger, audit). This is a college DBMS project for 4 people. Phase 1 builds the foundation that Phases 2 to 4 build on.

## 1. Hard constraints (never violate)
1. 100% free and open-source. No paid APIs, no paid hosting. Payments are simulated later; emails are logged later.
2. Language: TypeScript everywhere (API and web). Database scripts may be plain SQL plus small Node scripts.
3. Stack (fixed, do not substitute): PostgreSQL 16, NestJS (REST), Next.js (App Router) with Tailwind CSS, Docker + Docker Compose, Node 20+ LTS, npm workspaces.
4. Modular monolith. No microservices.
5. Everything runs locally with Docker Compose. Setup must work on a clean machine using only the README.
6. Migrations are plain numbered .sql files that rebuild the database from empty. Never edit an applied migration; add a new one.
7. Do not implement in Phase 1: real authentication, booking logic, payments, uploads, business endpoints. Only scaffolds, schema, seed, tests, docs.
8. Do not invent performance numbers anywhere in docs.
9. Keep the code simple and commented. Prefer boring, standard solutions.

## 2. Target repository layout (create exactly this)
/
├── apps/
│   ├── api/                 # NestJS app
│   └── web/                 # Next.js app
├── db/
│   ├── migrations/          # 001_*.sql ... in order
│   ├── seed/                # seed.ts (TypeScript) + data files
│   ├── tests/               # schema tests (node:test)
│   ├── migrate.ts           # migration runner
│   └── reset.ts             # drop + migrate + seed
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── DECISIONS.md
│   ├── HANDOFF.md
│   ├── REQUIREMENTS.md
│   ├── er-diagram.md        # Mermaid erDiagram
│   ├── state-machines.md    # tables + Mermaid stateDiagram-v2
│   └── api-contract.md      # route list (also exposed as OpenAPI)
├── .github/pull_request_template.md
├── docker-compose.yml
├── .env.example
├── .gitignore
├── package.json             # npm workspaces + root scripts
└── README.md

Root package.json scripts required:
- npm run db:up : docker compose up -d db and wait until healthy
- npm run db:migrate : apply pending migrations
- npm run db:seed : load seed data
- npm run db:reset : drop schema, migrate, seed (one command)
- npm run db:test : run db/tests
- npm run dev:api : start NestJS in watch mode
- npm run dev:web : start Next.js dev server

## STEP 1: Repo and environment
Do:
1. git init; create branches main and develop; work on develop. Branch convention for later: feature/*.
2. Create the folder layout above, .gitignore (node_modules, .env, dist, .next, docker volumes), .github/pull_request_template.md with this checklist: branch is feature/* and up to date; migrations rebuild from empty; tests added and passing; EXPLAIN ANALYZE checked for new or changed queries; no secrets in code; docs/Swagger updated; one reviewer approved.
3. docker-compose.yml:
  - db: image postgres:16-alpine, env from .env, volume for data, healthcheck with pg_isready, port 5432, command postgres -c shared_preload_libraries=pg_stat_statements -c pg_stat_statements.track=all.
  - api and web services using simple dev Dockerfiles (Node 20 alpine), mounted source, depends_on db healthy. These may be started with docker compose up.
  - minio and redis defined with profiles: ["storage"] and profiles: ["cache"] so they do not start by default.
4. .env.example with: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, DATABASE_URL, API_PORT=4000, WEB_PORT=3000, NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1, NODE_ENV.
5. README.md: prerequisites, 5-line quick start (copy env, npm install, npm run db:up, npm run db:reset, npm run dev:api / dev:web), script table, folder map.
Verify: docker compose up -d db shows a healthy container; docker compose config is valid; git branch shows main and develop.

## STEP 2: Requirements and models (documents)
Write these files. Use Mermaid for diagrams (no external tools).
- docs/REQUIREMENTS.md: Roles: Renter, Owner, Inspector, Admin with one-line responsibilities.
  - Functional requirements with IDs (FR-01...), grouped by module: assets and categories, listings and search, booking, inspection and evidence, handover and custody, return and condition delta, settlement and ledger, disputes, trust and health scores, Asset Passport and QR, audit, Database Command Center.
  - Non-functional requirements (NFR-01...): consistency, security, performance, auditability, usability, portability, cost (zero).
  - Each requirement is one line.
1. docs/er-diagram.md: a Mermaid erDiagram of all tables from Step 3 with PK/FK and cardinalities. If it becomes too large, split into 3 diagrams (identity and assets; booking and inspection; money and audit).
2. docs/state-machines.md: for each entity a transitions table (From | To | Trigger) and a Mermaid stateDiagram-v2. Entities and states:
  - Asset lifecycle: LISTED, VERIFIED, AVAILABLE, RESERVED, INSPECTION_PENDING, ACTIVE_CUSTODY, RETURN_INSPECTION, SETTLED, DISPUTED, MAINTENANCE, REPAIR, SOLD.
  - Booking: RESERVED, INSPECTION_PENDING, ACTIVE_CUSTODY, RETURN_INSPECTION, SETTLED, DISPUTED, CANCELLED, EXPIRED.
  - Inspection: DRAFT -> SUBMITTED -> APPROVED.
  - Dispute: OPEN -> UNDER_REVIEW -> RESOLVED.
  - Deposit (ledger view): DEPOSIT_HELD -> DEPOSIT_RELEASED | DEPOSIT_PARTIALLY_DEDUCTED | DEPOSIT_FROZEN; DEPOSIT_FROZEN -> DEPOSIT_RELEASED | DEPOSIT_PARTIALLY_DEDUCTED.
3. docs/DECISIONS.md: short ADR-style entries (Context, Decision, Reason) for at least: why PostgreSQL; why modular monolith; why GiST exclusion constraint for double booking; why double-entry ledger; why JSONB for category attributes; why plain SQL migrations; why Redis/MinIO are optional.
Verify: every file exists; Mermaid blocks are syntactically valid (render check or careful review); state names match Step 3 CHECK constraints exactly.

## STEP 3: Database schema (migrations)
Global rules for every table:
- Primary key id uuid PRIMARY KEY DEFAULT gen_random_uuid() unless noted (bigserial for append-only log tables).
- All timestamps are timestamptz. Add created_at timestamptz NOT NULL DEFAULT now(). Add updated_at (with trigger) on mutable tables.
- Money is numeric(14,2) with CHECK (>= 0) (or > 0 where stated). Never use float for money.
- Enumerations are text with a named CHECK (col IN (...)). Do not use PostgreSQL ENUM types.
- Names are snake_case. Name constraints explicitly (chk_..., uq_..., fk_...). Add COMMENT ON TABLE for every table (one line).
- Every foreign key column gets an index (unless it is the leading column of a primary or unique index).

Create these migration files in this order (each file is wrapped in BEGIN; ... COMMIT;):
001_extensions_and_helpers.sql
- CREATE EXTENSION IF NOT EXISTS btree_gist; and pg_stat_statements; and citext;
- function set_updated_at() trigger function.
- function prevent_mutation() that raises exception '% is append-only' for UPDATE or DELETE.

002_identity.sql
- roles(id smallint PK, code text UNIQUE NOT NULL CHECK code IN ('RENTER','OWNER','INSPECTOR','ADMIN'), description)
- users(email citext UNIQUE NOT NULL, password_hash text NOT NULL, full_name text NOT NULL, phone text, status text CHECK IN ('ACTIVE','SUSPENDED') DEFAULT 'ACTIVE', created_at, updated_at)
- user_roles(user_id FK, role_id FK, PRIMARY KEY (user_id, role_id))
- user_verifications(user_id FK, type CHECK IN ('EMAIL','PHONE','ID_DOCUMENT'), status CHECK IN ('PENDING','VERIFIED','REJECTED') DEFAULT 'PENDING', verified_at, created_at) with UNIQUE (user_id, type)

003_assets.sql
- asset_categories(code text UNIQUE NOT NULL, name text NOT NULL, condition_threshold numeric(6,2) NOT NULL CHECK (>= 0), created_at): threshold is the per-category automatic-settlement limit for the condition delta.
- asset_category_fields(category_id FK, field_key text, label text, data_type CHECK IN ('text','number','boolean','enum'), is_required boolean DEFAULT false, allowed_values jsonb, UNIQUE (category_id, field_key))
- assets(category_id FK, owner_id FK users, manufacturer text, model text, serial_number text, acquisition_date date, lifecycle_state text NOT NULL DEFAULT 'LISTED' CHECK IN (the 12 asset states), condition_score numeric(5,2) CHECK BETWEEN 0 AND 100, health_score numeric(5,2) CHECK BETWEEN 0 AND 100, reliability_score numeric(5,2) CHECK BETWEEN 0 AND 100, attributes jsonb NOT NULL DEFAULT '{}', created_at, updated_at); partial unique index on (category_id, serial_number) WHERE serial_number IS NOT NULL.
- asset_specifications(asset_id FK, spec_key text, spec_value text, verified_by FK users NULL, verified_at, UNIQUE (asset_id, spec_key)): verified identity specs (the free-form category data lives in assets.attributes).
- asset_ownership(asset_id FK, owner_id FK users, owned_during tstzrange NOT NULL, reason CHECK IN ('REGISTERED','SOLD')) with EXCLUDE USING gist (asset_id WITH =, owned_during WITH &&) (one owner at any time).
- asset_locations(asset_id FK, city text NOT NULL, area text, latitude numeric(9,6), longitude numeric(9,6), is_current boolean DEFAULT true, created_at); partial unique index one current location per asset.
- asset_events(id bigserial PK, asset_id FK, event_type text NOT NULL, actor_id FK users NULL, metadata jsonb NOT NULL DEFAULT '{}', created_at): asset timeline, append-only (attach prevent_mutation). Index (asset_id, created_at).

004_listings_bookings.sql
- listings(asset_id FK, title text NOT NULL, description text, status CHECK IN ('DRAFT','ACTIVE','PAUSED','CLOSED') DEFAULT 'DRAFT', daily_price numeric(14,2) NOT NULL CHECK (>= 0), deposit_amount numeric(14,2) NOT NULL CHECK (>= 0), buyout_available boolean NOT NULL DEFAULT false, buyout_price numeric(14,2), created_by FK users, created_at, updated_at) with CHECK (buyout_available = false OR buyout_price > 0).
- pricing_rules(listing_id FK, rule_type CHECK IN ('LONG_TERM_DISCOUNT','WEEKEND_SURCHARGE'), min_days int CHECK (>= 1), percent_adjustment numeric(5,2) NOT NULL)
- bookings(asset_id FK, listing_id FK, renter_id FK users, booking_window tstzrange NOT NULL, lifecycle_state text NOT NULL DEFAULT 'RESERVED' CHECK IN (the 8 booking states), total_price numeric(14,2) NOT NULL CHECK (>= 0), deposit_amount numeric(14,2) NOT NULL CHECK (>= 0), idempotency_key text, created_at, updated_at) with:
  - CHECK (NOT isempty(booking_window) AND upper(booking_window) > lower(booking_window))
  - CONSTRAINT no_overlapping_rentals EXCLUDE USING gist (asset_id WITH =, booking_window WITH &&) WHERE (lifecycle_state IN ('RESERVED','INSPECTION_PENDING','ACTIVE_CUSTODY'))
  - partial unique index on (renter_id, idempotency_key) WHERE idempotency_key IS NOT NULL
  - index on (asset_id, lifecycle_state) and GiST index support via the exclusion constraint.
- booking_events(id bigserial PK, booking_id FK, event_type text NOT NULL, from_state text, to_state text, actor_id FK users NULL, metadata jsonb NOT NULL DEFAULT '{}', created_at) append-only.
- idempotency_keys(user_id FK, key text, endpoint text, request_hash text, response_status int, response_body jsonb, created_at, UNIQUE (user_id, key, endpoint))

005_inspections.sql
- inspection_templates(category_id FK, name text, version int NOT NULL DEFAULT 1, is_active boolean DEFAULT true, UNIQUE (category_id, version))
- inspection_template_items(template_id FK, point_no smallint CHECK BETWEEN 1 AND 8, item_key text, label text, is_measurable boolean NOT NULL, weight numeric(5,4) NOT NULL DEFAULT 0 CHECK (>= 0), max_score smallint DEFAULT 5, UNIQUE (template_id, item_key)). The 8 points are: identity/serial, physical exterior, major components, accessories, functional test, wear/cosmetic, runtime/usage metrics, evidence/photography.
- inspections(asset_id FK, booking_id FK NULL, template_id FK, type CHECK IN ('VERIFICATION','BASELINE','RETURN'), status CHECK IN ('DRAFT','SUBMITTED','APPROVED') DEFAULT 'DRAFT', performed_by FK users, performed_at timestamptz, notes text, created_at)
- inspection_items(inspection_id FK, template_item_id FK, item_key text, score smallint CHECK BETWEEN 0 AND 5, text_value text, UNIQUE (inspection_id, item_key))
- inspection_evidence(asset_id FK, inspection_id FK, object_key text UNIQUE NOT NULL, sha256_hash char(64) NOT NULL CHECK (sha256_hash ~ '^[0-9a-f]{64}$'), mime_type text NOT NULL, size_bytes bigint NOT NULL CHECK (> 0), captured_at timestamptz, uploaded_by FK users, created_at)
- condition_snapshots(asset_id FK, inspection_id FK UNIQUE, overall_score numeric(5,2) CHECK BETWEEN 0 AND 100, item_values jsonb NOT NULL, created_at)
- condition_deltas(booking_id FK UNIQUE, baseline_snapshot_id FK, return_snapshot_id FK, weighted_delta numeric(8,4) NOT NULL CHECK (>= 0), threshold numeric(6,2) NOT NULL, outcome CHECK IN ('NORMAL','DISPUTE_REVIEW_REQUIRED'), calc_version text NOT NULL, inputs jsonb NOT NULL, created_at) append-only.

006_custody_maintenance_disputes.sql
- handover_records(booking_id FK, direction CHECK IN ('PICKUP','RETURN'), owner_confirmed_at, renter_confirmed_at, manifest_confirmed_at, otp_hash text, otp_expires_at timestamptz, otp_attempts smallint NOT NULL DEFAULT 0 CHECK (otp_attempts BETWEEN 0 AND 5), verified_at, created_at, UNIQUE (booking_id, direction)). Never store an OTP in plain text.
- custody_events(id bigserial PK, asset_id FK, booking_id FK, from_user_id FK NULL, to_user_id FK NULL, event_type text NOT NULL, created_at) append-only.
- maintenance_records(asset_id FK, type CHECK IN ('ROUTINE','INSPECTION_DRIVEN'), description, performed_on date, next_due_on date, cost numeric(14,2) CHECK (>= 0), verified_by FK users NULL, created_at)
- repair_records(asset_id FK, damage_report_id FK NULL, description, cost numeric(14,2) CHECK (>= 0), started_on date, completed_on date, CHECK (completed_on IS NULL OR completed_on >= started_on))
- damage_reports(asset_id FK, booking_id FK, reported_by FK users, description text NOT NULL, severity smallint CHECK BETWEEN 1 AND 5, created_at)
- disputes(booking_id FK, opened_by FK users, reason text NOT NULL, status CHECK IN ('OPEN','UNDER_REVIEW','RESOLVED') DEFAULT 'OPEN', resolution CHECK IN ('RENTER_FAULT','OWNER_FAULT','SPLIT','NO_FAULT') NULL, resolved_by FK users NULL, opened_at, resolved_at, CHECK ((status = 'RESOLVED') = (resolution IS NOT NULL))); partial unique index: one non-resolved dispute per booking.
- dispute_events(id bigserial PK, dispute_id FK, event_type text NOT NULL, actor_id FK users NULL, notes text, evidence_id FK NULL, created_at) append-only.

007_ledger.sql
- ledger_accounts(code text UNIQUE NOT NULL, type CHECK IN ('USER_DEPOSIT','ESCROW','PLATFORM_REVENUE','OWNER_PAYABLE','EXTERNAL'), owner_user_id FK NULL, created_at)
- ledger_transactions(booking_id FK NULL, kind CHECK IN ('DEPOSIT_HELD','DEPOSIT_RELEASED','DEPOSIT_PARTIALLY_DEDUCTED','DEPOSIT_FROZEN','RENTAL_PAYMENT','PLATFORM_FEE','OWNER_SETTLEMENT','REFUND'), idempotency_key text UNIQUE, description text, created_at) append-only.
- ledger_entries(id bigserial PK, transaction_id FK, account_id FK, direction CHECK IN ('DEBIT','CREDIT'), amount numeric(14,2) NOT NULL CHECK (amount > 0), created_at) append-only.
- Balance rule: CREATE CONSTRAINT TRIGGER on ledger_entries (DEFERRABLE INITIALLY DEFERRED, AFTER INSERT) calls a function that checks, for the affected transaction_id, SUM(amount) FILTER (WHERE direction='DEBIT') = SUM(amount) FILTER (WHERE direction='CREDIT'), else raises an exception. (Priority: SHOULD. If it proves hard, document the decision and leave it for Phase 3.)

008_scores_audit_outbox.sql
- trust_scores(user_id FK, kind CHECK IN ('OWNER','RENTER'), score numeric(5,2) CHECK BETWEEN 0 AND 100, factors jsonb NOT NULL, calc_version text NOT NULL, computed_at timestamptz)
- asset_health_scores(asset_id FK, score numeric(5,2) CHECK BETWEEN 0 AND 100, inputs jsonb NOT NULL, calc_version text NOT NULL, computed_at timestamptz)
- reviews(booking_id FK, reviewer_id FK users, reviewee_id FK users, rating smallint CHECK BETWEEN 1 AND 5, comment text, UNIQUE (booking_id, reviewer_id))
- notifications(user_id FK, type text, payload jsonb, read_at, created_at)
- audit_logs(id bigserial PK, actor_id uuid NULL, action text NOT NULL, entity_type text NOT NULL, entity_id text, request_id text, before_state jsonb, after_state jsonb, metadata jsonb NOT NULL DEFAULT '{}', created_at) append-only. Index (entity_type, entity_id) and (created_at).
- outbox_events(id bigserial PK, aggregate_type text, aggregate_id text, event_type text NOT NULL, payload jsonb NOT NULL, created_at, processed_at timestamptz NULL, attempts int NOT NULL DEFAULT 0); partial index on (id) WHERE processed_at IS NULL.

009_indexes_and_triggers.sql
- Attach set_updated_at BEFORE UPDATE trigger to: users, assets, listings, bookings.
- Attach prevent_mutation BEFORE UPDATE OR DELETE trigger to: audit_logs, booking_events, asset_events, custody_events, dispute_events, ledger_transactions, ledger_entries, condition_deltas.
- Extra indexes: GIN on assets.attributes; (category_id, lifecycle_state) on assets; (listing status) partial where status='ACTIVE'; bookings(renter_id, created_at DESC); disputes(status); inspection_evidence(inspection_id).
- Above each non-obvious index add a SQL comment with a one-line reason; collect these reasons in docs/DATABASE.md.

010_allowed_transitions.sql  (Priority: SHOULD)
- allowed_transitions(entity_type text, from_state text, to_state text, PRIMARY KEY (entity_type, from_state, to_state)) filled from docs/state-machines.md, plus function is_transition_allowed(entity text, from_s text, to_s text) RETURNS boolean.

Migration runner (db/migrate.ts)
- Table schema_migrations(filename text PK, applied_at timestamptz).
- Applies files in lexical order that are not yet recorded, each in its own transaction; fails loudly with the file name on error. Uses DATABASE_URL.

Verify:
npm run db:up
npm run db:reset
docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB -c "\dt"

## STEP 4: Seed data (db/seed/seed.ts)
Idempotent when run after db:reset. Use bcrypt (or argon2) to hash passwords at seed time; never commit hashes by hand.
Seed:
1. roles: RENTER, OWNER, INSPECTOR, ADMIN.
2. asset_categories (7) with condition_threshold: Electronics, Cameras, Vehicles, Tools, Fashion, Musical/Event, Games/Recreation. Add 3 to 5 asset_category_fields per category.
3. One active inspection_templates row per category with all 8 points as inspection_template_items. Measurable items carry weights that sum to 1.0 per template; non-measurable items have weight 0.
4. Users (all with the dev password Password@123): 1 admin, 1 inspector, 2 owners, 2 renters. Assign roles via user_roles. Mark them verified in user_verifications.
5. About 20 assets spread across categories and owners with realistic manufacturer/model/serial, attributes matching the category fields, one asset_ownership row each, one current asset_locations row each (use Bengaluru-area locations), and an asset_events row ASSET_CREATED. Lifecycle states mostly AVAILABLE, a few LISTED, one MAINTENANCE.
6. listings for the available assets with sensible daily_price and deposit_amount; two with buyout_available = true.
7. Ledger accounts: ESCROW, PLATFORM_REVENUE, EXTERNAL, plus one USER_DEPOSIT and OWNER_PAYABLE account per seeded renter/owner.
8. Three bookings that do not overlap (one RESERVED future, one SETTLED past, one CANCELLED) with matching booking_events.

db/reset.ts: drops and recreates the public schema, then runs migrate and seed. npm run db:reset must work end to end on an empty database.

Verify: npm run db:reset succeeds; SELECT count(*) shows 4 roles, 7 categories, 6 users, about 20 assets, 3 bookings.

## STEP 5: Schema tests (db/tests, using node:test and pg)
Each test runs in a transaction that is rolled back. Write tests that expect the database to reject the action:
1. Insert booking overlapping an existing RESERVED booking for the same asset -> fails with exclusion violation (23P01).
2. Insert a booking overlapping a CANCELLED booking -> succeeds.
3. Booking with upper <= lower window -> check violation (23514).
4. Negative daily_price or deposit_amount -> check violation.
5. Score of 101 on any score column -> check violation.
6. Foreign key violation (booking with unknown asset_id) -> 23503.
7. Duplicate email -> unique violation (23505).
8. UPDATE and DELETE on audit_logs, booking_events, ledger_entries -> exception raised by prevent_mutation.
9. Invalid lifecycle_state string on an asset -> check violation.
10. (if the balance trigger exists) Ledger transaction with unequal debits and credits fails at commit; a balanced one succeeds.
11. Invalid SHA-256 string in inspection_evidence -> check violation.
12. Second non-resolved dispute for the same booking -> unique violation.

Verify: npm run db:test prints all tests passing.

## STEP 6: API and web scaffolds
apps/api (NestJS + TypeScript)
- Global prefix /api/v1. Port from API_PORT.
- GET /api/v1/health -> { status: 'ok', db: 'up' | 'down', time } (runs SELECT 1).
- Global ValidationPipe (whitelist, forbid unknown), CORS limited to WEB_PORT origin from env.
- Request-ID middleware: reads or generates x-request-id, attaches to request and response, logs it.
- Global exception filter returning a consistent JSON error: { statusCode, error, message, requestId, details? }. Include a small mapPgError(err) helper: 23P01 and 23505 -> 409; 23503 -> 422; 23514, 22P02 -> 400; anything else -> 500 without leaking SQL text.
- Dev-auth stub: DevAuthGuard reads header x-user-id (a seeded user UUID), loads the user and their roles, and attaches req.user. Missing or unknown id -> 401. A @Roles('OWNER', ...) decorator plus RolesGuard returns 403 on mismatch. Mark clearly with comment // PHASE 5: replace DevAuthGuard with JWT guard; controllers must not change.
- Database module: a pg Pool (max 10 connections, from DATABASE_URL), injectable, closes on shutdown.
- Swagger at /api/docs (@nestjs/swagger). Create empty module folders and controllers for: auth, users, assets, categories, listings, bookings, inspections, handover, returns, maintenance, disputes, trust, health, payments, ledger, audit, admin-db. Each controller declares its planned routes (see docs/api-contract.md), documented with @ApiTags, returning 501 Not Implemented with message "Planned for Phase N". Only health is real.

docs/api-contract.md
A table with Method | Path | Role | Phase | Purpose for at least 40 planned routes across the modules above.

apps/web (Next.js App Router, TypeScript, Tailwind)
- One home page that calls GET {NEXT_PUBLIC_API_URL}/health and shows API and DB status.
- A minimal layout with header. No other pages yet.

Verify:
npm run dev:api
curl http://localhost:4000/api/v1/health            # ok, db up
curl -i http://localhost:4000/api/v1/bookings       # 401 without x-user-id
curl -i -H "x-user-id: <seeded renter uuid>" http://localhost:4000/api/v1/bookings   # 501
Swagger UI opens at /api/docs listing all modules. npm run dev:web shows the status page.

## STEP 7: Documentation and hand-off
1. docs/ARCHITECTURE.md: layered flow Next.js -> NestJS -> PostgreSQL (with optional MinIO and Redis), one Mermaid diagram, why modular monolith, rule that PostgreSQL is authoritative, module list.
2. docs/DATABASE.md: table groups with purpose, the constraint list (table, constraint, what it prevents), index list with the one-line reason for each, trigger list, how to reset and seed, and the append-only tables.
3. docs/HANDOFF.md (for the Phase 2 owner) with sections: Done, Not done, How to run and test, Decisions and shortcuts, Known issues, Needed from next owner. Include the seeded dev user UUIDs and the dev password.
4. Update README.md so a stranger can start from zero. Test the quick start from a fresh clone in a new folder.
5. Commit in logical commits on develop; tag v0.1.

Verify: from a fresh clone: cp .env.example .env && npm install && npm run db:up && npm run db:reset && npm run db:test all pass.

## Definition of done (Phase 1)
- [ ] npm run db:reset rebuilds the database from empty with one command and the seed loads.
- [ ] npm run db:test passes; overlapping bookings, negative prices, bad scores, broken foreign keys and edits to append-only tables are rejected by the database.
- [ ] GET /api/v1/health works; Swagger lists all planned modules; dev-auth stub and @Roles work.
- [ ] All docs in Step 2 and Step 7 exist and match the actual schema.
- [ ] Fresh-clone setup works using only the README.
- [ ] Nothing beyond Phase 1 scope was implemented.
