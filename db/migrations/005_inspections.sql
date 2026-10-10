BEGIN;

-- Inspection templates
CREATE TABLE inspection_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid NOT NULL,
    name text NOT NULL,
    version integer NOT NULL DEFAULT 1,
    is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT uq_inspection_templates_cat_version UNIQUE (category_id, version),
    CONSTRAINT fk_inspection_templates_category FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE CASCADE
);
CREATE INDEX idx_inspection_templates_category_id ON inspection_templates(category_id);
COMMENT ON TABLE inspection_templates IS 'Versioned category inspection frameworks defining standardized manifest items';

-- Inspection template items (8-point checklist)
CREATE TABLE inspection_template_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL,
    point_no smallint NOT NULL,
    item_key text NOT NULL,
    label text NOT NULL,
    is_measurable boolean NOT NULL,
    weight numeric(5,4) NOT NULL DEFAULT 0,
    max_score smallint NOT NULL DEFAULT 5,
    CONSTRAINT uq_inspection_template_items_tmpl_key UNIQUE (template_id, item_key),
    CONSTRAINT fk_inspection_template_items_template FOREIGN KEY (template_id) REFERENCES inspection_templates(id) ON DELETE CASCADE,
    CONSTRAINT chk_inspection_template_items_point_no CHECK (point_no BETWEEN 1 AND 8),
    CONSTRAINT chk_inspection_template_items_weight CHECK (weight >= 0)
);
CREATE INDEX idx_inspection_template_items_template_id ON inspection_template_items(template_id);
COMMENT ON TABLE inspection_template_items IS 'Individual checkpoints of the 8-point inspection manifest with weights and metrics';

-- Inspections records
CREATE TABLE inspections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id uuid NOT NULL,
    booking_id uuid,
    template_id uuid NOT NULL,
    type text NOT NULL,
    status text NOT NULL DEFAULT 'DRAFT',
    performed_by uuid,
    performed_at timestamptz,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_inspections_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    CONSTRAINT fk_inspections_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
    CONSTRAINT fk_inspections_template FOREIGN KEY (template_id) REFERENCES inspection_templates(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inspections_performer FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_inspections_type CHECK (type IN ('VERIFICATION', 'BASELINE', 'RETURN')),
    CONSTRAINT chk_inspections_status CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED'))
);
CREATE INDEX idx_inspections_asset_id ON inspections(asset_id);
CREATE INDEX idx_inspections_booking_id ON inspections(booking_id);
CREATE INDEX idx_inspections_template_id ON inspections(template_id);
CREATE INDEX idx_inspections_performed_by ON inspections(performed_by);
COMMENT ON TABLE inspections IS 'Verification, baseline pre-rental, and return physical inspection records';

-- Inspection checklist items
CREATE TABLE inspection_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id uuid NOT NULL,
    template_item_id uuid NOT NULL,
    item_key text NOT NULL,
    score smallint,
    text_value text,
    CONSTRAINT uq_inspection_items_insp_key UNIQUE (inspection_id, item_key),
    CONSTRAINT fk_inspection_items_inspection FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
    CONSTRAINT fk_inspection_items_template_item FOREIGN KEY (template_item_id) REFERENCES inspection_template_items(id) ON DELETE RESTRICT,
    CONSTRAINT chk_inspection_items_score CHECK (score IS NULL OR (score >= 0 AND score <= 5))
);
CREATE INDEX idx_inspection_items_inspection_id ON inspection_items(inspection_id);
CREATE INDEX idx_inspection_items_template_item_id ON inspection_items(template_item_id);
COMMENT ON TABLE inspection_items IS 'Scored checklist entries and textual evaluations for an inspection';

-- Photographic evidence with cryptographic hashes
CREATE TABLE inspection_evidence (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id uuid NOT NULL,
    inspection_id uuid NOT NULL,
    object_key text UNIQUE NOT NULL,
    sha256_hash char(64) NOT NULL,
    mime_type text NOT NULL,
    size_bytes bigint NOT NULL,
    captured_at timestamptz,
    uploaded_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_inspection_evidence_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    CONSTRAINT fk_inspection_evidence_inspection FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
    CONSTRAINT fk_inspection_evidence_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_inspection_evidence_sha256 CHECK (sha256_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT chk_inspection_evidence_size CHECK (size_bytes > 0)
);
CREATE INDEX idx_inspection_evidence_asset_id ON inspection_evidence(asset_id);
CREATE INDEX idx_inspection_evidence_uploaded_by ON inspection_evidence(uploaded_by);
COMMENT ON TABLE inspection_evidence IS 'Cryptographically bound photo and file evidence with SHA-256 integrity checks';

-- Condition snapshots
CREATE TABLE condition_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id uuid NOT NULL,
    inspection_id uuid UNIQUE NOT NULL,
    overall_score numeric(5,2),
    item_values jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_condition_snapshots_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    CONSTRAINT fk_condition_snapshots_inspection FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
    CONSTRAINT chk_condition_snapshots_score CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100))
);
CREATE INDEX idx_condition_snapshots_asset_id ON condition_snapshots(asset_id);
COMMENT ON TABLE condition_snapshots IS 'Computed condition ratings snapshot derived from an approved inspection';

-- Condition deltas (append-only)
CREATE TABLE condition_deltas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid UNIQUE NOT NULL,
    baseline_snapshot_id uuid NOT NULL,
    return_snapshot_id uuid NOT NULL,
    weighted_delta numeric(8,4) NOT NULL,
    threshold numeric(6,2) NOT NULL,
    outcome text NOT NULL,
    calc_version text NOT NULL,
    inputs jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_condition_deltas_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_condition_deltas_baseline FOREIGN KEY (baseline_snapshot_id) REFERENCES condition_snapshots(id) ON DELETE RESTRICT,
    CONSTRAINT fk_condition_deltas_return FOREIGN KEY (return_snapshot_id) REFERENCES condition_snapshots(id) ON DELETE RESTRICT,
    CONSTRAINT chk_condition_deltas_weighted_delta CHECK (weighted_delta >= 0),
    CONSTRAINT chk_condition_deltas_outcome CHECK (outcome IN ('NORMAL', 'DISPUTE_REVIEW_REQUIRED'))
);
CREATE INDEX idx_condition_deltas_baseline_id ON condition_deltas(baseline_snapshot_id);
CREATE INDEX idx_condition_deltas_return_id ON condition_deltas(return_snapshot_id);
COMMENT ON TABLE condition_deltas IS 'Append-only mathematical comparison between baseline and return condition snapshots';

COMMIT;
