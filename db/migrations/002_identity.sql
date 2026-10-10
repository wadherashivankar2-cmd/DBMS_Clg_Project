BEGIN;

-- Roles table
CREATE TABLE roles (
    id smallint PRIMARY KEY,
    code text UNIQUE NOT NULL,
    description text,
    CONSTRAINT chk_roles_code CHECK (code IN ('RENTER', 'OWNER', 'INSPECTOR', 'ADMIN'))
);
COMMENT ON TABLE roles IS 'System authority roles (RENTER, OWNER, INSPECTOR, ADMIN)';

-- Users table
CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email citext UNIQUE NOT NULL,
    password_hash text NOT NULL,
    full_name text NOT NULL,
    phone text,
    status text NOT NULL DEFAULT 'ACTIVE',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE', 'SUSPENDED'))
);
COMMENT ON TABLE users IS 'User credentials, profile identity, and account operational status';

-- User roles mapping table
CREATE TABLE user_roles (
    user_id uuid NOT NULL,
    role_id smallint NOT NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
COMMENT ON TABLE user_roles IS 'Many-to-many mapping between users and system roles';

-- User verifications table
CREATE TABLE user_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    type text NOT NULL,
    status text NOT NULL DEFAULT 'PENDING',
    verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_verifications_user_type UNIQUE (user_id, type),
    CONSTRAINT fk_user_verifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_user_verifications_type CHECK (type IN ('EMAIL', 'PHONE', 'ID_DOCUMENT')),
    CONSTRAINT chk_user_verifications_status CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED'))
);
CREATE INDEX idx_user_verifications_user_id ON user_verifications(user_id);
COMMENT ON TABLE user_verifications IS 'User trust identity verification history (email, phone, ID document)';

COMMIT;
