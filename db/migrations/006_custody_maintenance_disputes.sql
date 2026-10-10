BEGIN;

-- Handover records (mutual confirmation and OTP)
CREATE TABLE handover_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL,
    direction text NOT NULL,
    owner_confirmed_at timestamptz,
    renter_confirmed_at timestamptz,
    manifest_confirmed_at timestamptz,
    otp_hash text,
    otp_expires_at timestamptz,
    otp_attempts smallint NOT NULL DEFAULT 0,
    verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_handover_records_booking_direction UNIQUE (booking_id, direction),
    CONSTRAINT fk_handover_records_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT chk_handover_records_direction CHECK (direction IN ('PICKUP', 'RETURN')),
    CONSTRAINT chk_handover_records_otp_attempts CHECK (otp_attempts BETWEEN 0 AND 5)
);
CREATE INDEX idx_handover_records_booking_id ON handover_records(booking_id);
COMMENT ON TABLE handover_records IS 'Mutual handover protocol state with hashed OTP challenge and confirmation timestamps';

-- Custody events log (append-only)
CREATE TABLE custody_events (
    id bigserial PRIMARY KEY,
    asset_id uuid NOT NULL,
    booking_id uuid,
    from_user_id uuid,
    to_user_id uuid,
    event_type text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_custody_events_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    CONSTRAINT fk_custody_events_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
    CONSTRAINT fk_custody_events_from_user FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_custody_events_to_user FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_custody_events_asset_id ON custody_events(asset_id);
CREATE INDEX idx_custody_events_booking_id ON custody_events(booking_id);
CREATE INDEX idx_custody_events_from_user ON custody_events(from_user_id);
CREATE INDEX idx_custody_events_to_user ON custody_events(to_user_id);
COMMENT ON TABLE custody_events IS 'Append-only audit trail of physical asset custody transfers';

-- Maintenance records
CREATE TABLE maintenance_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id uuid NOT NULL,
    type text NOT NULL,
    description text,
    performed_on date NOT NULL,
    next_due_on date,
    cost numeric(14,2) NOT NULL DEFAULT 0,
    verified_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_maintenance_records_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    CONSTRAINT fk_maintenance_records_verifier FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_maintenance_records_type CHECK (type IN ('ROUTINE', 'INSPECTION_DRIVEN')),
    CONSTRAINT chk_maintenance_records_cost CHECK (cost >= 0)
);
CREATE INDEX idx_maintenance_records_asset_id ON maintenance_records(asset_id);
CREATE INDEX idx_maintenance_records_verified_by ON maintenance_records(verified_by);
COMMENT ON TABLE maintenance_records IS 'Routine and inspection-driven servicing history for assets';

-- Damage reports
CREATE TABLE damage_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id uuid NOT NULL,
    booking_id uuid,
    reported_by uuid NOT NULL,
    description text NOT NULL,
    severity smallint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_damage_reports_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    CONSTRAINT fk_damage_reports_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
    CONSTRAINT fk_damage_reports_reporter FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_damage_reports_severity CHECK (severity BETWEEN 1 AND 5)
);
CREATE INDEX idx_damage_reports_asset_id ON damage_reports(asset_id);
CREATE INDEX idx_damage_reports_booking_id ON damage_reports(booking_id);
CREATE INDEX idx_damage_reports_reported_by ON damage_reports(reported_by);
COMMENT ON TABLE damage_reports IS 'Damage incident reports filed during custody or return inspection';

-- Repair records
CREATE TABLE repair_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id uuid NOT NULL,
    damage_report_id uuid,
    description text,
    cost numeric(14,2) NOT NULL DEFAULT 0,
    started_on date NOT NULL,
    completed_on date,
    CONSTRAINT fk_repair_records_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    CONSTRAINT fk_repair_records_damage_report FOREIGN KEY (damage_report_id) REFERENCES damage_reports(id) ON DELETE SET NULL,
    CONSTRAINT chk_repair_records_cost CHECK (cost >= 0),
    CONSTRAINT chk_repair_records_dates CHECK (completed_on IS NULL OR completed_on >= started_on)
);
CREATE INDEX idx_repair_records_asset_id ON repair_records(asset_id);
CREATE INDEX idx_repair_records_damage_report_id ON repair_records(damage_report_id);
COMMENT ON TABLE repair_records IS 'Corrective repair interventions and associated costs linked to damage reports';

-- Disputes table
CREATE TABLE disputes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL,
    opened_by uuid NOT NULL,
    reason text NOT NULL,
    status text NOT NULL DEFAULT 'OPEN',
    resolution text,
    resolved_by uuid,
    opened_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    CONSTRAINT fk_disputes_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_disputes_opener FOREIGN KEY (opened_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_disputes_resolver FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_disputes_status CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED')),
    CONSTRAINT chk_disputes_resolution CHECK (resolution IS NULL OR resolution IN ('RENTER_FAULT', 'OWNER_FAULT', 'SPLIT', 'NO_FAULT')),
    CONSTRAINT chk_disputes_resolution_consistency CHECK ((status = 'RESOLVED') = (resolution IS NOT NULL))
);
CREATE INDEX idx_disputes_booking_id ON disputes(booking_id);
CREATE INDEX idx_disputes_opened_by ON disputes(opened_by);
CREATE INDEX idx_disputes_resolved_by ON disputes(resolved_by);
CREATE UNIQUE INDEX uq_disputes_active_per_booking ON disputes(booking_id) WHERE status <> 'RESOLVED';
COMMENT ON TABLE disputes IS 'Formal dispute claims with administrative resolution and status invariants';

-- Dispute events timeline (append-only)
CREATE TABLE dispute_events (
    id bigserial PRIMARY KEY,
    dispute_id uuid NOT NULL,
    event_type text NOT NULL,
    actor_id uuid,
    notes text,
    evidence_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_dispute_events_dispute FOREIGN KEY (dispute_id) REFERENCES disputes(id) ON DELETE CASCADE,
    CONSTRAINT fk_dispute_events_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_dispute_events_dispute_id ON dispute_events(dispute_id);
CREATE INDEX idx_dispute_events_actor_id ON dispute_events(actor_id);
CREATE INDEX idx_dispute_events_evidence_id ON dispute_events(evidence_id);
COMMENT ON TABLE dispute_events IS 'Append-only chronological audit trail of dispute handling events';

COMMIT;
