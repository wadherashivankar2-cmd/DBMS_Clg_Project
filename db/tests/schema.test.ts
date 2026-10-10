import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/app_db';

describe('PostgreSQL Schema & Invariant Tests', () => {
  let client: Client;
  let testAssetId: string;
  let testListingId: string;
  let testRenterId: string;
  let testOwnerId: string;
  let testCategoryId: string;

  before(async () => {
    client = new Client({ connectionString });
    await client.connect();

    // Cache seeded IDs for test runs
    const assetRes = await client.query('SELECT id, owner_id, category_id FROM assets WHERE lifecycle_state = \'AVAILABLE\' LIMIT 1');
    testAssetId = assetRes.rows[0].id;
    testOwnerId = assetRes.rows[0].owner_id;
    testCategoryId = assetRes.rows[0].category_id;

    const listingRes = await client.query('SELECT id FROM listings WHERE asset_id = $1 LIMIT 1', [testAssetId]);
    testListingId = listingRes.rows[0].id;

    const renterRes = await client.query('SELECT id FROM users WHERE email = \'renter1@platform.local\' LIMIT 1');
    testRenterId = renterRes.rows[0].id;
  });

  after(async () => {
    await client.end();
  });

  beforeEach(async () => {
    await client.query('BEGIN');
  });

  afterEach(async () => {
    await client.query('ROLLBACK');
  });

  test('1. Insert booking overlapping an existing RESERVED booking fails with exclusion violation (23P01)', async () => {
    await client.query(
      `INSERT INTO bookings (asset_id, listing_id, renter_id, booking_window, lifecycle_state, total_price, deposit_amount)
       VALUES ($1, $2, $3, tstzrange('2027-01-10 10:00:00+00', '2027-01-15 18:00:00+00', '[]'), 'RESERVED', 1000, 2000)`,
      [testAssetId, testListingId, testRenterId]
    );

    await assert.rejects(
      async () => {
        await client.query(
          `INSERT INTO bookings (asset_id, listing_id, renter_id, booking_window, lifecycle_state, total_price, deposit_amount)
           VALUES ($1, $2, $3, tstzrange('2027-01-12 10:00:00+00', '2027-01-17 18:00:00+00', '[]'), 'RESERVED', 1000, 2000)`,
          [testAssetId, testListingId, testRenterId]
        );
      },
      (err: any) => {
        assert.equal(err.code, '23P01'); // exclusion_violation
        return true;
      }
    );
  });

  test('2. Insert a booking overlapping a CANCELLED booking succeeds', async () => {
    await client.query(
      `INSERT INTO bookings (asset_id, listing_id, renter_id, booking_window, lifecycle_state, total_price, deposit_amount)
       VALUES ($1, $2, $3, tstzrange('2027-02-10 10:00:00+00', '2027-02-15 18:00:00+00', '[]'), 'CANCELLED', 1000, 2000)`,
      [testAssetId, testListingId, testRenterId]
    );

    const res = await client.query(
      `INSERT INTO bookings (asset_id, listing_id, renter_id, booking_window, lifecycle_state, total_price, deposit_amount)
       VALUES ($1, $2, $3, tstzrange('2027-02-12 10:00:00+00', '2027-02-17 18:00:00+00', '[]'), 'RESERVED', 1000, 2000)
       RETURNING id`,
      [testAssetId, testListingId, testRenterId]
    );

    assert.ok(res.rows[0].id);
  });

  test('3. Booking with upper <= lower window fails with check violation (23514)', async () => {
    // Both tstzrange constructor validation and CHECK constraint prevent inverted range
    await assert.rejects(
      async () => {
        await client.query(
          `INSERT INTO bookings (asset_id, listing_id, renter_id, booking_window, lifecycle_state, total_price, deposit_amount)
           VALUES ($1, $2, $3, tstzrange('2027-03-15 10:00:00+00', '2027-03-10 18:00:00+00', '[]'), 'RESERVED', 1000, 2000)`,
          [testAssetId, testListingId, testRenterId]
        );
      },
      (err: any) => {
        // PostgreSQL range constructor raises 22000 (data_exception: range lower bound must be less than or equal to range upper bound)
        // or 23514 if an empty/equal range violates chk_bookings_window_valid
        assert.ok(err.code === '22000' || err.code === '23514');
        return true;
      }
    );

    // Also verify upper == lower (empty/point window) directly triggers check violation 23514
    await client.query('ROLLBACK; BEGIN;');
    await assert.rejects(
      async () => {
        await client.query(
          `INSERT INTO bookings (asset_id, listing_id, renter_id, booking_window, lifecycle_state, total_price, deposit_amount)
           VALUES ($1, $2, $3, tstzrange('2027-03-10 10:00:00+00', '2027-03-10 10:00:00+00', '()'), 'RESERVED', 1000, 2000)`,
          [testAssetId, testListingId, testRenterId]
        );
      },
      (err: any) => {
        assert.equal(err.code, '23514'); // check_violation
        return true;
      }
    );
  });

  test('4. Negative daily_price or deposit_amount fails with check violation (23514)', async () => {
    // Negative daily_price on listing
    await assert.rejects(
      async () => {
        await client.query(
          `INSERT INTO listings (asset_id, title, status, daily_price, deposit_amount)
           VALUES ($1, 'Negative price listing', 'ACTIVE', -100, 500)`,
          [testAssetId]
        );
      },
      (err: any) => {
        assert.equal(err.code, '23514');
        return true;
      }
    );

    // Rollback error state before testing next check
    await client.query('ROLLBACK; BEGIN;');

    // Negative deposit_amount on booking
    await assert.rejects(
      async () => {
        await client.query(
          `INSERT INTO bookings (asset_id, listing_id, renter_id, booking_window, lifecycle_state, total_price, deposit_amount)
           VALUES ($1, $2, $3, tstzrange('2027-04-01 10:00:00+00', '2027-04-05 18:00:00+00', '[]'), 'RESERVED', 1000, -200)`,
          [testAssetId, testListingId, testRenterId]
        );
      },
      (err: any) => {
        assert.equal(err.code, '23514');
        return true;
      }
    );
  });

  test('5. Score of 101 on any score column fails with check violation (23514)', async () => {
    // Condition score > 100 on asset
    await assert.rejects(
      async () => {
        await client.query(
          `INSERT INTO assets (category_id, owner_id, manufacturer, model, lifecycle_state, condition_score)
           VALUES ($1, $2, 'TestMfr', 'TestModel', 'AVAILABLE', 101.0)`,
          [testCategoryId, testOwnerId]
        );
      },
      (err: any) => {
        assert.equal(err.code, '23514');
        return true;
      }
    );

    // Rollback error state before testing next check
    await client.query('ROLLBACK; BEGIN;');

    // Trust score > 100
    await assert.rejects(
      async () => {
        await client.query(
          `INSERT INTO trust_scores (user_id, kind, score, factors, calc_version, computed_at)
           VALUES ($1, 'RENTER', 105.0, '{}', 'v1.0', now())`,
          [testRenterId]
        );
      },
      (err: any) => {
        assert.equal(err.code, '23514');
        return true;
      }
    );
  });

  test('6. Foreign key violation (booking with unknown asset_id) fails with 23503', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    await assert.rejects(
      async () => {
        await client.query(
          `INSERT INTO bookings (asset_id, listing_id, renter_id, booking_window, lifecycle_state, total_price, deposit_amount)
           VALUES ($1, $2, $3, tstzrange('2027-05-01 10:00:00+00', '2027-05-05 18:00:00+00', '[]'), 'RESERVED', 1000, 2000)`,
          [fakeUuid, testListingId, testRenterId]
        );
      },
      (err: any) => {
        assert.equal(err.code, '23503'); // foreign_key_violation
        return true;
      }
    );
  });

  test('7. Duplicate email fails with unique violation (23505)', async () => {
    await assert.rejects(
      async () => {
        await client.query(
          `INSERT INTO users (email, password_hash, full_name)
           VALUES ('renter1@platform.local', 'hash', 'Duplicate User')`
        );
      },
      (err: any) => {
        assert.equal(err.code, '23505'); // unique_violation
        return true;
      }
    );
  });

  test('8. UPDATE and DELETE on append-only tables raises exception from prevent_mutation', async () => {
    // 8a. audit_logs UPDATE
    const auditRes = await client.query(
      `INSERT INTO audit_logs (action, entity_type, entity_id)
       VALUES ('TEST_ACTION', 'USER', 'id-1') RETURNING id`
    );
    const auditId = auditRes.rows[0].id;

    await assert.rejects(
      async () => {
        await client.query('UPDATE audit_logs SET action = \'TAMPERED\' WHERE id = $1', [auditId]);
      },
      (err: any) => {
        assert.match(err.message, /audit_logs is append-only/);
        return true;
      }
    );

    // Rollback error state before DELETE check
    await client.query('ROLLBACK; BEGIN;');

    // 8b. audit_logs DELETE
    const auditRes2 = await client.query(
      `INSERT INTO audit_logs (action, entity_type, entity_id)
       VALUES ('TEST_ACTION', 'USER', 'id-2') RETURNING id`
    );
    const auditId2 = auditRes2.rows[0].id;

    await assert.rejects(
      async () => {
        await client.query('DELETE FROM audit_logs WHERE id = $1', [auditId2]);
      },
      (err: any) => {
        assert.match(err.message, /audit_logs is append-only/);
        return true;
      }
    );

    // Rollback error state before booking_events check
    await client.query('ROLLBACK; BEGIN;');

    // 8c. booking_events UPDATE and DELETE
    const bEventRes = await client.query('SELECT id FROM booking_events LIMIT 1');
    if (bEventRes.rows.length > 0) {
      const bEventId = bEventRes.rows[0].id;
      await assert.rejects(
        async () => {
          await client.query('UPDATE booking_events SET event_type = \'TAMPERED\' WHERE id = $1', [bEventId]);
        },
        (err: any) => {
          assert.match(err.message, /booking_events is append-only/);
          return true;
        }
      );

      await client.query('ROLLBACK; BEGIN;');

      await assert.rejects(
        async () => {
          await client.query('DELETE FROM booking_events WHERE id = $1', [bEventId]);
        },
        (err: any) => {
          assert.match(err.message, /booking_events is append-only/);
          return true;
        }
      );
    }
  });

  test('9. Invalid lifecycle_state string on an asset fails with check violation (23514)', async () => {
    await assert.rejects(
      async () => {
        await client.query(
          `INSERT INTO assets (category_id, owner_id, manufacturer, model, lifecycle_state)
           VALUES ($1, $2, 'TestMfr', 'TestModel', 'NON_EXISTENT_STATE')`,
          [testCategoryId, testOwnerId]
        );
      },
      (err: any) => {
        assert.equal(err.code, '23514'); // check_violation
        return true;
      }
    );
  });

  test('10. Ledger transaction with unequal debits and credits fails at commit; a balanced one succeeds', async () => {
    const accRes = await client.query('SELECT id FROM ledger_accounts LIMIT 2');
    const acc1 = accRes.rows[0].id;
    const acc2 = accRes.rows[1].id;

    // Unbalanced transaction: DEBIT 500, CREDIT 400
    const txUnbalanced = await client.query(
      `INSERT INTO ledger_transactions (kind, description)
       VALUES ('DEPOSIT_HELD', 'Unbalanced test') RETURNING id`
    );
    const txUId = txUnbalanced.rows[0].id;

    await client.query(
      `INSERT INTO ledger_entries (transaction_id, account_id, direction, amount)
       VALUES ($1, $2, 'DEBIT', 500)`,
      [txUId, acc1]
    );
    await client.query(
      `INSERT INTO ledger_entries (transaction_id, account_id, direction, amount)
       VALUES ($1, $2, 'CREDIT', 400)`,
      [txUId, acc2]
    );

    // Attempting to commit an unbalanced transaction must trigger check_ledger_transaction_balance
    await assert.rejects(
      async () => {
        await client.query('COMMIT');
      },
      (err: any) => {
        assert.match(err.message, /is unbalanced: debits \(500.00\) != credits \(400.00\)/);
        return true;
      }
    );

    // Start a clean transaction block for balanced test
    await client.query('BEGIN');

    const txBalanced = await client.query(
      `INSERT INTO ledger_transactions (kind, description)
       VALUES ('DEPOSIT_HELD', 'Balanced test') RETURNING id`
    );
    const txBId = txBalanced.rows[0].id;

    await client.query(
      `INSERT INTO ledger_entries (transaction_id, account_id, direction, amount)
       VALUES ($1, $2, 'DEBIT', 500)`,
      [txBId, acc1]
    );
    await client.query(
      `INSERT INTO ledger_entries (transaction_id, account_id, direction, amount)
       VALUES ($1, $2, 'CREDIT', 500)`,
      [txBId, acc2]
    );

    // Balanced commit succeeds
    await client.query('COMMIT');

    // Resume transaction wrapper for test lifecycle
    await client.query('BEGIN');
  });

  test('11. Invalid SHA-256 string in inspection_evidence fails with check violation (23514)', async () => {
    const tmplRes = await client.query('SELECT id FROM inspection_templates LIMIT 1');
    const inspRes = await client.query(
      `INSERT INTO inspections (asset_id, template_id, type, status)
       VALUES ($1, $2, 'BASELINE', 'DRAFT') RETURNING id`,
      [testAssetId, tmplRes.rows[0].id]
    );
    const inspId = inspRes.rows[0].id;

    // Bad hash with invalid hex characters
    await assert.rejects(
      async () => {
        await client.query(
          `INSERT INTO inspection_evidence (asset_id, inspection_id, object_key, sha256_hash, mime_type, size_bytes)
           VALUES ($1, $2, 'obj-key-bad', 'NOT_A_VALID_HEX_64_CHAR_STRING', 'image/jpeg', 1024)`,
          [testAssetId, inspId]
        );
      },
      (err: any) => {
        assert.equal(err.code, '23514'); // check_violation
        return true;
      }
    );
  });

  test('12. Second non-resolved dispute for the same booking fails with unique violation (23505)', async () => {
    const bookingRes = await client.query('SELECT id FROM bookings LIMIT 1');
    const bookingId = bookingRes.rows[0].id;

    // Insert first OPEN dispute
    await client.query(
      `INSERT INTO disputes (booking_id, opened_by, reason, status)
       VALUES ($1, $2, 'First dispute reason', 'OPEN')`,
      [bookingId, testRenterId]
    );

    // Insert second non-resolved dispute for same booking
    await assert.rejects(
      async () => {
        await client.query(
          `INSERT INTO disputes (booking_id, opened_by, reason, status)
           VALUES ($1, $2, 'Second conflicting dispute', 'UNDER_REVIEW')`,
          [bookingId, testRenterId]
        );
      },
      (err: any) => {
        assert.equal(err.code, '23505'); // unique_violation
        return true;
      }
    );
  });
});
