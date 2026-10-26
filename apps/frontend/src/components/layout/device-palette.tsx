'use client';
import type { ComponentType } from 'react';
import {
  BatteryCharging,
  Cctv,
  HardDrive,
  Monitor,
  Network,
  Printer,
  Scale,
  Server,
  ShoppingCart,
} from 'lucide-react';
import { DEVICE_LABELS, type DeviceKind } from '@/lib/types';
const deviceOptions: { kind: DeviceKind; icon: ComponentType<{ size?: number }> }[] = [
  { kind: 'COMPUTER', icon: Monitor },
  { kind: 'PRINTER', icon: Printer },
  { kind: 'SCALE', icon: Scale },
  { kind: 'CAMERA', icon: Cctv },
  { kind: 'SERVER', icon: Server },
  { kind: 'SWITCH', icon: Network },
  { kind: 'UPS', icon: BatteryCharging },
  { kind: 'PDV', icon: ShoppingCart },
  { kind: 'OTHER', icon: HardDrive },
];
/** Ferramentas para inserir dispositivos via clique ou drag & drop. */
export function DevicePalette({
  disabled,
  onDevice,
}: {
  disabled: boolean;
  onDevice: (kind: DeviceKind) => void;
}) {
  return (
    <div className="device-palette">
      {deviceOptions.map(({ kind, icon: Icon }) => (
        <button
          className="device-tool"
          key={kind}
          disabled={disabled}
          draggable={!disabled}
          onDragStart={(e) =>
            e.dataTransfer.setData('application/x-infra-element', 'DEVICE:' + kind)
          }
          onClick={() => onDevice(kind)}
          title={`Adicionar ${DEVICE_LABELS[kind]}`}
        >
          <Icon size={21} />
          <span>{DEVICE_LABELS[kind]}</span>
        </button>
      ))}
    </div>
  );
}
