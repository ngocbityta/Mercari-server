-- CreateTable
CREATE TABLE "search_histories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "keyword" VARCHAR NOT NULL,
    "duration_min" VARCHAR,
    "duration_max" VARCHAR,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_histories_pkey" PRIMARY KEY ("id")
);
