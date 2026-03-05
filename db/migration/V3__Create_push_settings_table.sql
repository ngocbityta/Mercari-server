-- =============================================
-- V3: Create push_settings table for Week 09 APIs
-- =============================================

CREATE TABLE push_settings (
    user_id         UUID            NOT NULL,
    like_comment    INT             NOT NULL DEFAULT 1,
    from_friends    INT             NOT NULL DEFAULT 1,
    requested_friend INT            NOT NULL DEFAULT 1,
    suggested_friend INT            NOT NULL DEFAULT 1,
    birthday        INT             NOT NULL DEFAULT 1,
    video           INT             NOT NULL DEFAULT 1,
    report          INT             NOT NULL DEFAULT 1,
    sound_on        INT             NOT NULL DEFAULT 1,
    notification_on INT             NOT NULL DEFAULT 1,
    vibrant_on      INT             NOT NULL DEFAULT 1,
    led_on          INT             NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_push_settings PRIMARY KEY (user_id),
    CONSTRAINT fk_push_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
