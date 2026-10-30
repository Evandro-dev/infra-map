import { isIP } from 'node:net';
import type { WindowsComputerReport, PrintServerIdentity } from '@infra/contracts';
import { prisma } from '@infra/database';

type IdentityInput = {
  hostname?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  operatingSystem?: string | null;
  ipAddress?: string | null;
  macAddress?: string | null;
  networkAdapters?: WindowsComputerReport['networkAdapters'];
};

const clean = (value: string | null | undefined) => {
  const normalized = value?.trim();
  if (
    !normalized ||
    /^(unknown|none|n\/a|default string|to be filled by o\.e\.m\.|system serial number)$/i.test(
      normalized,
    )
  )
    return null;
  return normalized;
};

function primaryAdapter(input: IdentityInput, targetAddress: string | null) {
  const adapters = input.networkAdapters ?? [];
  if (targetAddress && isIP(targetAddress)) {
    const exact = adapters.filter((row) => row.ipv4Addresses.includes(targetAddress));
    if (exact.length === 1) return exact[0];
  }
  const routed = adapters.filter(
    (row) => row.defaultGateways.length > 0 && row.ipv4Addresses.length > 0,
  );
  return routed.length === 1 ? routed[0] : null;
}

function normalizeMac(value: string | null | undefined) {
  const compact = value?.replace(/[:-]/g, '').toUpperCase();
  if (!compact || !/^[0-9A-F]{12}$/.test(compact)) return null;
  const bytes = compact.match(/.{2}/g)!;
  const first = Number.parseInt(bytes[0], 16);
  if ((first & 1) !== 0 || compact === '000000000000' || compact === 'FFFFFFFFFFFF') return null;
  return bytes.join(':');
}

export const deviceIdentityRepository = {
  async fillMissing(deviceId: string, input: IdentityInput) {
    const existing = await prisma.device.findUnique({
      where: { id: deviceId },
      select: {
        id: true,
        kind: true,
        hostname: true,
        manufacturer: true,
        model: true,
        serialNumber: true,
        operatingSystem: true,
        ipAddress: true,
        macAddress: true,
      },
    });
    if (!existing || !['COMPUTER', 'SERVER', 'PDV'].includes(existing.kind)) return [];

    const adapter = primaryAdapter(input, existing.ipAddress);
    const candidates = {
      hostname: clean(input.hostname),
      manufacturer: clean(input.manufacturer),
      model: clean(input.model),
      serialNumber: clean(input.serialNumber),
      operatingSystem: clean(input.operatingSystem),
      ipAddress:
        (input.ipAddress && isIP(input.ipAddress) ? input.ipAddress : null) ??
        (adapter?.ipv4Addresses.length === 1 ? adapter.ipv4Addresses[0] : null),
      macAddress: normalizeMac(input.macAddress ?? adapter?.macAddress),
    };
    const data: Record<string, string> = {};
    for (const key of Object.keys(candidates) as (keyof typeof candidates)[]) {
      if (existing[key] === null && candidates[key]) data[key] = candidates[key]!;
    }
    const fields = Object.keys(data);
    if (fields.length) await prisma.device.update({ where: { id: deviceId }, data });
    return fields;
  },
  fromComputerReport(report: WindowsComputerReport): IdentityInput {
    return {
      hostname: report.identity?.hostname,
      manufacturer: report.identity?.manufacturer,
      model: report.identity?.model,
      serialNumber: report.identity?.serialNumber,
      operatingSystem: report.osCaption,
      networkAdapters: report.networkAdapters,
    };
  },
  fromPrintServerIdentity(identity: PrintServerIdentity): IdentityInput {
    return identity;
  },
};
