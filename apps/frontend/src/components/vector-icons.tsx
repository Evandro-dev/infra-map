'use client';
import { Group, Path } from 'react-konva';
const glyphs: Record<string, string[]> = {
  layers: ['M12 2L21 7L12 12L3 7Z', 'M3 12L12 17L21 12', 'M3 17L12 22L21 17'],
  scan: ['M8 3H3V8', 'M16 3H21V8', 'M3 16V21H8', 'M16 21H21V16'],
  'eye-off': [
    'M3 3L21 21',
    'M10.7 10.8A2 2 0 0 0 13.2 13.2',
    'M9.2 5.2A10.8 10.8 0 0 1 12 4C17 4 21 8 22 12A13 13 0 0 1 18 16',
    'M5 7C3.5 8.5 2.3 10.4 2 12C4 16 8 20 12 20A10.9 10.9 0 0 0 15 19',
  ],
  'more-horizontal': ['M5 12H5.01', 'M12 12H12.01', 'M19 12H19.01'],
  monitor: [
    'M4 3H20A2 2 0 0 1 22 5V16A2 2 0 0 1 20 18H4A2 2 0 0 1 2 16V5A2 2 0 0 1 4 3Z',
    'M8 22H16',
    'M12 18V22',
  ],
  'monitor-cog': ['M2 3H22V17H2Z', 'M8 21H16', 'M12 17V21', 'M18 9V11M18 5V7M15 8H17M19 8H21'],
  printer: [
    'M6 9V3H18V9',
    'M6 18H4A2 2 0 0 1 2 16V11A3 3 0 0 1 5 8H19A3 3 0 0 1 22 11V16A2 2 0 0 1 20 18H18',
    'M6 15H18V22H6Z',
    'M17.5 11.5H18',
  ],
  server: [
    'M4 2H20A2 2 0 0 1 22 4V9A2 2 0 0 1 20 11H4A2 2 0 0 1 2 9V4A2 2 0 0 1 4 2Z',
    'M4 13H20A2 2 0 0 1 22 15V20A2 2 0 0 1 20 22H4A2 2 0 0 1 2 20V15A2 2 0 0 1 4 13Z',
    'M6 6.5H6.01',
    'M6 17.5H6.01',
  ],
  network: ['M12 3V10', 'M6 10H18', 'M6 10V14', 'M18 10V14', 'M3 14H9V21H3Z', 'M15 14H21V21H15Z'],
  scale: [
    'M4 11V5A2 2 0 0 1 6 3H18A2 2 0 0 1 20 5V11',
    'M5 11H19L21 20A1 1 0 0 1 20 21H4A1 1 0 0 1 3 20Z',
    'M9 6H15V9H9Z',
    'M8 16H16',
    'M12 15V18',
  ],
  cctv: ['M2 8L19 3L22 11L5 16Z', 'M5 16L9 20H17', 'M14 14L17 20', 'M17 20H21'],
  battery: ['M5 6H19V21H5Z', 'M10 2H14V6', 'M12 9L9 14H13L11 18'],
  'shopping-cart': ['M3 4H5L8 17H20L22 8H6', 'M9 21H9.01', 'M19 21H19.01'],
  users: [
    'M16 20V18A4 4 0 0 0 12 14H6A4 4 0 0 0 2 18V20',
    'M9 10A4 4 0 1 0 9 2A4 4 0 0 0 9 10',
    'M20 20V18A4 4 0 0 0 17 14',
    'M16 2A4 4 0 0 1 16 10',
  ],
  beef: ['M16 4C8 0 3 7 5 12C1 15 4 22 10 21C17 20 22 15 20 9Z', 'M9 10H9.01'],
  wallet: ['M3 6H20V20H3Z', 'M3 6V4H17', 'M15 11H22V16H15Z'],
  boxes: ['M3 3H11V11H3Z', 'M13 3H21V11H13Z', 'M8 13H16V21H8Z'],
  'door-open': ['M4 22H20', 'M6 20V2L17 4V20', 'M13 11H13.01'],
  box: ['M3 7L12 3L21 7L12 11Z', 'M3 7V17L12 21L21 17V7', 'M12 11V21'],
  pencil: ['M15 5L19 9', 'M4 20L9 19L20 8A2 2 0 0 0 17 5L6 16Z'],
  lock: ['M5 11H19V21H5Z', 'M8 11V7A4 4 0 0 1 16 7V11'],
  unlock: ['M5 11H19V21H5Z', 'M8 11V7A4 4 0 0 1 16 7'],
  trash: [
    'M3 6H21',
    'M8 6V4A1 1 0 0 1 9 3H15A1 1 0 0 1 16 4V6',
    'M5 6L6 20A2 2 0 0 0 8 22H16A2 2 0 0 0 18 20L19 6',
    'M10 10V17',
    'M14 10V17',
  ],
};
export function VectorIcon({
  name,
  x = 0,
  y = 0,
  size = 24,
  color = '#363638',
}: {
  name: string;
  x?: number;
  y?: number;
  size?: number;
  color?: string;
}) {
  const paths = glyphs[name] ?? glyphs.box;
  return (
    <Group x={x} y={y} scaleX={size / 24} scaleY={size / 24} listening={false}>
      {paths.map((data, i) => (
        <Path
          key={i}
          data={data}
          stroke={color}
          strokeWidth={1.45}
          strokeLinecap="round"
          strokeLinejoin="round"
          fillEnabled={false}
          opacity={0.95}
        />
      ))}
    </Group>
  );
}
