BEGIN;

-- Ledger accounts table
CREATE TABLE ledger_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    type text NOT NULL,
    owner_user_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_ledger_accounts_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_ledger_accounts_type CHECK (type IN ('USER_DEPOSIT', 'ESCROW', 'PLATFORM_REVENUE', 'OWNER_PAYABLE', 'EXTERNAL'))
);
CREATE INDEX idx_ledger_accounts_owner_user ON ledger_accounts(owner_user_id);
COMMENT ON TABLE ledger_accounts IS 'Double-entry general ledger accounts for user deposits, escrow, platform fees, and settlements';

-- Ledger transactions (append-only)
CREATE TABLE ledger_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid,
    kind text NOT NULL,
    idempotency_key text UNIQUE,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_ledger_transactions_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
    CONSTRAINT chk_ledger_transactions_kind CHECK (
        kind IN (
            'DEPOSIT_HELD', 'DEPOSIT_RELEASED', 'DEPOSIT_PARTIALLY_DEDUCTED',
            'DEPOSIT_FROZEN', 'RENTAL_PAYMENT', 'PLATFORM_FEE',
            'OWNER_SETTLEMENT', 'REFUND'
        )
    )
);
CREATE INDEX idx_ledger_transactions_booking_id ON ledger_transactions(booking_id);
COMMENT ON TABLE ledger_transactions IS 'Append-only ledger journal header linking related debit/credit entries to a transaction';

-- Ledger entries (append-only)
CREATE TABLE ledger_entries (
    id bigserial PRIMARY KEY,
    transaction_id uuid NOT NULL,
    account_id uuid NOT NULL,
    direction text NOT NULL,
    amount numeric(14,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_ledger_entries_transaction FOREIGN KEY (transaction_id) REFERENCES ledger_transactions(id) ON DELETE CASCADE,
    CONSTRAINT fk_ledger_entries_account FOREIGN KEY (account_id) REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
    CONSTRAINT chk_ledger_entries_direction CHECK (direction IN ('DEBIT', 'CREDIT')),
    CONSTRAINT chk_ledger_entries_amount CHECK (amount > 0)
);
CREATE INDEX idx_ledger_entries_transaction_id ON ledger_entries(transaction_id);
CREATE INDEX idx_ledger_entries_account_id ON ledger_entries(account_id);
COMMENT ON TABLE ledger_entries IS 'Append-only individual balanced debit/credit posting lines in double-entry ledger';

-- Balance verification function for deferrable constraint trigger
CREATE OR REPLACE FUNCTION check_ledger_transaction_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_debit_total numeric(14,2);
    v_credit_total numeric(14,2);
    v_tx_id uuid;
BEGIN
    v_tx_id := NEW.transaction_id;

    SELECT
        COALESCE(SUM(amount) FILTER (WHERE direction = 'DEBIT'), 0),
        COALESCE(SUM(amount) FILTER (WHERE direction = 'CREDIT'), 0)
    INTO v_debit_total, v_credit_total
    FROM ledger_entries
    WHERE transaction_id = v_tx_id;

    IF v_debit_total <> v_credit_total THEN
        RAISE EXCEPTION 'Ledger transaction % is unbalanced: debits (%) != credits (%)',
            v_tx_id, v_debit_total, v_credit_total;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Constraint trigger verifying debit == credit at end of transaction
CREATE CONSTRAINT TRIGGER trg_check_ledger_balance
AFTER INSERT ON ledger_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_ledger_transaction_balance();

COMMIT;
