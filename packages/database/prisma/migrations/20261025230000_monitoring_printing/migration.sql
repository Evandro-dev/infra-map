CREATE TYPE "ConnectionKind" AS ENUM ('NETWORK','PRINTING');
ALTER TABLE "MapConnection" ADD COLUMN "kind" "ConnectionKind" NOT NULL DEFAULT 'NETWORK';
ALTER TABLE "MapConnection" ADD COLUMN "printerAssignmentId" TEXT;

-- As ligações computador/impressora existentes passam a representar o padrão esperado do PC.
WITH pairs AS (
 SELECT DISTINCT CASE WHEN a.kind='COMPUTER' THEN a.id ELSE b.id END AS computer,
 CASE WHEN a.kind='PRINTER' THEN a.id ELSE b.id END AS printer
 FROM "MapConnection" c JOIN "MapElement" x ON x.id=c."sourceElementId" JOIN "MapElement" y ON y.id=c."targetElementId"
 JOIN "Device" a ON a.id=x."deviceId" JOIN "Device" b ON b.id=y."deviceId"
 WHERE (a.kind='COMPUTER' AND b.kind='PRINTER') OR (a.kind='PRINTER' AND b.kind='COMPUTER')
)
INSERT INTO "PrinterAssignment" (id,"computerId","printerId","createdAt") SELECT 'map-'||md5(computer||':'||printer),computer,printer,CURRENT_TIMESTAMP FROM pairs ON CONFLICT ("computerId","printerId") DO NOTHING;

UPDATE "MapConnection" c SET kind='PRINTING',"printerAssignmentId"=p.id FROM "MapElement" x,"MapElement" y,"PrinterAssignment" p
WHERE x.id=c."sourceElementId" AND y.id=c."targetElementId" AND ((x."deviceId"=p."computerId" AND y."deviceId"=p."printerId") OR (y."deviceId"=p."computerId" AND x."deviceId"=p."printerId"));
ALTER TABLE "MapConnection" ADD CONSTRAINT "MapConnection_printerAssignmentId_fkey" FOREIGN KEY ("printerAssignmentId") REFERENCES "PrinterAssignment"(id) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DeviceMonitor" (
 "deviceId" TEXT PRIMARY KEY,"enabled" BOOLEAN NOT NULL DEFAULT false,"intervalSeconds" INTEGER NOT NULL DEFAULT 60,"timeoutSeconds" INTEGER NOT NULL DEFAULT 5,
 "useIsl" BOOLEAN NOT NULL DEFAULT false,"useWindows" BOOLEAN NOT NULL DEFAULT false,"usePrintServer" BOOLEAN NOT NULL DEFAULT false,"useTcp" BOOLEAN NOT NULL DEFAULT false,"tcpPort" INTEGER,
 "lastRunAt" TIMESTAMP(3),"nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"leaseUntil" TIMESTAMP(3),"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "DeviceMonitor_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "DeviceMonitor_interval_range" CHECK ("intervalSeconds" BETWEEN 30 AND 3600),
 CONSTRAINT "DeviceMonitor_port_range" CHECK ("tcpPort" IS NULL OR "tcpPort" BETWEEN 1 AND 65535)
);
CREATE INDEX "DeviceMonitor_enabled_nextRunAt_idx" ON "DeviceMonitor"("enabled","nextRunAt");
CREATE TABLE "MonitorObservation" (
 id TEXT PRIMARY KEY,"deviceId" TEXT NOT NULL,source TEXT NOT NULL,status TEXT NOT NULL,summary TEXT NOT NULL,data JSONB NOT NULL,"checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "MonitorObservation_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "MonitorObservation_deviceId_source_checkedAt_idx" ON "MonitorObservation"("deviceId",source,"checkedAt" DESC);
