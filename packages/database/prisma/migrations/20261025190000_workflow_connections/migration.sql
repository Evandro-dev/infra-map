CREATE TABLE "MapConnection" (
 "id" TEXT NOT NULL,
 "mapId" TEXT NOT NULL,
 "sourceElementId" TEXT NOT NULL,
 "targetElementId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "MapConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MapConnection_mapId_sourceElementId_targetElementId_key" ON "MapConnection"("mapId","sourceElementId","targetElementId");
CREATE INDEX "MapConnection_mapId_idx" ON "MapConnection"("mapId");
ALTER TABLE "MapConnection" ADD CONSTRAINT "MapConnection_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MapConnection" ADD CONSTRAINT "MapConnection_sourceElementId_fkey" FOREIGN KEY ("sourceElementId") REFERENCES "MapElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MapConnection" ADD CONSTRAINT "MapConnection_targetElementId_fkey" FOREIGN KEY ("targetElementId") REFERENCES "MapElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
