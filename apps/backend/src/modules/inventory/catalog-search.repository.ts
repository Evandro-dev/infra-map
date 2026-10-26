import { prisma, Prisma } from '@infra/database';
import type {
  CatalogSearch,
  CatalogSearchItem,
  CatalogSearchPage,
  CatalogSummary,
} from '@infra/contracts';

/** Identificadores são uma lista fechada; valores do cliente usam parâmetros SQL. */
const columns = {
  manufacturer: 'manufacturer',
  model: 'model',
  hostname: 'hostname',
  operatingSystem: 'operatingSystem',
  assignedUser: 'assignedUser',
  printServer: 'printServer',
  printQueue: 'printQueue',
  printShare: 'printShare',
  approvedDriver: 'approvedDriver',
  printPort: 'printPort',
  printProtocol: 'printProtocol',
} as const;
const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const escapeSearch = (value: string) => normalizeSearch(value).replace(/[!%_]/g, '!$&');

function candidates(query: CatalogSearch) {
  const field = columns[query.field];
  const isPrint = field.startsWith('print') || field === 'approvedDriver';
  const scoped = isPrint && field !== 'printServer' && query.server !== '';
  const deviceColumn = Prisma.raw(`d."${field}"`);
  const extra =
    field === 'printQueue'
      ? Prisma.sql`jsonb_build_object('name',d."printQueue",'shareName',d."printShare",'driverName',d."approvedDriver",'portName',d."printPort",'hostAddress',d."ipAddress",'protocol',d."printProtocol",'portNumber',d."printPortNumber",'shared',COALESCE(d."printShare",'')<>'','location',NULL)`
      : field === 'printPort'
        ? Prisma.sql`jsonb_build_object('name',d."printPort",'hostAddress',d."ipAddress",'protocol',d."printProtocol",'portNumber',d."printPortNumber")`
        : Prisma.sql`NULL::jsonb`;
  const parts: Prisma.Sql[] = [
    Prisma.sql`
    SELECT ${deviceColumn} AS value, 'INVENTORY'::text AS source,d."printServer" AS server,NULL::timestamp AS "collectedAt",${extra} AS extra
    FROM "Device" d WHERE ${deviceColumn} IS NOT NULL AND btrim(${deviceColumn})<>''
    ${query.kind ? Prisma.sql`AND d.kind=${query.kind}` : Prisma.empty}
    ${scoped ? Prisma.sql`AND lower(btrim(d."printServer"))=${query.server.toLowerCase()}` : Prisma.empty}
    ${field === 'printQueue' || field === 'printPort' ? Prisma.sql`AND COALESCE(btrim(d."printServer"),'')<>''` : Prisma.empty}
  `,
  ];
  if (!isPrint) return Prisma.join(parts, ' UNION ALL ');
  const scope = scoped ? Prisma.sql`AND s."serverKey"=${query.server.toLowerCase()}` : Prisma.empty;
  if (field === 'printServer') {
    parts.push(
      Prisma.sql`SELECT s."serverName",s.source,s."serverName",s."collectedAt",NULL::jsonb FROM "PrintCatalogSnapshot" s WHERE true ${scope}`,
    );
  } else {
    const queueKey = {
      printQueue: 'name',
      printShare: 'shareName',
      approvedDriver: 'driverName',
      printPort: 'portName',
      printProtocol: 'protocol',
    }[field as 'printQueue' | 'printShare' | 'approvedDriver' | 'printPort' | 'printProtocol'];
    if (queueKey)
      parts.push(
        Prisma.sql`SELECT q->>${queueKey},s.source,s."serverName",s."collectedAt",${field === 'printQueue' ? Prisma.sql`q` : Prisma.sql`NULL::jsonb`} FROM "PrintCatalogSnapshot" s CROSS JOIN LATERAL jsonb_array_elements(s.payload->'queues') q WHERE COALESCE(q->>${queueKey},'')<>'' ${scope}`,
      );
    if (field === 'approvedDriver')
      parts.push(
        Prisma.sql`SELECT v->>'name',s.source,s."serverName",s."collectedAt",NULL::jsonb FROM "PrintCatalogSnapshot" s CROSS JOIN LATERAL jsonb_array_elements(s.payload->'drivers') v WHERE COALESCE(v->>'name','')<>'' ${scope}`,
      );
    if (field === 'printPort' || field === 'printProtocol') {
      const key = field === 'printPort' ? 'name' : 'protocol';
      parts.push(
        Prisma.sql`SELECT v->>${key},s.source,s."serverName",s."collectedAt",${field === 'printPort' ? Prisma.sql`v` : Prisma.sql`NULL::jsonb`} FROM "PrintCatalogSnapshot" s CROSS JOIN LATERAL jsonb_array_elements(s.payload->'ports') v WHERE COALESCE(v->>${key},'')<>'' ${scope}`,
      );
    }
  }
  return Prisma.join(parts, ' UNION ALL ');
}

export const catalogSearchRepository = {
  async page(query: CatalogSearch): Promise<CatalogSearchPage> {
    const compound = query.field === 'printQueue' || query.field === 'printPort';
    const partition = compound
      ? Prisma.sql`lower(btrim(value)),lower(COALESCE(server,''))`
      : Prisma.sql`lower(btrim(value))`;
    const pattern = `%${escapeSearch(query.search)}%`;
    const [result] = await prisma.$queryRaw<
      Array<{
        total: number;
        items: Array<{
          key: string;
          value: string;
          source: CatalogSearchItem['source'];
          server: string | null;
          collectedAt: string | null;
          extra: unknown;
        }>;
      }>
    >(Prisma.sql`
      WITH candidates AS (${candidates(query)}),
      ranked AS (
        SELECT *,row_number() OVER (PARTITION BY ${partition} ORDER BY CASE source WHEN 'WINDOWS' THEN 3 WHEN 'INVENTORY' THEN 2 ELSE 1 END DESC,"collectedAt" DESC NULLS LAST,value,server) AS rank
        FROM candidates
      ), filtered AS (
        SELECT md5(${query.field}||':'||lower(btrim(value))||':'||${compound ? Prisma.sql`lower(COALESCE(server,''))` : Prisma.sql`''`}) AS key,btrim(value) AS value,source,server,"collectedAt",extra
        FROM ranked WHERE rank=1 AND translate(lower(concat_ws(' ',value,server,extra->>'shareName',extra->>'driverName')),'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn') LIKE ${pattern} ESCAPE '!'
      ), page AS (SELECT * FROM filtered ORDER BY lower(value),COALESCE(lower(server),''),key LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize})
      SELECT (SELECT count(*)::int FROM filtered) AS total,COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY lower(value),COALESCE(lower(server),''),key) FROM page),'[]'::jsonb) AS items
    `);
    const items: CatalogSearchItem[] = result.items.map((row) => {
      const collectedAt = row.collectedAt
        ? new Date(
            row.collectedAt.endsWith('Z') ? row.collectedAt : `${row.collectedAt}Z`,
          ).toISOString()
        : null;
      const item: CatalogSearchItem = {
        key: row.key,
        value: row.value,
        source: row.source,
        server: row.server,
        collectedAt,
      };
      if (row.extra && typeof row.extra === 'object' && row.server) {
        const metadata = {
          ...row.extra,
          key: row.key,
          server: row.server,
          source: row.source,
          collectedAt,
        };
        if (query.field === 'printQueue') item.queue = metadata as CatalogSearchItem['queue'];
        if (query.field === 'printPort') item.port = metadata as CatalogSearchItem['port'];
      }
      return item;
    });
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / query.pageSize),
      hasNext: query.page * query.pageSize < result.total,
    };
  },
  async summary(server = ''): Promise<CatalogSummary> {
    const reference = await prisma.printCatalogSnapshot.findFirst({
      where: { source: 'REFERENCE' },
      select: { serverName: true },
      orderBy: { collectedAt: 'desc' },
    });
    const fallback = reference
      ? null
      : await prisma.device.findFirst({
          where: { printServer: { not: null } },
          select: { printServer: true },
          orderBy: { name: 'asc' },
        });
    const defaultServer = reference?.serverName ?? fallback?.printServer ?? null;
    const selected = server || defaultServer;
    const rows = await prisma.$queryRaw<
      Array<{
        server: string;
        source: 'WINDOWS' | 'REFERENCE';
        collectedAt: Date;
        referenceDate: string | null;
        queueCount: number;
        warnings: string[];
      }>
    >(Prisma.sql`
      SELECT "serverName" AS server,source,"collectedAt",payload->>'referenceDate' AS "referenceDate",jsonb_array_length(payload->'queues') AS "queueCount",payload->'warnings' AS warnings FROM "PrintCatalogSnapshot"
      WHERE ${selected ? Prisma.sql`"serverKey"=${selected.toLowerCase()}` : Prisma.sql`false`} ORDER BY "collectedAt" DESC LIMIT 10
    `);
    return {
      defaultServer,
      snapshots: rows.map((row) => ({ ...row, collectedAt: row.collectedAt.toISOString() })),
    };
  },
};
