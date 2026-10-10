# System Requirements Specification: {{APP_NAME}}

## 1. Roles & Core Responsibilities

- **Renter**: Searches available assets, creates bookings, completes identity verification, confirms mutual handover OTP, and returns rented assets.
- **Owner**: Registers physical assets, defines category attributes, publishes rental/buyout listings, and inspects returned assets.
- **Inspector**: Performs baseline and return physical verifications, evaluates 8-point inspection templates, and reviews condition disputes.
- **Admin**: Manages system users, oversees dispute resolutions, audits immutable event logs, and inspects database health via the Command Center.

---

## 2. Functional Requirements (FR)

### Module 1: Assets and Categories
- **FR-01**: System shall maintain a normalized catalog of asset categories with configurable condition delta thresholds.
- **FR-02**: System shall allow defining category-specific dynamic attribute fields stored as validated JSONB structures.
- **FR-03**: System shall register physical assets with manufacturer, model, serial number, and category references.
- **FR-04**: System shall enforce temporal exclusivity on asset ownership via PostgreSQL GiST exclusion constraints (`owned_during`).
- **FR-05**: System shall track geographical coordinates and municipal location for each asset, maintaining one current location flag.
- **FR-06**: System shall record verified technical specifications linked to an inspecting authority.
- **FR-07**: System shall append immutable lifecycle events to an asset timeline whenever an asset state changes.

### Module 2: Listings and Search
- **FR-08**: System shall permit owners to create rental listings with daily pricing and security deposit requirements.
- **FR-09**: System shall support optional buyout terms (`buyout_available = true` with strictly positive `buyout_price`).
- **FR-10**: System shall support rule-based pricing adjustments for long-term rentals and weekend surcharges.
- **FR-11**: System shall filter and query active listings matching search criteria, date ranges, and categories.

### Module 3: Booking
- **FR-12**: System shall create reservation requests containing a timestamp range window (`tstzrange`) and financial totals.
- **FR-13**: System shall prevent concurrent overlapping bookings on active asset states via PostgreSQL GiST exclusion constraint (`no_overlapping_rentals`).
- **FR-14**: System shall enforce idempotent booking creation via unique idempotency keys per user and endpoint.
- **FR-15**: System shall record append-only state transitions with actor metadata in `booking_events`.
- **FR-16**: System shall transition expired unconfirmed bookings from `RESERVED` to `EXPIRED`.

### Module 4: Inspection and Evidence
- **FR-17**: System shall maintain category-specific inspection templates containing the standardized 8-point manifest items.
- **FR-18**: System shall enforce measurable inspection points to have weighted scores summing strictly to 1.0 per template.
- **FR-19**: System shall capture baseline and return inspections recording scores (0-5) and textual observations for each manifest item.
- **FR-20**: System shall store cryptographic SHA-256 hashes, MIME types, and storage keys for uploaded photographic evidence.
- **FR-21**: System shall generate immutable condition snapshots summarizing overall condition score (0-100) and item details.

### Module 5: Handover and Custody
- **FR-22**: System shall execute mutual handover verification requiring owner, renter, and manifest confirmations.
- **FR-23**: System shall generate time-bounded, cryptographically hashed one-time passwords (OTP) with an attempt limit of 5.
- **FR-24**: System shall never persist raw OTP strings in plaintext within the database.
- **FR-25**: System shall record append-only custody transfer events documenting previous and incoming custodians.

### Module 6: Return and Condition Delta
- **FR-26**: System shall compute a weighted condition delta between baseline and return inspection snapshots (`SUM(weight * |baseline - return|)`).
- **FR-27**: System shall evaluate the condition delta against the category threshold to classify returns as `NORMAL` or `DISPUTE_REVIEW_REQUIRED`.
- **FR-28**: System shall persist calculation inputs, mathematical delta, and decision version in an append-only `condition_deltas` table.

### Module 7: Settlement and Ledger
- **FR-29**: System shall maintain isolated double-entry ledger accounts (`USER_DEPOSIT`, `ESCROW`, `PLATFORM_REVENUE`, `OWNER_PAYABLE`, `EXTERNAL`).
- **FR-30**: System shall record append-only financial ledger transactions for deposits, rental payments, fees, settlements, and refunds.
- **FR-31**: System shall enforce that all financial entries for a transaction strictly balance (`SUM(debit) == SUM(credit)`).
- **FR-32**: System shall release held deposits upon normal return settlement and freeze deposits upon threshold breach.

### Module 8: Disputes
- **FR-33**: System shall allow renters or owners to open formal dispute cases against bookings with condition or custody anomalies.
- **FR-34**: System shall restrict bookings to at most one active (non-resolved) dispute at any time via a partial unique index.
- **FR-35**: System shall enforce mutual consistency between dispute `RESOLVED` status and formal resolution attribution.
- **FR-36**: System shall append all dispute audit actions and evidence references to an append-only `dispute_events` log.

### Module 9: Trust and Health Scores
- **FR-37**: System shall compute explainable owner and renter trust scores (0-100) accompanied by contributing factor breakdowns.
- **FR-38**: System shall calculate multi-factor asset health scores (0-100) combining condition, maintenance compliance, and rental utilization.
- **FR-39**: System shall track calculation algorithm version and historical scoring inputs for full auditability.

### Module 10: Asset Passport and QR
- **FR-40**: System shall assemble a consolidated Asset Passport aggregating identity, custody, health score, and inspection timeline.
- **FR-41**: System shall support cryptographic identifier binding to physical assets for verification via quick-response codes.

### Module 11: Audit System
- **FR-42**: System shall record append-only audit entries containing actor ID, action name, target entity, request ID, and state diffs.
- **FR-43**: System shall prevent UPDATE and DELETE mutations on audit logs via database-level trigger functions.
- **FR-44**: System shall stage asynchronous event delivery through an outbox pattern table with status tracking and retry counters.

### Module 12: Database Command Center
- **FR-45**: System shall provide administrative inspection of database connection metrics and query stats via `pg_stat_statements`.
- **FR-46**: System shall monitor index usage, table storage volumes, and constraint violations for database health governance.

---

## 3. Non-Functional Requirements (NFR)

- **NFR-01 (Consistency)**: Invariants including double-booking exclusion, non-overlapping ownership, and ledger debit/credit parity must be strictly enforced by PostgreSQL engine constraints.
- **NFR-02 (Security)**: Passwords and OTP tokens must be cryptographically hashed (bcrypt/Argon2 and HMAC/SHA-256); plaintext credentials must never be written to persistent storage.
- **NFR-03 (Performance)**: All foreign key columns and frequently filtered columns (such as booking date ranges and active listing status) must have corresponding indexes.
- **NFR-04 (Auditability)**: Critical lifecycle events, financial ledger entries, condition deltas, and custody changes must be append-only and immutable.
- **NFR-05 (Usability)**: API endpoints must provide consistent error structures with standardized HTTP status codes (400, 401, 403, 409, 422, 500) and correlated request tracking IDs.
- **NFR-06 (Portability)**: The entire software ecosystem must launch reproducibly on any standard operating system via Docker Compose without external dependencies.
- **NFR-07 (Cost)**: The architecture must utilize 100% free, open-source technologies (PostgreSQL, NestJS, Next.js, Docker) with zero paid third-party service dependencies.
