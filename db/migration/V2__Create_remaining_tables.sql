-- =============================================
-- V2: Create remaining tables
-- blocks, notifications, devices, conversations, messages
-- =============================================

-- Bảng blocks (Chặn người dùng)
CREATE TABLE blocks (
    blocker_id      UUID        NOT NULL,
    blocked_id      UUID        NOT NULL,

    CONSTRAINT pk_blocks PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT fk_blocks_blocker FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_blocks_blocked FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_blocks_blocker ON blocks (blocker_id);
CREATE INDEX idx_blocks_blocked ON blocks (blocked_id);


-- Bảng notifications (Thông báo đẩy)
CREATE TABLE notifications (
    id              UUID            NOT NULL DEFAULT uuid_generate_v4(),
    user_id         UUID            NOT NULL,
    type            VARCHAR,
    object_id       UUID,
    title           VARCHAR,
    avatar          VARCHAR,
    group_type      INT             NOT NULL DEFAULT 0,
    is_read         BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_notifications PRIMARY KEY (id),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_user ON notifications (user_id);
CREATE INDEX idx_notifications_created ON notifications (created_at DESC);


-- Bảng devices (Thiết bị)
CREATE TABLE devices (
    id              UUID            NOT NULL DEFAULT uuid_generate_v4(),
    user_id         UUID            NOT NULL,
    devtype         INT             NOT NULL DEFAULT 0,
    dev_token       VARCHAR         NOT NULL,

    CONSTRAINT pk_devices PRIMARY KEY (id),
    CONSTRAINT uq_devices_user_token UNIQUE (user_id, dev_token),
    CONSTRAINT fk_devices_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_devices_user ON devices (user_id);


-- Bảng conversations (Hội thoại)
CREATE TABLE conversations (
    id              UUID            NOT NULL DEFAULT uuid_generate_v4(),
    partner_a_id    UUID            NOT NULL,
    partner_b_id    UUID            NOT NULL,
    is_deleted      BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_conversations PRIMARY KEY (id),
    CONSTRAINT uq_conversations_partners UNIQUE (partner_a_id, partner_b_id),
    CONSTRAINT fk_conversations_partner_a FOREIGN KEY (partner_a_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_conversations_partner_b FOREIGN KEY (partner_b_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversations_partner_a ON conversations (partner_a_id);
CREATE INDEX idx_conversations_partner_b ON conversations (partner_b_id);


-- Bảng messages (Tin nhắn)
CREATE TABLE messages (
    id              UUID            NOT NULL DEFAULT uuid_generate_v4(),
    conversation_id UUID            NOT NULL,
    sender_id       UUID            NOT NULL,
    receiver_id     UUID            NOT NULL,
    content         TEXT,
    is_read         BOOLEAN         NOT NULL DEFAULT FALSE,
    is_deleted      BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_messages PRIMARY KEY (id),
    CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_conversation ON messages (conversation_id);
CREATE INDEX idx_messages_sender ON messages (sender_id);
CREATE INDEX idx_messages_created ON messages (created_at DESC);
