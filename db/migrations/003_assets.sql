BEGIN;

-- Asset categories
CREATE TABLE asset_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    name text NOT NULL,
    condition_threshold numeric(6,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_asset_categories_condition_threshold CHECK (condition_threshold >= 0)
);
COMMENT ON TABLE asset_categories IS 'Rental asset taxonomy with automatic settlement condition thresholds';

-- Category dynamic specification fields
CREATE TABLE asset_category_fields (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid NOT NULL,
    field_key text NOT NULL,
    label text NOT NULL,
    data_type text NOT NULL,
    is_required boolean NOT NULL DEFAULT false,
    allowed_values jsonb,
    CONSTRAINT uq_asset_category_fields_cat_key UNIQUE (category_id, field_key),
    CONSTRAINT fk_asset_category_fields_category FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE CASCADE,
    CONSTRAINT chk_asset_category_fields_data_type CHECK (data_type IN ('text', 'number', 'boolean', 'enum'))
);
CREATE INDEX idx_asset_category_fields_category_id ON asset_category_fields(category_id);
COMMENT ON TABLE asset_category_fields IS 'Dynamic category attribute definitions for flexible asset specifications';

-- Assets table
CREATE TABLE assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    manufacturer text,
    model text,
    serial_number text,
    acquisition_date date,
    lifecycle_state text NOT NULL DEFAULT 'LISTED',
    condition_score numeric(5,2),
    health_score numeric(5,2),
    reliability_score numeric(5,2),
    attributes jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_assets_category FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE RESTRICT,
    CONSTRAINT fk_assets_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_assets_lifecycle_state CHECK (
        lifecycle_state IN (
            'LISTED', 'VERIFIED', 'AVAILABLE', 'RESERVED',
            'INSPECTION_PENDING', 'ACTIVE_CUSTODY', 'RETURN_INSPECTION',
            'SETTLED', 'DISPUTED', 'MAINTENANCE', 'REPAIR', 'SOLD'
        )
    ),
    CONSTRAINT chk_assets_condition_score CHECK (condition_score IS NULL OR (condition_score >= 0 AND condition_score <= 100)),
    CONSTRAINT chk_assets_health_score CHECK (health_score IS NULL OR (health_score >= 0 AND health_score <= 100)),
    CONSTRAINT chk_assets_reliability_score CHECK (reliability_score IS NULL OR (reliability_score >= 0 AND reliability_score <= 100))
);
CREATE INDEX idx_assets_category_id ON assets(category_id);
CREATE INDEX idx_assets_owner_id ON assets(owner_id);
CREATE UNIQUE INDEX uq_assets_category_serial ON assets(category_id, serial_number) WHERE serial_number IS NOT NULL;
COMMENT ON TABLE assets IS 'Physical rental assets with passport lifecycle states, scores, and attributes';

-- Verified asset specifications
CREATE TABLE asset_specifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id uuid NOT NULL,
    spec_key text NOT NULL,
    spec_value text NOT NULL,
    verified_by uuid,
    verified_at timestamptz,
    CONSTRAINT uq_asset_specifications_asset_spec UNIQUE (asset_id, spec_key),
    CONSTRAINT fk_asset_specifications_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    CONSTRAINT fk_asset_specifications_verifier FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_asset_specifications_asset_id ON asset_specifications(asset_id);
CREATE INDEX idx_asset_specifications_verified_by ON asset_specifications(verified_by);
COMMENT ON TABLE asset_specifications IS 'Verified technical specifications for assets validated by inspectors';

-- Asset temporal ownership history (one owner at any time)
CREATE TABLE asset_ownership (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    owned_during tstzrange NOT NULL,
    reason text NOT NULL,
    CONSTRAINT fk_asset_ownership_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    CONSTRAINT fk_asset_ownership_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_asset_ownership_reason CHECK (reason IN ('REGISTERED', 'SOLD')),
    CONSTRAINT no_overlapping_asset_ownership EXCLUDE USING gist (
        asset_id WITH =,
        owned_during WITH &&
    )
);
CREATE INDEX idx_asset_ownership_owner_id ON asset_ownership(owner_id);
COMMENT ON TABLE asset_ownership IS 'Temporal asset ownership registry with GiST exclusion constraint';

-- Asset locations
CREATE TABLE asset_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id uuid NOT NULL,
    city text NOT NULL,
    area text,
    latitude numeric(9,6),
    longitude numeric(9,6),
    is_current boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_asset_locations_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
CREATE INDEX idx_asset_locations_asset_id ON asset_locations(asset_id);
CREATE UNIQUE INDEX uq_asset_locations_current ON asset_locations(asset_id) WHERE is_current = true;
COMMENT ON TABLE asset_locations IS 'Geographical coordinate history for physical assets with single current location';

-- Asset timeline events (append-only)
CREATE TABLE asset_events (
    id bigserial PRIMARY KEY,
    asset_id uuid NOT NULL,
    event_type text NOT NULL,
    actor_id uuid,
    metadata jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_asset_events_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    CONSTRAINT fk_asset_events_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_asset_events_asset_created ON asset_events(asset_id, created_at);
CREATE INDEX idx_asset_events_actor_id ON asset_events(actor_id);
COMMENT ON TABLE asset_events IS 'Append-only chronological timeline of asset lifecycle events';

COMMIT;
