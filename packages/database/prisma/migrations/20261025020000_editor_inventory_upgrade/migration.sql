-- Extensão aditiva: mantém mapas, equipamentos e identificadores atuais.
ALTER TABLE "Map" ADD COLUMN "originXMeters" DOUBLE PRECISION NOT NULL DEFAULT 0,
                  ADD COLUMN "originYMeters" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "MapElement" ADD COLUMN "orderIndex" INTEGER NOT NULL DEFAULT 0,
                         ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false,
                         ADD COLUMN "locked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Device" ADD COLUMN "manufacturer" TEXT,
                     ADD COLUMN "serialNumber" TEXT,
                     ADD COLUMN "macAddress" TEXT,
                     ADD COLUMN "hostname" TEXT,
                     ADD COLUMN "operatingSystem" TEXT,
                     ADD COLUMN "assignedUser" TEXT,
                     ADD COLUMN "notes" TEXT;
