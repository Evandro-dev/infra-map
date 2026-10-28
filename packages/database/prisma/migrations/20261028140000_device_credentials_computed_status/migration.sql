ALTER TABLE "Device" DROP COLUMN "status";

ALTER TABLE "Device" ADD COLUMN "credentialId" TEXT;

CREATE INDEX "Device_credentialId_idx" ON "Device"("credentialId");

ALTER TABLE "Device"
ADD CONSTRAINT "Device_credentialId_fkey"
FOREIGN KEY ("credentialId") REFERENCES "ManagedCredential"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
