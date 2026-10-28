CREATE TABLE "ManagedCredential" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'WINDOWS_PRINT_SERVER',
  "name" TEXT NOT NULL,
  "targetServer" TEXT,
  "encryptedPayload" BYTEA NOT NULL,
  "encryptionNonce" BYTEA NOT NULL,
  "encryptionAuthTag" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ManagedCredential_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ManagedCredential_provider_targetServer_idx"
  ON "ManagedCredential"("provider", "targetServer");
