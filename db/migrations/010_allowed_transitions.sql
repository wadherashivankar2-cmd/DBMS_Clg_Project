BEGIN;

-- Allowed entity transitions registry
CREATE TABLE allowed_transitions (
    entity_type text NOT NULL,
    from_state text NOT NULL,
    to_state text NOT NULL,
    PRIMARY KEY (entity_type, from_state, to_state)
);
COMMENT ON TABLE allowed_transitions IS 'Authoritative state transition matrix enforcing domain lifecycle state machines';

-- Populate Asset lifecycle transitions
INSERT INTO allowed_transitions (entity_type, from_state, to_state) VALUES
('ASSET', 'LISTED', 'VERIFIED'),
('ASSET', 'VERIFIED', 'AVAILABLE'),
('ASSET', 'AVAILABLE', 'RESERVED'),
('ASSET', 'AVAILABLE', 'MAINTENANCE'),
('ASSET', 'AVAILABLE', 'SOLD'),
('ASSET', 'RESERVED', 'INSPECTION_PENDING'),
('ASSET', 'RESERVED', 'AVAILABLE'),
('ASSET', 'INSPECTION_PENDING', 'ACTIVE_CUSTODY'),
('ASSET', 'INSPECTION_PENDING', 'AVAILABLE'),
('ASSET', 'ACTIVE_CUSTODY', 'RETURN_INSPECTION'),
('ASSET', 'RETURN_INSPECTION', 'SETTLED'),
('ASSET', 'RETURN_INSPECTION', 'DISPUTED'),
('ASSET', 'SETTLED', 'AVAILABLE'),
('ASSET', 'SETTLED', 'SOLD'),
('ASSET', 'DISPUTED', 'REPAIR'),
('ASSET', 'DISPUTED', 'AVAILABLE'),
('ASSET', 'MAINTENANCE', 'AVAILABLE'),
('ASSET', 'REPAIR', 'AVAILABLE');

-- Populate Booking lifecycle transitions
INSERT INTO allowed_transitions (entity_type, from_state, to_state) VALUES
('BOOKING', 'RESERVED', 'INSPECTION_PENDING'),
('BOOKING', 'RESERVED', 'CANCELLED'),
('BOOKING', 'RESERVED', 'EXPIRED'),
('BOOKING', 'INSPECTION_PENDING', 'ACTIVE_CUSTODY'),
('BOOKING', 'INSPECTION_PENDING', 'CANCELLED'),
('BOOKING', 'ACTIVE_CUSTODY', 'RETURN_INSPECTION'),
('BOOKING', 'RETURN_INSPECTION', 'SETTLED'),
('BOOKING', 'RETURN_INSPECTION', 'DISPUTED'),
('BOOKING', 'DISPUTED', 'SETTLED');

-- Populate Inspection transitions
INSERT INTO allowed_transitions (entity_type, from_state, to_state) VALUES
('INSPECTION', 'DRAFT', 'SUBMITTED'),
('INSPECTION', 'SUBMITTED', 'APPROVED'),
('INSPECTION', 'SUBMITTED', 'DRAFT');

-- Populate Dispute transitions
INSERT INTO allowed_transitions (entity_type, from_state, to_state) VALUES
('DISPUTE', 'OPEN', 'UNDER_REVIEW'),
('DISPUTE', 'UNDER_REVIEW', 'RESOLVED');

-- Populate Deposit (ledger view) transitions
INSERT INTO allowed_transitions (entity_type, from_state, to_state) VALUES
('DEPOSIT', 'DEPOSIT_HELD', 'DEPOSIT_RELEASED'),
('DEPOSIT', 'DEPOSIT_HELD', 'DEPOSIT_PARTIALLY_DEDUCTED'),
('DEPOSIT', 'DEPOSIT_HELD', 'DEPOSIT_FROZEN'),
('DEPOSIT', 'DEPOSIT_FROZEN', 'DEPOSIT_RELEASED'),
('DEPOSIT', 'DEPOSIT_FROZEN', 'DEPOSIT_PARTIALLY_DEDUCTED');

-- Helper function to check if a transition is permitted
CREATE OR REPLACE FUNCTION is_transition_allowed(
    p_entity_type text,
    p_from_state text,
    p_to_state text
)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM allowed_transitions
        WHERE entity_type = p_entity_type
          AND from_state = p_from_state
          AND to_state = p_to_state
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;
