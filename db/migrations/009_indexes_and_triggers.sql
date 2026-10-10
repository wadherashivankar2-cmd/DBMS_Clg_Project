BEGIN;

-- Attach set_updated_at BEFORE UPDATE trigger to mutable tables
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_assets_updated_at
BEFORE UPDATE ON assets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_listings_updated_at
BEFORE UPDATE ON listings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_bookings_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Attach prevent_mutation BEFORE UPDATE OR DELETE trigger to append-only tables
CREATE TRIGGER trg_audit_logs_prevent_mutation
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_mutation();

CREATE TRIGGER trg_booking_events_prevent_mutation
BEFORE UPDATE OR DELETE ON booking_events
FOR EACH ROW
EXECUTE FUNCTION prevent_mutation();

CREATE TRIGGER trg_asset_events_prevent_mutation
BEFORE UPDATE OR DELETE ON asset_events
FOR EACH ROW
EXECUTE FUNCTION prevent_mutation();

CREATE TRIGGER trg_custody_events_prevent_mutation
BEFORE UPDATE OR DELETE ON custody_events
FOR EACH ROW
EXECUTE FUNCTION prevent_mutation();

CREATE TRIGGER trg_dispute_events_prevent_mutation
BEFORE UPDATE OR DELETE ON dispute_events
FOR EACH ROW
EXECUTE FUNCTION prevent_mutation();

CREATE TRIGGER trg_ledger_transactions_prevent_mutation
BEFORE UPDATE OR DELETE ON ledger_transactions
FOR EACH ROW
EXECUTE FUNCTION prevent_mutation();

CREATE TRIGGER trg_ledger_entries_prevent_mutation
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION prevent_mutation();

CREATE TRIGGER trg_condition_deltas_prevent_mutation
BEFORE UPDATE OR DELETE ON condition_deltas
FOR EACH ROW
EXECUTE FUNCTION prevent_mutation();

-- Extra indexes with explanatory comments

-- Accelerates JSONB containment (@>) and key-existence queries for flexible asset attributes
CREATE INDEX idx_assets_attributes_gin ON assets USING gin (attributes);

-- Optimizes filtering available/listed assets within specific categories
CREATE INDEX idx_assets_category_lifecycle ON assets (category_id, lifecycle_state);

-- Fast lookup of active marketplace listings without scanning draft, paused, or closed rows
CREATE INDEX idx_listings_active ON listings (id) WHERE status = 'ACTIVE';

-- Accelerates retrieving a renter's chronological booking history ordered by recent activity
CREATE INDEX idx_bookings_renter_created ON bookings (renter_id, created_at DESC);

-- Optimizes dispute triage queue lookups filtered by current case status
CREATE INDEX idx_disputes_status ON disputes (status);

-- Speeds up retrieval of photographic and document evidence items for an inspection
CREATE INDEX idx_inspection_evidence_inspection ON inspection_evidence (inspection_id);

COMMIT;
