import type { Device } from '@/lib/types';
import type { PrinterConfiguration } from '@infra/contracts';

export function printerConfiguration(device: Device): PrinterConfiguration {
  return {
    printServer: device.printServer,
    printQueue: device.printQueue,
    printShare: device.printShare,
    approvedDriver: device.approvedDriver,
    printPort: device.printPort,
    printProtocol: device.printProtocol,
    printPortNumber: device.printPortNumber,
    ipAddress: device.ipAddress,
  };
}
