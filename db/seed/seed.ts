import { Client } from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/app_db';

export async function seed(): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log('Seeding data...');

    // 1. Roles (id, code, description)
    const rolesData = [
      { id: 1, code: 'RENTER', description: 'Platform renter' },
      { id: 2, code: 'OWNER', description: 'Asset owner' },
      { id: 3, code: 'INSPECTOR', description: 'Physical asset verification inspector' },
      { id: 4, code: 'ADMIN', description: 'System administrator' },
    ];

    for (const r of rolesData) {
      await client.query(
        `INSERT INTO roles (id, code, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, description = EXCLUDED.description`,
        [r.id, r.code, r.description]
      );
    }
    console.log('Roles seeded.');

    // 2. Asset Categories (7 categories)
    const categoriesData = [
      { code: 'ELECTRONICS', name: 'Electronics', condition_threshold: 15.0 },
      { code: 'CAMERAS', name: 'Cameras', condition_threshold: 12.0 },
      { code: 'VEHICLES', name: 'Vehicles', condition_threshold: 20.0 },
      { code: 'TOOLS', name: 'Tools', condition_threshold: 25.0 },
      { code: 'FASHION', name: 'Fashion', condition_threshold: 10.0 },
      { code: 'MUSICAL', name: 'Musical / Event', condition_threshold: 12.0 },
      { code: 'RECREATION', name: 'Games / Recreation', condition_threshold: 18.0 },
    ];

    const categoryMap: Record<string, string> = {};

    for (const c of categoriesData) {
      const res = await client.query<{ id: string }>(
        `INSERT INTO asset_categories (code, name, condition_threshold)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, condition_threshold = EXCLUDED.condition_threshold
         RETURNING id`,
        [c.code, c.name, c.condition_threshold]
      );
      categoryMap[c.code] = res.rows[0].id;
    }
    console.log('Categories seeded.');

    // 2b. Asset Category Fields (3 to 5 per category)
    const fieldsData: Array<{
      catCode: string;
      field_key: string;
      label: string;
      data_type: string;
      is_required: boolean;
      allowed_values: any;
    }> = [
      // Electronics
      { catCode: 'ELECTRONICS', field_key: 'processor', label: 'Processor', data_type: 'text', is_required: true, allowed_values: null },
      { catCode: 'ELECTRONICS', field_key: 'ram_gb', label: 'RAM (GB)', data_type: 'number', is_required: true, allowed_values: null },
      { catCode: 'ELECTRONICS', field_key: 'storage_gb', label: 'Storage (GB)', data_type: 'number', is_required: true, allowed_values: null },
      { catCode: 'ELECTRONICS', field_key: 'battery_health_pct', label: 'Battery Health %', data_type: 'number', is_required: false, allowed_values: null },

      // Cameras
      { catCode: 'CAMERAS', field_key: 'sensor_type', label: 'Sensor Type', data_type: 'enum', is_required: true, allowed_values: ['Full Frame', 'APS-C', 'Micro Four Thirds'] },
      { catCode: 'CAMERAS', field_key: 'lens_mount', label: 'Lens Mount', data_type: 'text', is_required: true, allowed_values: null },
      { catCode: 'CAMERAS', field_key: 'shutter_count', label: 'Shutter Count', data_type: 'number', is_required: false, allowed_values: null },
      { catCode: 'CAMERAS', field_key: 'includes_lens', label: 'Includes Lens', data_type: 'boolean', is_required: false, allowed_values: null },

      // Vehicles
      { catCode: 'VEHICLES', field_key: 'vehicle_type', label: 'Vehicle Type', data_type: 'enum', is_required: true, allowed_values: ['Bicycle', 'Electric Scooter', 'Motorcycle', 'Car'] },
      { catCode: 'VEHICLES', field_key: 'odometer_km', label: 'Odometer (km)', data_type: 'number', is_required: true, allowed_values: null },
      { catCode: 'VEHICLES', field_key: 'fuel_type', label: 'Fuel / Power', data_type: 'enum', is_required: true, allowed_values: ['Electric', 'Petrol', 'Manual'] },
      { catCode: 'VEHICLES', field_key: 'helmet_included', label: 'Helmet Included', data_type: 'boolean', is_required: false, allowed_values: null },

      // Tools
      { catCode: 'TOOLS', field_key: 'power_source', label: 'Power Source', data_type: 'enum', is_required: true, allowed_values: ['Cordless Battery', 'Corded AC', 'Manual'] },
      { catCode: 'TOOLS', field_key: 'voltage', label: 'Voltage', data_type: 'text', is_required: false, allowed_values: null },
      { catCode: 'TOOLS', field_key: 'carry_case_included', label: 'Carry Case', data_type: 'boolean', is_required: false, allowed_values: null },

      // Fashion
      { catCode: 'FASHION', field_key: 'size', label: 'Garment Size', data_type: 'enum', is_required: true, allowed_values: ['S', 'M', 'L', 'XL'] },
      { catCode: 'FASHION', field_key: 'material', label: 'Fabric / Material', data_type: 'text', is_required: true, allowed_values: null },
      { catCode: 'FASHION', field_key: 'dry_clean_only', label: 'Dry Clean Only', data_type: 'boolean', is_required: true, allowed_values: null },

      // Musical
      { catCode: 'MUSICAL', field_key: 'instrument_type', label: 'Instrument Type', data_type: 'text', is_required: true, allowed_values: null },
      { catCode: 'MUSICAL', field_key: 'is_electric', label: 'Is Electric', data_type: 'boolean', is_required: true, allowed_values: null },
      { catCode: 'MUSICAL', field_key: 'accessories_included', label: 'Accessories', data_type: 'text', is_required: false, allowed_values: null },

      // Recreation
      { catCode: 'RECREATION', field_key: 'player_count', label: 'Player Capacity', data_type: 'text', is_required: false, allowed_values: null },
      { catCode: 'RECREATION', field_key: 'outdoor_grade', label: 'Outdoor Grade', data_type: 'boolean', is_required: true, allowed_values: null },
      { catCode: 'RECREATION', field_key: 'weight_kg', label: 'Weight (kg)', data_type: 'number', is_required: false, allowed_values: null },
    ];

    for (const f of fieldsData) {
      const catId = categoryMap[f.catCode];
      await client.query(
        `INSERT INTO asset_category_fields (category_id, field_key, label, data_type, is_required, allowed_values)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (category_id, field_key) DO UPDATE SET
           label = EXCLUDED.label,
           data_type = EXCLUDED.data_type,
           is_required = EXCLUDED.is_required,
           allowed_values = EXCLUDED.allowed_values`,
        [catId, f.field_key, f.label, f.data_type, f.is_required, JSON.stringify(f.allowed_values)]
      );
    }
    console.log('Category fields seeded.');

    // 3. Inspection Templates & 8-point manifest items
    const manifestItems = [
      { point_no: 1, item_key: 'identity_serial', label: 'Identity / Serial Number', is_measurable: false, weight: 0.0000, max_score: 5 },
      { point_no: 2, item_key: 'physical_exterior', label: 'Physical Exterior', is_measurable: true, weight: 0.2500, max_score: 5 },
      { point_no: 3, item_key: 'major_components', label: 'Major Components', is_measurable: true, weight: 0.2500, max_score: 5 },
      { point_no: 4, item_key: 'accessories', label: 'Accessories & Cables', is_measurable: false, weight: 0.0000, max_score: 5 },
      { point_no: 5, item_key: 'functional_test', label: 'Functional Test', is_measurable: true, weight: 0.2500, max_score: 5 },
      { point_no: 6, item_key: 'wear_cosmetic', label: 'Wear / Cosmetic Condition', is_measurable: true, weight: 0.2500, max_score: 5 },
      { point_no: 7, item_key: 'runtime_metrics', label: 'Runtime / Usage Metrics', is_measurable: false, weight: 0.0000, max_score: 5 },
      { point_no: 8, item_key: 'evidence_photos', label: 'Evidence / Photography', is_measurable: false, weight: 0.0000, max_score: 5 },
    ];

    for (const catCode of Object.keys(categoryMap)) {
      const catId = categoryMap[catCode];
      const tmplRes = await client.query<{ id: string }>(
        `INSERT INTO inspection_templates (category_id, name, version, is_active)
         VALUES ($1, $2, 1, true)
         ON CONFLICT (category_id, version) DO UPDATE SET name = EXCLUDED.name, is_active = EXCLUDED.is_active
         RETURNING id`,
        [catId, `${catCode} 8-Point Standard Inspection`]
      );
      const tmplId = tmplRes.rows[0].id;

      for (const item of manifestItems) {
        await client.query(
          `INSERT INTO inspection_template_items (template_id, point_no, item_key, label, is_measurable, weight, max_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (template_id, item_key) DO UPDATE SET
             label = EXCLUDED.label,
             is_measurable = EXCLUDED.is_measurable,
             weight = EXCLUDED.weight,
             max_score = EXCLUDED.max_score`,
          [tmplId, item.point_no, item.item_key, item.label, item.is_measurable, item.weight, item.max_score]
        );
      }
    }
    console.log('Inspection templates and 8-point manifest items seeded.');

    // 4. Users (1 admin, 1 inspector, 2 owners, 2 renters)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash('Password@123', saltRounds);

    const usersData = [
      { email: 'admin@platform.local', full_name: 'System Administrator', phone: '+91 9800000001', roleCode: 'ADMIN', roleId: 4 },
      { email: 'inspector@platform.local', full_name: 'Quality Inspector', phone: '+91 9800000002', roleCode: 'INSPECTOR', roleId: 3 },
      { email: 'owner1@platform.local', full_name: 'Aarav Sharma (Owner)', phone: '+91 9800000003', roleCode: 'OWNER', roleId: 2 },
      { email: 'owner2@platform.local', full_name: 'Priya Patel (Owner)', phone: '+91 9800000004', roleCode: 'OWNER', roleId: 2 },
      { email: 'renter1@platform.local', full_name: 'Rohan Gupta (Renter)', phone: '+91 9800000005', roleCode: 'RENTER', roleId: 1 },
      { email: 'renter2@platform.local', full_name: 'Ananya Rao (Renter)', phone: '+91 9800000006', roleCode: 'RENTER', roleId: 1 },
    ];

    const userMap: Record<string, string> = {};

    for (const u of usersData) {
      const uRes = await client.query<{ id: string }>(
        `INSERT INTO users (email, password_hash, full_name, phone, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, password_hash = EXCLUDED.password_hash
         RETURNING id`,
        [u.email, passwordHash, u.full_name, u.phone]
      );
      const userId = uRes.rows[0].id;
      userMap[u.email] = userId;

      // Assign user role
      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [userId, u.roleId]
      );

      // Verify user in user_verifications
      for (const vType of ['EMAIL', 'PHONE', 'ID_DOCUMENT']) {
        await client.query(
          `INSERT INTO user_verifications (user_id, type, status, verified_at)
           VALUES ($1, $2, 'VERIFIED', now())
           ON CONFLICT (user_id, type) DO UPDATE SET status = 'VERIFIED', verified_at = now()`,
          [userId, vType]
        );
      }
    }
    console.log('Users, roles, and verifications seeded.');

    // 5. Assets (about 20 assets across categories and owners)
    const owner1Id = userMap['owner1@platform.local'];
    const owner2Id = userMap['owner2@platform.local'];

    const assetsCatalog = [
      // Electronics
      { catCode: 'ELECTRONICS', ownerId: owner1Id, mfr: 'Apple', model: 'MacBook Pro 16" M3 Max', sn: 'SN-ELEC-MBP-01', state: 'AVAILABLE', cond: 98.0, health: 97.0, rel: 99.0, attrs: { processor: 'M3 Max', ram_gb: 36, storage_gb: 1000, battery_health_pct: 99 } },
      { catCode: 'ELECTRONICS', ownerId: owner1Id, mfr: 'Dell', model: 'XPS 15 9530', sn: 'SN-ELEC-XPS-02', state: 'AVAILABLE', cond: 92.0, health: 90.0, rel: 93.0, attrs: { processor: 'Intel Core i9', ram_gb: 32, storage_gb: 1000, battery_health_pct: 92 } },
      { catCode: 'ELECTRONICS', ownerId: owner2Id, mfr: 'Sony', model: 'PlayStation 5 Pro', sn: 'SN-ELEC-PS5-03', state: 'LISTED', cond: 95.0, health: 95.0, rel: 96.0, attrs: { processor: 'Custom AMD Zen 2', ram_gb: 16, storage_gb: 2000 } },
      // Cameras
      { catCode: 'CAMERAS', ownerId: owner1Id, mfr: 'Sony', model: 'A7 IV Full Frame', sn: 'SN-CAM-A74-01', state: 'AVAILABLE', cond: 95.0, health: 94.0, rel: 96.0, attrs: { sensor_type: 'Full Frame', lens_mount: 'Sony E', shutter_count: 8500, includes_lens: true } },
      { catCode: 'CAMERAS', ownerId: owner1Id, mfr: 'Canon', model: 'EOS R5', sn: 'SN-CAM-R5-02', state: 'AVAILABLE', cond: 96.0, health: 96.0, rel: 98.0, attrs: { sensor_type: 'Full Frame', lens_mount: 'Canon RF', shutter_count: 5200, includes_lens: true } },
      { catCode: 'CAMERAS', ownerId: owner2Id, mfr: 'Fujifilm', model: 'X-T5', sn: 'SN-CAM-XT5-03', state: 'AVAILABLE', cond: 91.0, health: 92.0, rel: 94.0, attrs: { sensor_type: 'APS-C', lens_mount: 'Fujifilm X', shutter_count: 12000, includes_lens: false } },
      // Vehicles
      { catCode: 'VEHICLES', ownerId: owner2Id, mfr: 'Ather', model: '450X Gen 3', sn: 'SN-VEH-ATH-01', state: 'AVAILABLE', cond: 88.0, health: 89.0, rel: 91.0, attrs: { vehicle_type: 'Electric Scooter', odometer_km: 4300, fuel_type: 'Electric', helmet_included: true } },
      { catCode: 'VEHICLES', ownerId: owner2Id, mfr: 'Trek', model: 'Marlin 7 Mountain Bike', sn: 'SN-VEH-TRK-02', state: 'AVAILABLE', cond: 94.0, health: 93.0, rel: 95.0, attrs: { vehicle_type: 'Bicycle', odometer_km: 350, fuel_type: 'Manual', helmet_included: true } },
      { catCode: 'VEHICLES', ownerId: owner1Id, mfr: 'Royal Enfield', model: 'Hunter 350', sn: 'SN-VEH-RE-03', state: 'MAINTENANCE', cond: 84.0, health: 82.0, rel: 87.0, attrs: { vehicle_type: 'Motorcycle', odometer_km: 12400, fuel_type: 'Petrol', helmet_included: false } },
      // Tools
      { catCode: 'TOOLS', ownerId: owner1Id, mfr: 'DeWalt', model: '20V MAX Cordless Drill Kit', sn: 'SN-TOOL-DEW-01', state: 'AVAILABLE', cond: 92.0, health: 91.0, rel: 95.0, attrs: { power_source: 'Cordless Battery', voltage: '20V', carry_case_included: true } },
      { catCode: 'TOOLS', ownerId: owner2Id, mfr: 'Bosch', model: 'GDC 120 Marble Cutter', sn: 'SN-TOOL-BOS-02', state: 'AVAILABLE', cond: 87.0, health: 86.0, rel: 89.0, attrs: { power_source: 'Corded AC', voltage: '220V', carry_case_included: false } },
      { catCode: 'TOOLS', ownerId: owner1Id, mfr: 'Makita', model: 'DHS680Z Circular Saw', sn: 'SN-TOOL-MAK-03', state: 'LISTED', cond: 96.0, health: 95.0, rel: 97.0, attrs: { power_source: 'Cordless Battery', voltage: '18V', carry_case_included: true } },
      // Fashion
      { catCode: 'FASHION', ownerId: owner2Id, mfr: 'Manyavar', model: 'Embroidered Sherwani Set', sn: 'SN-FASH-MAN-01', state: 'AVAILABLE', cond: 98.0, health: 98.0, rel: 99.0, attrs: { size: 'L', material: 'Raw Silk', dry_clean_only: true } },
      { catCode: 'FASHION', ownerId: owner2Id, mfr: 'Sabyasachi', model: 'Heritage Floral Lehenga', sn: 'SN-FASH-SAB-02', state: 'AVAILABLE', cond: 99.0, health: 99.0, rel: 99.0, attrs: { size: 'M', material: 'Organza & Zari', dry_clean_only: true } },
      { catCode: 'FASHION', ownerId: owner1Id, mfr: 'Raymond', model: 'Three-Piece Tuxedo', sn: 'SN-FASH-RAY-03', state: 'AVAILABLE', cond: 94.0, health: 93.0, rel: 95.0, attrs: { size: 'XL', material: 'Wool Blend', dry_clean_only: true } },
      // Musical
      { catCode: 'MUSICAL', ownerId: owner1Id, mfr: 'Fender', model: 'Player Stratocaster', sn: 'SN-MUS-FEN-01', state: 'AVAILABLE', cond: 93.0, health: 92.0, rel: 94.0, attrs: { instrument_type: 'Electric Guitar', is_electric: true, accessories_included: 'Strap, Hard Case, Cable' } },
      { catCode: 'MUSICAL', ownerId: owner1Id, mfr: 'Roland', model: 'FP-30X Digital Piano', sn: 'SN-MUS-ROL-02', state: 'AVAILABLE', cond: 97.0, health: 96.0, rel: 98.0, attrs: { instrument_type: 'Digital Piano', is_electric: true, accessories_included: 'Pedal, Stand, Power Supply' } },
      { catCode: 'MUSICAL', ownerId: owner2Id, mfr: 'Yamaha', model: 'Stage Custom Drum Kit', sn: 'SN-MUS-YAM-03', state: 'LISTED', cond: 89.0, health: 88.0, rel: 90.0, attrs: { instrument_type: 'Acoustic Drums', is_electric: false, accessories_included: 'Cymbals, Throne, Sticks' } },
      // Recreation
      { catCode: 'RECREATION', ownerId: owner2Id, mfr: 'Quechua', model: 'Arpenaz 4.1 Family Tent', sn: 'SN-REC-QUE-01', state: 'AVAILABLE', cond: 95.0, health: 94.0, rel: 96.0, attrs: { player_count: '4 Persons', outdoor_grade: true, weight_kg: 10.5 } },
      { catCode: 'RECREATION', ownerId: owner1Id, mfr: 'Stiga', model: 'Optima Outdoor Table Tennis', sn: 'SN-REC-STI-02', state: 'AVAILABLE', cond: 91.0, health: 90.0, rel: 93.0, attrs: { player_count: '2-4 Persons', outdoor_grade: true, weight_kg: 45.0 } },
    ];

    const seededAssetList: Array<{ id: string; mfr: string; model: string; ownerId: string; state: string }> = [];

    // Bengaluru location coordinate pairs
    const bglLocations = [
      { city: 'Bengaluru', area: 'Koramangala 4th Block', lat: 12.934533, lng: 77.626579 },
      { city: 'Bengaluru', area: 'Indiranagar 100ft Road', lat: 12.971891, lng: 77.641151 },
      { city: 'Bengaluru', area: 'HSR Layout Sector 1', lat: 12.912118, lng: 77.644554 },
      { city: 'Bengaluru', area: 'Whitefield Main Road', lat: 12.969819, lng: 77.749977 },
      { city: 'Bengaluru', area: 'Jayanagar 4th Block', lat: 12.929869, lng: 77.583344 },
    ];

    for (let i = 0; i < assetsCatalog.length; i++) {
      const item = assetsCatalog[i];
      const catId = categoryMap[item.catCode];

      const aRes = await client.query<{ id: string }>(
        `INSERT INTO assets (category_id, owner_id, manufacturer, model, serial_number, acquisition_date, lifecycle_state, condition_score, health_score, reliability_score, attributes)
         VALUES ($1, $2, $3, $4, $5, '2025-01-15', $6, $7, $8, $9, $10)
         RETURNING id`,
        [catId, item.ownerId, item.mfr, item.model, item.sn, item.state, item.cond, item.health, item.rel, JSON.stringify(item.attrs)]
      );
      const assetId = aRes.rows[0].id;
      seededAssetList.push({ id: assetId, mfr: item.mfr, model: item.model, ownerId: item.ownerId, state: item.state });

      // Asset ownership row
      await client.query(
        `INSERT INTO asset_ownership (asset_id, owner_id, owned_during, reason)
         VALUES ($1, $2, tstzrange('2025-01-15 00:00:00+00', 'infinity', '[]'), 'REGISTERED')`,
        [assetId, item.ownerId]
      );

      // Current location (Bengaluru area)
      const loc = bglLocations[i % bglLocations.length];
      await client.query(
        `INSERT INTO asset_locations (asset_id, city, area, latitude, longitude, is_current)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [assetId, loc.city, loc.area, loc.lat, loc.lng]
      );

      // ASSET_CREATED event in asset_events
      await client.query(
        `INSERT INTO asset_events (asset_id, event_type, actor_id, metadata)
         VALUES ($1, 'ASSET_CREATED', $2, $3)`,
        [assetId, item.ownerId, JSON.stringify({ note: 'Initial asset onboarding into passport' })]
      );
    }
    console.log(`Seeded ${seededAssetList.length} assets with ownership, locations, and creation events.`);

    // 6. Listings for available assets (sensible daily_price and deposit_amount; 2 with buyout_available = true)
    const availableAssets = seededAssetList.filter((a) => a.state === 'AVAILABLE');
    const seededListings: Array<{ id: string; assetId: string; ownerId: string }> = [];

    for (let i = 0; i < availableAssets.length; i++) {
      const asset = availableAssets[i];
      const isBuyout = i === 0 || i === 3; // Exactly two listings with buyout
      const dailyPrice = 500 + (i * 150);
      const deposit = dailyPrice * 5;
      const buyoutPrice = isBuyout ? dailyPrice * 60 : null;

      const lRes = await client.query<{ id: string }>(
        `INSERT INTO listings (asset_id, title, description, status, daily_price, deposit_amount, buyout_available, buyout_price, created_by)
         VALUES ($1, $2, $3, 'ACTIVE', $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          asset.id,
          `${asset.mfr} ${asset.model} for Rent`,
          `High-condition verified ${asset.model} in pristine working condition.`,
          dailyPrice,
          deposit,
          isBuyout,
          buyoutPrice,
          asset.ownerId,
        ]
      );
      seededListings.push({ id: lRes.rows[0].id, assetId: asset.id, ownerId: asset.ownerId });
    }
    console.log(`Seeded ${seededListings.length} active marketplace listings (2 with buyout enabled).`);

    // 7. Ledger Accounts (ESCROW, PLATFORM_REVENUE, EXTERNAL, plus one USER_DEPOSIT & OWNER_PAYABLE per seeded renter/owner)
    await client.query(
      `INSERT INTO ledger_accounts (code, type, owner_user_id) VALUES
       ('ESCROW_SYSTEM', 'ESCROW', NULL),
       ('PLATFORM_REVENUE', 'PLATFORM_REVENUE', NULL),
       ('EXTERNAL_CLEARING', 'EXTERNAL', NULL)
       ON CONFLICT (code) DO NOTHING`
    );

    const renter1Id = userMap['renter1@platform.local'];
    const renter2Id = userMap['renter2@platform.local'];

    const userAccounts = [
      { code: 'DEP_RENTER1', type: 'USER_DEPOSIT', userId: renter1Id },
      { code: 'DEP_RENTER2', type: 'USER_DEPOSIT', userId: renter2Id },
      { code: 'PAY_OWNER1', type: 'OWNER_PAYABLE', userId: owner1Id },
      { code: 'PAY_OWNER2', type: 'OWNER_PAYABLE', userId: owner2Id },
    ];

    for (const acc of userAccounts) {
      await client.query(
        `INSERT INTO ledger_accounts (code, type, owner_user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO NOTHING`,
        [acc.code, acc.type, acc.userId]
      );
    }
    console.log('Ledger accounts seeded.');

    // 8. Three non-overlapping Bookings (RESERVED future, SETTLED past, CANCELLED) with booking_events
    // Booking 1: Future RESERVED (MacBook Pro)
    const b1Listing = seededListings[0];
    const b1Res = await client.query<{ id: string }>(
      `INSERT INTO bookings (asset_id, listing_id, renter_id, booking_window, lifecycle_state, total_price, deposit_amount, idempotency_key)
       VALUES ($1, $2, $3, tstzrange('2026-11-01 10:00:00+00', '2026-11-05 18:00:00+00', '[]'), 'RESERVED', 2000.00, 2500.00, 'idemp-seed-booking-1')
       RETURNING id`,
      [b1Listing.assetId, b1Listing.id, renter1Id]
    );
    const b1Id = b1Res.rows[0].id;
    await client.query(
      `INSERT INTO booking_events (booking_id, event_type, from_state, to_state, actor_id, metadata)
       VALUES ($1, 'BOOKING_CREATED', NULL, 'RESERVED', $2, $3)`,
      [b1Id, renter1Id, JSON.stringify({ note: 'Initial reservation placed' })]
    );

    // Booking 2: Past SETTLED (Sony A7 IV Camera)
    const b2Listing = seededListings[1];
    const b2Res = await client.query<{ id: string }>(
      `INSERT INTO bookings (asset_id, listing_id, renter_id, booking_window, lifecycle_state, total_price, deposit_amount, idempotency_key)
       VALUES ($1, $2, $3, tstzrange('2026-08-01 10:00:00+00', '2026-08-05 18:00:00+00', '[]'), 'SETTLED', 2600.00, 3250.00, 'idemp-seed-booking-2')
       RETURNING id`,
      [b2Listing.assetId, b2Listing.id, renter2Id]
    );
    const b2Id = b2Res.rows[0].id;
    await client.query(
      `INSERT INTO booking_events (booking_id, event_type, from_state, to_state, actor_id, metadata) VALUES
       ($1, 'BOOKING_CREATED', NULL, 'RESERVED', $2, '{"note": "Created"}'),
       ($1, 'HANDOVER_COMPLETED', 'RESERVED', 'ACTIVE_CUSTODY', $2, '{"note": "Handover verified"}'),
       ($1, 'RETURN_COMPLETED', 'ACTIVE_CUSTODY', 'SETTLED', $2, '{"note": "Settlement completed with normal condition delta"}')`,
      [b2Id, renter2Id]
    );

    // Booking 3: CANCELLED (DeWalt Drill Kit)
    const b3Listing = seededListings[2];
    const b3Res = await client.query<{ id: string }>(
      `INSERT INTO bookings (asset_id, listing_id, renter_id, booking_window, lifecycle_state, total_price, deposit_amount, idempotency_key)
       VALUES ($1, $2, $3, tstzrange('2026-09-10 09:00:00+00', '2026-09-12 18:00:00+00', '[]'), 'CANCELLED', 1600.00, 4000.00, 'idemp-seed-booking-3')
       RETURNING id`,
      [b3Listing.assetId, b3Listing.id, renter1Id]
    );
    const b3Id = b3Res.rows[0].id;
    await client.query(
      `INSERT INTO booking_events (booking_id, event_type, from_state, to_state, actor_id, metadata) VALUES
       ($1, 'BOOKING_CREATED', NULL, 'RESERVED', $2, '{"note": "Created"}'),
       ($1, 'BOOKING_CANCELLED', 'RESERVED', 'CANCELLED', $2, '{"note": "Cancelled by user before handover"}')`,
      [b3Id, renter1Id]
    );
    console.log('Bookings and booking events seeded.');

    console.log('Seed completed successfully.');
  } finally {
    await client.end();
  }
}

if (require.main === module || process.argv[1]?.endsWith('seed.ts')) {
  seed().catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
}
