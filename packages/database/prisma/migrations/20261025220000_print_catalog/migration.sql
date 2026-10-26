-- Migração aditiva: não altera equipamentos nem configurações reais de impressão.
ALTER TABLE "Device" ADD COLUMN "printQueue" TEXT;
ALTER TABLE "Device" ADD COLUMN "printPort" TEXT;
ALTER TABLE "Device" ADD COLUMN "printProtocol" TEXT;
ALTER TABLE "Device" ADD COLUMN "printPortNumber" INTEGER;
ALTER TABLE "Device" ADD CONSTRAINT "Device_printPortNumber_range" CHECK ("printPortNumber" IS NULL OR "printPortNumber" BETWEEN 1 AND 65535);

CREATE TABLE "PrintCatalogSnapshot" (
  "id" TEXT NOT NULL,
  "serverKey" TEXT NOT NULL,
  "serverName" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "collectedAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL,
  CONSTRAINT "PrintCatalogSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PrintCatalogSnapshot_serverKey_source_key" ON "PrintCatalogSnapshot"("serverKey", "source");
