-- CreateTable
CREATE TABLE "cores" (
    "id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "tax_code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "credit_limit_amount" DECIMAL(15,2),
    "credit_used_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox" (
    "id" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),
    "locked_until" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "dead_lettered_at" TIMESTAMP(3),

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_outbox_unpublished" ON "outbox"("published_at");

-- CreateIndex (cores) — chống trùng MST + tối ưu filter/sort
CREATE UNIQUE INDEX "cores_tax_code_key" ON "cores"("tax_code");

-- CreateIndex
CREATE INDEX "idx_cores_deleted_at" ON "cores"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_cores_created_at" ON "cores"("created_at");
