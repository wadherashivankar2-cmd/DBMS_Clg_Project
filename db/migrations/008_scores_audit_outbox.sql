BEGIN;

-- Trust scores table
CREATE TABLE trust_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    kind text NOT NULL,
    score numeric(5,2) NOT NULL,
    factors jsonb NOT NULL,
    calc_version text NOT NULL,
    computed_at timestamptz NOT NULL,
    CONSTRAINT fk_trust_scores_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_trust_scores_kind CHECK (kind IN ('OWNER', 'RENTER')),
    CONSTRAINT chk_trust_scores_score CHECK (score >= 0 AND score <= 100)
);
CREATE INDEX idx_trust_scores_user_id ON trust_scores(user_id);
COMMENT ON TABLE trust_scores IS 'Explainable reputation scores for owners and renters with breakdown factors';

-- Asset health scores
CREATE TABLE asset_health_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id uuid NOT NULL,
    score numeric(5,2) NOT NULL,
    inputs jsonb NOT NULL,
    calc_version text NOT NULL,
    computed_at timestamptz NOT NULL,
    CONSTRAINT fk_asset_health_scores_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    CONSTRAINT chk_asset_health_scores_score CHECK (score >= 0 AND score <= 100)
);
CREATE INDEX idx_asset_health_scores_asset_id ON asset_health_scores(asset_id);
COMMENT ON TABLE asset_health_scores IS 'Composite health scores derived from maintenance, condition deltas, and usage history';

-- Reviews table
CREATE TABLE reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL,
    reviewer_id uuid NOT NULL,
    reviewee_id uuid NOT NULL,
    rating smallint NOT NULL,
    comment text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_reviews_booking_reviewer UNIQUE (booking_id, reviewer_id),
    CONSTRAINT fk_reviews_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_reviewee FOREIGN KEY (reviewee_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5)
);
CREATE INDEX idx_reviews_booking_id ON reviews(booking_id);
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_reviewee_id ON reviews(reviewee_id);
COMMENT ON TABLE reviews IS 'Two-way peer reviews and ratings between renter and owner post-settlement';

-- Notifications table
CREATE TABLE notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    type text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}',
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
COMMENT ON TABLE notifications IS 'User notification delivery inbox for system events and reminders';

-- Immutable audit logs
CREATE TABLE audit_logs (
    id bigserial PRIMARY KEY,
    actor_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    request_id text,
    before_state jsonb,
    after_state jsonb,
    metadata jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
COMMENT ON TABLE audit_logs IS 'Append-only immutable audit log tracking administrative and lifecycle actions with before/after state diffs';

-- Outbox events for reliable asynchronous messaging
CREATE TABLE outbox_events (
    id bigserial PRIMARY KEY,
    aggregate_type text NOT NULL,
    aggregate_id text NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    attempts integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_outbox_events_unprocessed ON outbox_events(id) WHERE processed_at IS NULL;
COMMENT ON TABLE outbox_events IS 'Transactional outbox event buffer for guaranteed asynchronous delivery';

COMMIT;
