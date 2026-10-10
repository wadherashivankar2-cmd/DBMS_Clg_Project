BEGIN;

-- Listings table
CREATE TABLE listings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'DRAFT',
    daily_price numeric(14,2) NOT NULL,
    deposit_amount numeric(14,2) NOT NULL,
    buyout_available boolean NOT NULL DEFAULT false,
    buyout_price numeric(14,2),
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_listings_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    CONSTRAINT fk_listings_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_listings_status CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED')),
    CONSTRAINT chk_listings_daily_price CHECK (daily_price >= 0),
    CONSTRAINT chk_listings_deposit_amount CHECK (deposit_amount >= 0),
    CONSTRAINT chk_listings_buyout_terms CHECK (buyout_available = false OR (buyout_price IS NOT NULL AND buyout_price > 0))
);
CREATE INDEX idx_listings_asset_id ON listings(asset_id);
CREATE INDEX idx_listings_created_by ON listings(created_by);
COMMENT ON TABLE listings IS 'Rental marketplace offers with pricing, deposit, and optional buyout terms';

-- Pricing rules table
CREATE TABLE pricing_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id uuid NOT NULL,
    rule_type text NOT NULL,
    min_days integer NOT NULL,
    percent_adjustment numeric(5,2) NOT NULL,
    CONSTRAINT fk_pricing_rules_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
    CONSTRAINT chk_pricing_rules_type CHECK (rule_type IN ('LONG_TERM_DISCOUNT', 'WEEKEND_SURCHARGE')),
    CONSTRAINT chk_pricing_rules_min_days CHECK (min_days >= 1)
);
CREATE INDEX idx_pricing_rules_listing_id ON pricing_rules(listing_id);
COMMENT ON TABLE pricing_rules IS 'Duration and calendar-based dynamic pricing adjustment rules';

-- Bookings table with GiST exclusion constraint for double booking prevention
CREATE TABLE bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    renter_id uuid NOT NULL,
    booking_window tstzrange NOT NULL,
    lifecycle_state text NOT NULL DEFAULT 'RESERVED',
    total_price numeric(14,2) NOT NULL,
    deposit_amount numeric(14,2) NOT NULL,
    idempotency_key text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_bookings_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_renter FOREIGN KEY (renter_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_bookings_lifecycle_state CHECK (
        lifecycle_state IN (
            'RESERVED', 'INSPECTION_PENDING', 'ACTIVE_CUSTODY',
            'RETURN_INSPECTION', 'SETTLED', 'DISPUTED', 'CANCELLED', 'EXPIRED'
        )
    ),
    CONSTRAINT chk_bookings_total_price CHECK (total_price >= 0),
    CONSTRAINT chk_bookings_deposit_amount CHECK (deposit_amount >= 0),
    CONSTRAINT chk_bookings_window_valid CHECK (NOT isempty(booking_window) AND upper(booking_window) > lower(booking_window)),
    CONSTRAINT no_overlapping_rentals EXCLUDE USING gist (
        asset_id WITH =,
        booking_window WITH &&
    ) WHERE (lifecycle_state IN ('RESERVED', 'INSPECTION_PENDING', 'ACTIVE_CUSTODY'))
);
CREATE INDEX idx_bookings_asset_lifecycle ON bookings(asset_id, lifecycle_state);
CREATE INDEX idx_bookings_listing_id ON bookings(listing_id);
CREATE INDEX idx_bookings_renter_id ON bookings(renter_id);
CREATE UNIQUE INDEX uq_bookings_renter_idempotency ON bookings(renter_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
COMMENT ON TABLE bookings IS 'Rental reservation contracts with PostgreSQL GiST exclusion anti-overlap constraint';

-- Booking events timeline (append-only)
CREATE TABLE booking_events (
    id bigserial PRIMARY KEY,
    booking_id uuid NOT NULL,
    event_type text NOT NULL,
    from_state text,
    to_state text,
    actor_id uuid,
    metadata jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_booking_events_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_events_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_booking_events_booking_id ON booking_events(booking_id);
CREATE INDEX idx_booking_events_actor_id ON booking_events(actor_id);
COMMENT ON TABLE booking_events IS 'Append-only chronological state transition events for bookings';

-- Idempotency keys registry
CREATE TABLE idempotency_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    key text NOT NULL,
    endpoint text NOT NULL,
    request_hash text,
    response_status integer,
    response_body jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_idempotency_keys_user_key_endpoint UNIQUE (user_id, key, endpoint),
    CONSTRAINT fk_idempotency_keys_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_idempotency_keys_user_id ON idempotency_keys(user_id);
COMMENT ON TABLE idempotency_keys IS 'API idempotency key journal preventing duplicate financial and booking operations';

COMMIT;
