-- Seed system bot user used as the author of auto-generated score comments.
-- ON CONFLICT DO NOTHING ensures idempotency: running this migration multiple
-- times never creates duplicate rows.
INSERT INTO "users" (
    "id",
    "phonenumber",
    "password",
    "username",
    "avatar",
    "role",
    "status",
    "online",
    "created_at",
    "updated_at"
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'SYSTEM_BOT',
    'SYSTEM_BOT_NO_LOGIN',
    'Hệ thống',
    'system_avatar.jpg',
    'GV',
    'ACTIVE',
    false,
    NOW(),
    NOW()
) ON CONFLICT ("id") DO NOTHING;
