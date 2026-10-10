# Entity-Relationship Diagrams: {{APP_NAME}}

The database schema is organized into three clean functional sub-domains to maintain clarity and scannability:
1. **Identity, Assets, and Ownership**
2. **Bookings, Inspections, and Custody**
3. **Ledger, Disputes, Trust Scores, and Audit**

---

## 1. Domain: Identity, Assets, and Ownership

```mermaid
erDiagram
    roles ||--o{ user_roles : "assigned to"
    users ||--o{ user_roles : "has"
    users ||--o{ user_verifications : "verifies"
    users ||--o{ assets : "owns"
    users ||--o{ asset_ownership : "owner history"
    users ||--o{ asset_specifications : "verified by"
    users ||--o{ asset_events : "acted on"

    asset_categories ||--o{ asset_category_fields : "defines"
    asset_categories ||--o{ assets : "categorizes"
    asset_categories ||--o{ inspection_templates : "templates for"

    assets ||--o{ asset_specifications : "has specs"
    assets ||--o{ asset_ownership : "ownership history"
    assets ||--o{ asset_locations : "located at"
    assets ||--o{ asset_events : "timeline events"
    assets ||--o{ listings : "listed via"
    assets ||--o{ bookings : "rented in"
    assets ||--o{ asset_health_scores : "health computed"

    roles {
        smallint id PK
        text code UK "CHECK (RENTER, OWNER, INSPECTOR, ADMIN)"
        text description
    }

    users {
        uuid id PK
        citext email UK
        text password_hash
        text full_name
        text phone
        text status "CHECK (ACTIVE, SUSPENDED)"
        timestamptz created_at
        timestamptz updated_at
    }

    user_roles {
        uuid user_id PK,FK
        smallint role_id PK,FK
    }

    user_verifications {
        uuid id PK
        uuid user_id FK
        text type "CHECK (EMAIL, PHONE, ID_DOCUMENT)"
        text status "CHECK (PENDING, VERIFIED, REJECTED)"
        timestamptz verified_at
        timestamptz created_at
    }

    asset_categories {
        uuid id PK
        text code UK
        text name
        numeric condition_threshold "CHECK (>= 0)"
        timestamptz created_at
    }

    asset_category_fields {
        uuid id PK
        uuid category_id FK
        text field_key
        text label
        text data_type "CHECK (text, number, boolean, enum)"
        boolean is_required
        jsonb allowed_values
    }

    assets {
        uuid id PK
        uuid category_id FK
        uuid owner_id FK
        text manufacturer
        text model
        text serial_number
        date acquisition_date
        text lifecycle_state "CHECK (12 states)"
        numeric condition_score "CHECK (0..100)"
        numeric health_score "CHECK (0..100)"
        numeric reliability_score "CHECK (0..100)"
        jsonb attributes
        timestamptz created_at
        timestamptz updated_at
    }

    asset_specifications {
        uuid id PK
        uuid asset_id FK
        text spec_key
        text spec_value
        uuid verified_by FK
        timestamptz verified_at
    }

    asset_ownership {
        uuid id PK
        uuid asset_id FK
        uuid owner_id FK
        tstzrange owned_during "EXCLUDE USING gist"
        text reason "CHECK (REGISTERED, SOLD)"
    }

    asset_locations {
        uuid id PK
        uuid asset_id FK
        text city
        text area
        numeric latitude
        numeric longitude
        boolean is_current
        timestamptz created_at
    }

    asset_events {
        bigserial id PK
        uuid asset_id FK
        text event_type
        uuid actor_id FK
        jsonb metadata
        timestamptz created_at
    }
```

---

## 2. Domain: Bookings, Inspections, and Custody

```mermaid
erDiagram
    assets ||--o{ listings : "offered through"
    users ||--o{ listings : "created by"
    listings ||--o{ pricing_rules : "adjusts pricing"
    listings ||--o{ bookings : "reserved under"
    assets ||--o{ bookings : "target asset"
    users ||--o{ bookings : "renter"

    bookings ||--o{ booking_events : "events recorded"
    bookings ||--o{ handover_records : "handover status"
    bookings ||--o{ inspections : "booking inspections"
    bookings ||--o{ custody_events : "custody log"
    bookings ||--o{ condition_deltas : "delta evaluation"

    inspection_templates ||--o{ inspection_template_items : "contains"
    inspection_templates ||--o{ inspections : "instantiated by"
    inspections ||--o{ inspection_items : "graded on"
    inspections ||--o{ inspection_evidence : "evidenced by"
    inspections ||--o| condition_snapshots : "evaluated to"

    condition_snapshots ||--o{ condition_deltas : "baseline snapshot"
    condition_snapshots ||--o{ condition_deltas : "return snapshot"

    listings {
        uuid id PK
        uuid asset_id FK
        text title
        text description
        text status "CHECK (DRAFT, ACTIVE, PAUSED, CLOSED)"
        numeric daily_price "CHECK (>= 0)"
        numeric deposit_amount "CHECK (>= 0)"
        boolean buyout_available
        numeric buyout_price "CHECK (buyout_price > 0)"
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    pricing_rules {
        uuid id PK
        uuid listing_id FK
        text rule_type "CHECK (LONG_TERM_DISCOUNT, WEEKEND_SURCHARGE)"
        int min_days "CHECK (>= 1)"
        numeric percent_adjustment
    }

    bookings {
        uuid id PK
        uuid asset_id FK
        uuid listing_id FK
        uuid renter_id FK
        tstzrange booking_window "EXCLUDE USING gist"
        text lifecycle_state "CHECK (8 states)"
        numeric total_price "CHECK (>= 0)"
        numeric deposit_amount "CHECK (>= 0)"
        text idempotency_key
        timestamptz created_at
        timestamptz updated_at
    }

    booking_events {
        bigserial id PK
        uuid booking_id FK
        text event_type
        text from_state
        text to_state
        uuid actor_id FK
        jsonb metadata
        timestamptz created_at
    }

    inspection_templates {
        uuid id PK
        uuid category_id FK
        text name
        int version
        boolean is_active
    }

    inspection_template_items {
        uuid id PK
        uuid template_id FK
        smallint point_no "CHECK (1..8)"
        text item_key
        text label
        boolean is_measurable
        numeric weight "CHECK (>= 0)"
        smallint max_score
    }

    inspections {
        uuid id PK
        uuid asset_id FK
        uuid booking_id FK
        uuid template_id FK
        text type "CHECK (VERIFICATION, BASELINE, RETURN)"
        text status "CHECK (DRAFT, SUBMITTED, APPROVED)"
        uuid performed_by FK
        timestamptz performed_at
        text notes
        timestamptz created_at
    }

    inspection_items {
        uuid id PK
        uuid inspection_id FK
        uuid template_item_id FK
        text item_key
        smallint score "CHECK (0..5)"
        text text_value
    }

    inspection_evidence {
        uuid id PK
        uuid asset_id FK
        uuid inspection_id FK
        text object_key UK
        char sha256_hash "CHECK (regex 64 hex)"
        text mime_type
        bigint size_bytes "CHECK (> 0)"
        timestamptz captured_at
        uuid uploaded_by FK
        timestamptz created_at
    }

    condition_snapshots {
        uuid id PK
        uuid asset_id FK
        uuid inspection_id UK,FK
        numeric overall_score "CHECK (0..100)"
        jsonb item_values
        timestamptz created_at
    }

    condition_deltas {
        uuid id PK
        uuid booking_id UK,FK
        uuid baseline_snapshot_id FK
        uuid return_snapshot_id FK
        numeric weighted_delta "CHECK (>= 0)"
        numeric threshold
        text outcome "CHECK (NORMAL, DISPUTE_REVIEW_REQUIRED)"
        text calc_version
        jsonb inputs
        timestamptz created_at
    }

    handover_records {
        uuid id PK
        uuid booking_id FK
        text direction "CHECK (PICKUP, RETURN)"
        timestamptz owner_confirmed_at
        timestamptz renter_confirmed_at
        timestamptz manifest_confirmed_at
        text otp_hash
        timestamptz otp_expires_at
        smallint otp_attempts "CHECK (0..5)"
        timestamptz verified_at
        timestamptz created_at
    }

    custody_events {
        bigserial id PK
        uuid asset_id FK
        uuid booking_id FK
        uuid from_user_id FK
        uuid to_user_id FK
        text event_type
        timestamptz created_at
    }
```

---

## 3. Domain: Ledger, Disputes, Trust Scores, and Audit

```mermaid
erDiagram
    users ||--o{ ledger_accounts : "holds account"
    bookings ||--o{ ledger_transactions : "linked to"
    ledger_transactions ||--o{ ledger_entries : "balanced lines"
    ledger_accounts ||--o{ ledger_entries : "debited/credited"

    bookings ||--o{ disputes : "contested via"
    users ||--o{ disputes : "opened by"
    users ||--o{ disputes : "resolved by"
    disputes ||--o{ dispute_events : "history logs"

    bookings ||--o{ reviews : "reviewed for"
    users ||--o{ reviews : "reviewer"
    users ||--o{ reviews : "reviewee"

    users ||--o{ trust_scores : "scored"
    users ||--o{ notifications : "notified"
    users ||--o{ audit_logs : "actor"

    ledger_accounts {
        uuid id PK
        text code UK
        text type "CHECK (USER_DEPOSIT, ESCROW, PLATFORM_REVENUE, OWNER_PAYABLE, EXTERNAL)"
        uuid owner_user_id FK
        timestamptz created_at
    }

    ledger_transactions {
        uuid id PK
        uuid booking_id FK
        text kind "CHECK (DEPOSIT_HELD, DEPOSIT_RELEASED, ...)"
        text idempotency_key UK
        text description
        timestamptz created_at
    }

    ledger_entries {
        bigserial id PK
        uuid transaction_id FK
        uuid account_id FK
        text direction "CHECK (DEBIT, CREDIT)"
        numeric amount "CHECK (> 0)"
        timestamptz created_at
    }

    disputes {
        uuid id PK
        uuid booking_id FK
        uuid opened_by FK
        text reason
        text status "CHECK (OPEN, UNDER_REVIEW, RESOLVED)"
        text resolution "CHECK (RENTER_FAULT, OWNER_FAULT, SPLIT, NO_FAULT)"
        uuid resolved_by FK
        timestamptz opened_at
        timestamptz resolved_at
    }

    dispute_events {
        bigserial id PK
        uuid dispute_id FK
        text event_type
        uuid actor_id FK
        text notes
        uuid evidence_id FK
        timestamptz created_at
    }

    maintenance_records {
        uuid id PK
        uuid asset_id FK
        text type "CHECK (ROUTINE, INSPECTION_DRIVEN)"
        text description
        date performed_on
        date next_due_on
        numeric cost "CHECK (>= 0)"
        uuid verified_by FK
        timestamptz created_at
    }

    repair_records {
        uuid id PK
        uuid asset_id FK
        uuid damage_report_id FK
        text description
        numeric cost "CHECK (>= 0)"
        date started_on
        date completed_on
    }

    damage_reports {
        uuid id PK
        uuid asset_id FK
        uuid booking_id FK
        uuid reported_by FK
        text description
        smallint severity "CHECK (1..5)"
        timestamptz created_at
    }

    trust_scores {
        uuid id PK
        uuid user_id FK
        text kind "CHECK (OWNER, RENTER)"
        numeric score "CHECK (0..100)"
        jsonb factors
        text calc_version
        timestamptz computed_at
    }

    asset_health_scores {
        uuid id PK
        uuid asset_id FK
        numeric score "CHECK (0..100)"
        jsonb inputs
        text calc_version
        timestamptz computed_at
    }

    reviews {
        uuid id PK
        uuid booking_id FK
        uuid reviewer_id FK
        uuid reviewee_id FK
        smallint rating "CHECK (1..5)"
        text comment
    }

    notifications {
        uuid id PK
        uuid user_id FK
        text type
        jsonb payload
        timestamptz read_at
        timestamptz created_at
    }

    audit_logs {
        bigserial id PK
        uuid actor_id
        text action
        text entity_type
        text entity_id
        text request_id
        jsonb before_state
        jsonb after_state
        jsonb metadata
        timestamptz created_at
    }

    outbox_events {
        bigserial id PK
        text aggregate_type
        text aggregate_id
        text event_type
        jsonb payload
        timestamptz created_at
        timestamptz processed_at
        int attempts
    }

    idempotency_keys {
        uuid id PK
        uuid user_id FK
        text key
        text endpoint
        text request_hash
        int response_status
        jsonb response_body
        timestamptz created_at
    }
```
