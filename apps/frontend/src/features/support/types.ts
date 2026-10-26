import type { Device } from '@/lib/types';

export type ReferencePrinter = Device & {
  printServer: string | null;
  printShare: string | null;
  approvedDriver: string | null;
};
export type SupportDevice = Device & {
  islComputerId: string | null;
  islComputerName: string | null;
  assignedPrinters: Array<{ printerId: string; printer: ReferencePrinter }>;
  assignedComputers: Array<{ computerId: string; computer: Device }>;
  supportJobs: Array<{
    id: string;
    action: string;
    status: string;
    resultSummary: string | null;
    createdAt: string;
  }>;
};
