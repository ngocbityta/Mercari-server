-- CreateTable
CREATE TABLE "verify_codes" (
    "id" UUID NOT NULL,
    "phonenumber" VARCHAR NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verify_codes_pkey" PRIMARY KEY ("id")
);
