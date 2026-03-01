-- =============================================
-- V1: Create users table
-- =============================================

-- Extension để generate UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE user_role_enum AS ENUM ('HV', 'GV');
CREATE TYPE user_status_enum AS ENUM ('ACTIVE', 'LOCKED');

-- Bảng users
CREATE TABLE users (
    id              UUID            NOT NULL DEFAULT uuid_generate_v4(),
    phonenumber     VARCHAR         NOT NULL,
    password        VARCHAR         NOT NULL,
    username        VARCHAR,
    avatar          VARCHAR,
    cover_image     VARCHAR,
    description     TEXT,
    role            user_role_enum  NOT NULL,
    token           VARCHAR,
    status          user_status_enum NOT NULL DEFAULT 'ACTIVE',
    online          BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_users_id PRIMARY KEY (id),
    CONSTRAINT uq_users_phonenumber UNIQUE (phonenumber)
);

-- Indexes
CREATE INDEX idx_users_phonenumber ON users (phonenumber);
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_status ON users (status);
