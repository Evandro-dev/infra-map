UPDATE "MapConnection" AS connection
SET "kind" = 'SERVES'
FROM "MapElement" AS source_element
JOIN "Device" AS source_device ON source_device."id" = source_element."deviceId",
     "MapElement" AS target_element
JOIN "Device" AS target_device ON target_device."id" = target_element."deviceId"
WHERE connection."kind" = 'NETWORK'
  AND source_element."id" = connection."sourceElementId"
  AND target_element."id" = connection."targetElementId"
  AND source_element."mapId" = connection."mapId"
  AND target_element."mapId" = connection."mapId"
  AND (
    (source_device."kind" = 'SERVER' AND target_device."kind" = 'PRINTER'
      AND lower(btrim(source_device."hostname")) = lower(btrim(target_device."printServer")))
    OR
    (target_device."kind" = 'SERVER' AND source_device."kind" = 'PRINTER'
      AND lower(btrim(target_device."hostname")) = lower(btrim(source_device."printServer")))
  );
