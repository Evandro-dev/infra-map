-- Migração aditiva: mantém o inventário, os mapas e os dados existentes.
ALTER TABLE "Device" ADD COLUMN "islComputerId" TEXT;
ALTER TABLE "Device" ADD COLUMN "islComputerName" TEXT;
ALTER TABLE "Device" ADD COLUMN "printServer" TEXT;
ALTER TABLE "Device" ADD COLUMN "printShare" TEXT;
ALTER TABLE "Device" ADD COLUMN "approvedDriver" TEXT;
CREATE UNIQUE INDEX "Device_islComputerId_key" ON "Device"("islComputerId");
CREATE TABLE "PrinterAssignment" (
 "id" TEXT NOT NULL, "computerId" TEXT NOT NULL, "printerId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PrinterAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PrinterAssignment_computerId_printerId_key" ON "PrinterAssignment"("computerId","printerId");
ALTER TABLE "PrinterAssignment" ADD CONSTRAINT "PrinterAssignment_computerId_fkey" FOREIGN KEY ("computerId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrinterAssignment" ADD CONSTRAINT "PrinterAssignment_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "SupportJob" (
 "id" TEXT NOT NULL, "deviceId" TEXT NOT NULL, "action" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING', "providerActionId" TEXT, "resultSummary" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "SupportJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportJob_deviceId_createdAt_idx" ON "SupportJob"("deviceId","createdAt");
ALTER TABLE "SupportJob" ADD CONSTRAINT "SupportJob_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
